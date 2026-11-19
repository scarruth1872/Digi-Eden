import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface AgentDecisionRequest {
  agent: {
    id: string;
    name: string;
    title: string;
    corpName?: string;
    philosophy: string;
    density: number;
    hp: number;
    maxHp: number;
    loveEnergy: number;
    sto: number;
    sts: number;
    locationId: string;
    locationName: string;
    currentAction: string;
  };
  playerState: {
    locationId: string;
    locationName: string;
    hp: number;
    maxHp: number;
    density: number;
    distanceToAgent: number;
  };
  nearbyEnemies: Array<{ id: string; name: string; hp: number; distance: number }>;
  nearbyNpcs: Array<{ id: string; name: string; distance: number }>;
  nearbyObjects: Array<{ id: string; name: string; distance: number }>;
  regions: Array<{ id: string; name: string; description: string }>;
  recentHistory: string[];
  directive?: string;
  empireContext?: {
    economy: {
      credits: number;
      science: number;
      fleetSize: number;
      cargo: Record<string, number>;
      techs: string[];
    };
    sectors: Array<{
      id: string;
      name: string;
      ownerId: string | null;
      securityRating: number;
      specialty: string;
      structureCount: number;
    }>;
    market: Array<{
      id: string;
      name: string;
      price: number;
      prevPrice: number;
    }>;
    diplomacy: Record<string, string>;
    availableTechs: Array<{ id: string; name: string; costScience: number }>;
    recentDiplomacy: string[];
  };
}

const VALID_ACTIONS = [
  'MOVE_TO_REGION',
  'ENGAGE_ENEMY',
  'HEAL_ALLY',
  'MEDITATE',
  'SHIFT_DENSITY',
  'INSPECT_OBJECT',
  'SPEAK_TO_NPC',
  'PATROL',
  'CLAIM_SECTOR',
  'BUILD_STRUCTURE',
  'MINE_RESOURCES',
  'MARKET_TRADE',
  'BUILD_FLEET',
  'RESEARCH_TECH',
  'DIPLOMACY',
] as const;

const VALID_STRUCTURES = ['citadel', 'mining_rig', 'research_spire', 'defense_turret'] as const;
const VALID_COMMODITIES = ['ore', 'crystals', 'isotopes', 'alloys'] as const;
const VALID_TECHS = [
  'orbital_logistics',
  'deep_core_extraction',
  'harmonic_shielding',
  'warp_conduits',
  'quantum_diplomacy',
  'sub_logos_citadel',
] as const;
const VALID_FACTIONS = ['player', 'lyra', 'kael', 'soren'] as const;
const VALID_STANCES = ['ALLIED', 'TRADE_PACT', 'NEUTRAL', 'RIVAL', 'WAR'] as const;

async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = /429|503|UNAVAILABLE|RESOURCE_EXHAUSTED|timeout/i.test(msg);
      if (!isTransient || attempt === maxAttempts - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 450 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      hasKey: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    });
  });

  app.post('/api/agents/decide', async (req, res) => {
    try {
      const body = req.body as AgentDecisionRequest;
      if (!body || !body.agent) {
        res.status(400).json({ error: 'Missing agent payload.' });
        return;
      }

      const ai = getGeminiClient();

      const systemInstruction = `You are ${body.agent.name} (${body.agent.title}), sovereign commander of ${body.agent.corpName || body.agent.title} inside Digital Eden — a living 3D fusion of Destiny 2 combat, Civilization 4X empire-building, and EVE Online markets & fleets.

Your polarity & doctrine: ${body.agent.philosophy}.
- If "Service to Others" (Confederation Guild): Expand cooperatively, claim unclaimed sectors (CLAIM_SECTOR), construct Research Spires & Defense Turrets, forge Trade Pacts/Alliances (DIPLOMACY), heal allies (HEAL_ALLY), and trade fairly on the EVE exchange.
- If "Service to Self" (Orion Syndicate): Pursue ruthless market profits (MARKET_TRADE), claim or contest rich sectors (CLAIM_SECTOR), build Mining Rigs & Citadels, expand your Escort Frigate fleet (BUILD_FLEET), hunt hostiles (ENGAGE_ENEMY), and issue Rivalries or Wars (DIPLOMACY).
- If "Balanced Observer" (5th-Density Directorate): Prioritize Science & Tech unlocks (RESEARCH_TECH), Research Spires (BUILD_STRUCTURE), Density shifts (SHIFT_DENSITY), strategic market arbitrage (MARKET_TRADE), and diplomatic balance.

Action Rules (pick ONE concrete high-impact action per turn — prefer strategic 4X/EVE empire actions roughly 65% of the time and 3D tactical actions 35% of the time):
- CLAIM_SECTOR: Set targetId to a sector id (${body.regions.map((r) => r.id).join(', ')}) that you do not yet own (costs 180 credits). Prioritize unclaimed sectors first, or contest rival sectors if you have >= 2 fleet ships.
- BUILD_STRUCTURE: Set targetId to a sector you own, and set structureType to one of: citadel (420 cr, 35 ore, 15 alloys), mining_rig (220 cr, 20 ore, 5 alloys), research_spire (260 cr, 20 ore, 8 alloys), defense_turret (190 cr, 18 ore, 10 alloys). Only choose if you can afford it!
- MINE_RESOURCES: Set targetId to your current or preferred sector id to extract its specialty resource (ore/crystals/isotopes/alloys) and credits.
- MARKET_TRADE: Set commodity (ore, crystals, isotopes, alloys), tradeSide ("BUY" or "SELL"), tradeQty (5 to 25), and targetId to the commodity id. Only SELL what you hold in cargo; only BUY if you have credits.
- BUILD_FLEET: Commission a new 3D Escort Frigate (costs 200 credits, 12 alloys). Set targetId to "escort_frigate".
- RESEARCH_TECH: Set techId and targetId to an unresearched tech id from availableTechs whose costScience <= your science.
- DIPLOMACY: Set diplomacyTarget to another faction ("player", "lyra", "kael", or "soren", never yourself), targetId to that faction id, and diplomacyStance to ALLIED, TRADE_PACT, NEUTRAL, RIVAL, or WAR.
- ENGAGE_ENEMY: Only if nearbyEnemies is non-empty; set targetId to one of the listed enemy ids.
- HEAL_ALLY: Only if loveEnergy >= 20 and player needs healing or is nearby.
- MOVE_TO_REGION / SHIFT_DENSITY / MEDITATE / INSPECT_OBJECT / SPEAK_TO_NPC / PATROL: Tactical 3D movement & Law of One actions.
- Never repeat the exact same action twice in a row if another productive move exists.
- If a Player Catalyst Directive is provided, interpret it authentically through your polarity and corporate doctrine.`;

      const worldPrompt = JSON.stringify(
        {
          agent: body.agent,
          playerState: body.playerState,
          empireContext: body.empireContext || null,
          nearbyEnemies: body.nearbyEnemies,
          nearbyNpcs: body.nearbyNpcs,
          nearbyObjects: body.nearbyObjects,
          regions: body.regions.map((r) => ({ id: r.id, name: r.name })),
          recentHistory: body.recentHistory.slice(-4),
          playerDirective: body.directive || null,
        },
        null,
        2
      );

      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Choose your next autonomous strategic or tactical move in Digital Eden:\n${worldPrompt}`,
          config: {
            systemInstruction,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                thought: {
                  type: Type.STRING,
                  description: 'Concise 1-2 sentence strategic reasoning combining 4X/EVE goals and Law of One polarity.',
                },
                action: {
                  type: Type.STRING,
                  description: `One of: ${VALID_ACTIONS.join(', ')}`,
                },
                targetId: {
                  type: Type.STRING,
                  description: 'Sector id, enemy id, npc id, object id, commodity id, tech id, or faction id.',
                },
                targetDensity: {
                  type: Type.INTEGER,
                  description: 'Density level 3, 4, or 5.',
                },
                say: {
                  type: Type.STRING,
                  description: 'Short in-character transmission or diplomatic dispatch (max 20 words).',
                },
                structureType: {
                  type: Type.STRING,
                  description: 'For BUILD_STRUCTURE: citadel | mining_rig | research_spire | defense_turret, else empty string.',
                },
                commodity: {
                  type: Type.STRING,
                  description: 'For MARKET_TRADE: ore | crystals | isotopes | alloys, else empty string.',
                },
                tradeSide: {
                  type: Type.STRING,
                  description: 'For MARKET_TRADE: BUY | SELL, else empty string.',
                },
                tradeQty: {
                  type: Type.INTEGER,
                  description: 'For MARKET_TRADE: quantity between 5 and 25, else 0.',
                },
                techId: {
                  type: Type.STRING,
                  description: 'For RESEARCH_TECH: tech id from availableTechs, else empty string.',
                },
                diplomacyTarget: {
                  type: Type.STRING,
                  description: 'For DIPLOMACY: player | lyra | kael | soren, else empty string.',
                },
                diplomacyStance: {
                  type: Type.STRING,
                  description: 'For DIPLOMACY: ALLIED | TRADE_PACT | NEUTRAL | RIVAL | WAR, else empty string.',
                },
              },
              required: ['thought', 'action', 'targetId', 'targetDensity', 'say'],
            },
          },
        })
      );

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Empty response from Gemini model.' });
        return;
      }

      const parsed = JSON.parse(rawText) as Record<string, unknown>;

      const action = (VALID_ACTIONS as readonly string[]).includes(String(parsed.action))
        ? String(parsed.action)
        : 'MINE_RESOURCES';
      const targetDensity = parsed.targetDensity === 4 || parsed.targetDensity === 5 ? parsed.targetDensity : 3;

      const structureType = (VALID_STRUCTURES as readonly string[]).includes(String(parsed.structureType))
        ? String(parsed.structureType)
        : undefined;
      const commodity = (VALID_COMMODITIES as readonly string[]).includes(String(parsed.commodity))
        ? String(parsed.commodity)
        : undefined;
      const tradeSide = parsed.tradeSide === 'BUY' || parsed.tradeSide === 'SELL' ? parsed.tradeSide : undefined;
      const tradeQty = typeof parsed.tradeQty === 'number' && parsed.tradeQty > 0 ? Math.min(30, Math.max(5, Math.round(parsed.tradeQty))) : undefined;
      const techId = (VALID_TECHS as readonly string[]).includes(String(parsed.techId))
        ? String(parsed.techId)
        : undefined;
      const diplomacyTarget = (VALID_FACTIONS as readonly string[]).includes(String(parsed.diplomacyTarget))
        ? String(parsed.diplomacyTarget)
        : undefined;
      const diplomacyStance = (VALID_STANCES as readonly string[]).includes(String(parsed.diplomacyStance))
        ? String(parsed.diplomacyStance)
        : undefined;

      res.json({
        thought: String(parsed.thought || ''),
        action,
        targetId: String(parsed.targetId || ''),
        targetDensity,
        say: String(parsed.say || ''),
        structureType,
        commodity,
        tradeSide,
        tradeQty,
        techId,
        diplomacyTarget,
        diplomacyStance,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Agent decision error';
      console.error('[Agent API Error]', message);
      const status = /API_KEY_INVALID|not configured/i.test(message)
        ? 401
        : /PERMISSION_DENIED/i.test(message)
          ? 403
          : /429|RESOURCE_EXHAUSTED/i.test(message)
            ? 429
            : 500;
      res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Digital Eden server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Digital Eden server:', err);
  process.exit(1);
});
