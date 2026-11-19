import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AgentDecisionResponse,
  AgentLogEntry,
  AgentState,
  CameraMode,
  CommodityId,
  DensityLevel,
  DialogueChoice,
  DiplomacyEvent,
  DiplomaticStance,
  EmpireStructure,
  FactionEconomy,
  FactionId,
  FloatingDamage,
  GameItem,
  GamePhase,
  InteractionTarget,
  JournalEntry,
  LoreEntry,
  MarketCommodity,
  MarketTradeEntry,
  MeditationFocus,
  NPCData,
  PlayerStats,
  Quest,
  QuestObjectiveType,
  SaveState,
  SectorState,
  ServiceType,
  StructureType,
  TechId,
} from './types/game';
import {
  createInitialAgents,
  createInitialDiplomacy,
  createInitialFactions,
  createInitialInventory,
  createInitialMarket,
  createInitialPlayerStats,
  createInitialSectors,
  createInitialStructures,
  INITIAL_LORE,
  INITIAL_QUESTS,
  ITEM_CATALOG,
  LOCATIONS,
  NPCS,
  STRUCTURE_CATALOG,
  TECH_TREE,
  WEAPONS,
  WORLD_OBJECTS,
} from './data/worldData';
import { GameEngine } from './engine/GameEngine';
import { soundEngine } from './audio/soundEngine';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { DialogueModal } from './components/DialogueModal';
import { CodexModal } from './components/CodexModal';
import { PauseModal } from './components/PauseModal';
import { AgentPanel } from './components/AgentPanel';
import { EmpireModal } from './components/EmpireModal';

const SAVE_STORAGE_KEY = 'digital_eden_save_v1';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [phase, setPhase] = useState<GamePhase>('title');
  const [player, setPlayer] = useState<PlayerStats>(() => createInitialPlayerStats());
  const [inventory, setInventory] = useState<GameItem[]>(() => createInitialInventory());
  const [quests, setQuests] = useState<Quest[]>(() => structuredClone(INITIAL_QUESTS));
  const [lore, setLore] = useState<LoreEntry[]>(() => structuredClone(INITIAL_LORE));
  const [journal, setJournal] = useState<JournalEntry[]>([
    {
      id: 'init_1',
      title: 'Awakening in Sanctuary Meadow',
      content:
        'You enter Digital Eden as a Guardian Wanderer. Seek the Seeker Elder nearby to begin your path.',
      timestamp: '00:00',
      category: 'QUEST',
    },
  ]);
  const [worldFlags, setWorldFlags] = useState<Record<string, boolean>>({});
  const [collectedIds, setCollectedIds] = useState<string[]>([]);
  const [examinedIds, setExaminedIds] = useState<string[]>([]);
  const [playerTransform, setPlayerTransform] = useState<{ pos: [number, number, number]; yaw: number }>({
    pos: [0, 0, 14],
    yaw: 0,
  });

  const [interactTarget, setInteractTarget] = useState<InteractionTarget | null>(null);
  const [activeDialogue, setActiveDialogue] = useState<{ npc: NPCData; nodeId: number } | null>(null);
  const [floatingDamages, setFloatingDamages] = useState<FloatingDamage[]>([]);
  const [hitmarkerActive, setHitmarkerActive] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [hasSave, setHasSave] = useState(() => Boolean(localStorage.getItem(SAVE_STORAGE_KEY)));
  const [victoryShown, setVictoryShown] = useState(false);

  const [agents, setAgents] = useState<AgentState[]>(() => createInitialAgents());
  const [agentLogs, setAgentLogs] = useState<AgentLogEntry[]>([]);
  const [agentsPanelOpen, setAgentsPanelOpen] = useState(true);
  const [autonomySpeed, setAutonomySpeed] = useState<'paused' | 'normal' | 'fast'>('normal');
  const [cameraMode, setCameraMode] = useState<CameraMode>('fps');
  const [spectateAgentId, setSpectateAgentId] = useState<string | null>(null);

  // Civilization 4X + EVE Online Empire State
  const [cycleCount, setCycleCount] = useState(1);
  const [sectors, setSectors] = useState<SectorState[]>(() => createInitialSectors());
  const [structures, setStructures] = useState<EmpireStructure[]>(() => createInitialStructures());
  const [factions, setFactions] = useState<Record<FactionId, FactionEconomy>>(() => createInitialFactions());
  const [market, setMarket] = useState<MarketCommodity[]>(() => createInitialMarket());
  const [tradeTape, setTradeTape] = useState<MarketTradeEntry[]>([]);
  const [diplomacy, setDiplomacy] = useState<Record<FactionId, Record<FactionId, DiplomaticStance>>>(() =>
    createInitialDiplomacy()
  );
  const [diplomacyFeed, setDiplomacyFeed] = useState<DiplomacyEvent[]>([]);

  const toastTimerRef = useRef<number | null>(null);
  const hitmarkerTimerRef = useRef<number | null>(null);
  const inFlightAgentsRef = useRef<Set<string>>(new Set());
  const agentCursorRef = useRef(0);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3200);
  }, []);

  const addJournal = useCallback(
    (title: string, content: string, category: JournalEntry['category']) => {
      setJournal((prev) => [
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title,
          content,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          category,
        },
        ...prev,
      ]);
    },
    []
  );

  // Refs so Three.js engine callbacks & async agent turns always read fresh state
  const stateRef = useRef({
    phase,
    player,
    inventory,
    quests,
    collectedIds,
    examinedIds,
    victoryShown,
    agents,
    agentLogs,
    cameraMode,
    spectateAgentId,
    sectors,
    structures,
    factions,
    market,
    diplomacy,
    diplomacyFeed,
    cycleCount,
  });
  stateRef.current = {
    phase,
    player,
    inventory,
    quests,
    collectedIds,
    examinedIds,
    victoryShown,
    agents,
    agentLogs,
    cameraMode,
    spectateAgentId,
    sectors,
    structures,
    factions,
    market,
    diplomacy,
    diplomacyFeed,
    cycleCount,
  };

  const progressQuestObjective = useCallback(
    (type: QuestObjectiveType, target: string, amount = 1) => {
      setQuests((prevQuests) => {
        let changed = false;
        let completedQuest: Quest | null = null;

        const next = prevQuests.map((q) => {
          if (q.completed || !q.active) return q;
          const stageIdx = q.stages.findIndex((s) => s.stageNumber === q.currentStage);
          if (stageIdx === -1) return q;

          const stage = q.stages[stageIdx];
          let stageChanged = false;
          const newObjectives = stage.objectives.map((obj) => {
            if (!obj.completed && obj.type === type && obj.target === target) {
              const count = Math.min(obj.requiredCount, obj.currentCount + amount);
              stageChanged = true;
              changed = true;
              return { ...obj, currentCount: count, completed: count >= obj.requiredCount };
            }
            return obj;
          });

          if (!stageChanged) return q;

          const stageDone = newObjectives.every((o) => o.completed);
          const newStages = q.stages.map((s, idx) =>
            idx === stageIdx ? { ...s, objectives: newObjectives, completed: stageDone } : s
          );

          if (stageDone) {
            if (q.currentStage < q.stages.length) {
              showToast(`Quest Stage Complete: ${q.name}`);
              return { ...q, stages: newStages, currentStage: q.currentStage + 1 };
            } else {
              completedQuest = q;
              return { ...q, stages: newStages, completed: true };
            }
          }
          return { ...q, stages: newStages };
        });

        if (completedQuest) {
          const cq = completedQuest as Quest;
          showToast(`Quest Completed: ${cq.name} (+${cq.experienceReward} XP)`);
          addJournal(`Completed: ${cq.name}`, cq.completionMessage, 'QUEST');

          setPlayer((p) => {
            let xp = p.experience + cq.experienceReward;
            let level = p.level;
            let xpToNext = p.xpToNext;
            let maxHealth = p.maxHealth;
            let attack = p.attack;
            let defense = p.defense;
            while (xp >= xpToNext) {
              xp -= xpToNext;
              level += 1;
              xpToNext = Math.round(xpToNext * 1.35);
              maxHealth += 15;
              attack += 3;
              defense += 2;
            }
            return {
              ...p,
              level,
              experience: xp,
              xpToNext,
              maxHealth,
              health: maxHealth,
              attack,
              defense,
              serviceToOthers: p.serviceToOthers + cq.serviceToOthersReward,
              serviceToSelf: p.serviceToSelf + cq.serviceToSelfReward,
              harvestScore: p.harvestScore + cq.harvestReward,
            };
          });
        }

        if (changed && next.every((q) => q.completed) && !stateRef.current.victoryShown) {
          setVictoryShown(true);
          window.setTimeout(() => {
            setPhase('victory');
          }, 900);
        }

        return changed ? next : prevQuests;
      });
    },
    [addJournal, showToast]
  );

  const grantItem = useCallback(
    (itemId: string) => {
      const def = ITEM_CATALOG[itemId];
      if (!def) return;
      setInventory((prev) => {
        const existing = prev.find((i) => i.id === itemId);
        if (existing) {
          return prev.map((i) => (i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i));
        }
        if (prev.length >= 10) {
          showToast('Inventory full (10/10)');
          return prev;
        }
        return [...prev, { ...def, quantity: 1 }];
      });
      showToast(`Acquired: ${def.name}`);
    },
    [showToast]
  );

  const handleDensityShift = useCallback(
    (targetDensity: DensityLevel) => {
      const p = stateRef.current.player;
      if (p.currentDensity === targetDensity) return;
      const cost = Math.abs(targetDensity - p.currentDensity) * 15;
      if (p.astralEnergy < cost) {
        showToast(`Need ${cost} Astral Energy to shift to ${targetDensity}th Density`);
        return;
      }
      setPlayer((prev) => ({
        ...prev,
        currentDensity: targetDensity,
        astralEnergy: Math.max(0, prev.astralEnergy - cost),
      }));
      engineRef.current?.setDensity(targetDensity);
      showToast(
        targetDensity === 3
          ? 'Shifted to 3rd Density (Physical Plane)'
          : targetDensity === 4
            ? 'Shifted to 4th Density (Compassion & Empathy)'
            : 'Shifted to 5th Density (Wisdom & Light)'
      );
    },
    [showToast]
  );

  const handleLoveHeal = useCallback(() => {
    const p = stateRef.current.player;
    if (p.loveEnergy < 25) {
      showToast('Need 25 Love Energy to heal [Defeat foes or serve others]');
      return;
    }
    if (p.health >= p.maxHealth && p.shield >= p.maxShield) {
      showToast('Vitality is already full');
      return;
    }
    const healAmount = 45 + Math.round(p.serviceLevels[ServiceType.EMPATHETIC_HEALING] * 0.25);
    setPlayer((prev) => ({
      ...prev,
      loveEnergy: Math.max(0, prev.loveEnergy - 25),
      health: Math.min(prev.maxHealth, prev.health + healAmount),
      shield: Math.min(prev.maxShield, prev.shield + 25),
      serviceToOthers: prev.serviceToOthers + 5,
    }));
    engineRef.current?.triggerHealEffect();
    showToast(`Love Energy Heal (+${healAmount} HP)`);
  }, [showToast]);

  const handleSuperNova = useCallback(() => {
    const p = stateRef.current.player;
    if (p.superCharge < 100) {
      showToast('Sub-Logos Nova charging...');
      return;
    }
    setPlayer((prev) => ({ ...prev, superCharge: 0 }));
    engineRef.current?.triggerSuperNova(180 + p.attack * 4);
    showToast('Sub-Logos Nova Unleashed!');
  }, [showToast]);

  const handleSelectWeapon = useCallback(
    (weaponId: string) => {
      if (!WEAPONS[weaponId]) return;
      setPlayer((prev) => ({ ...prev, equippedWeaponId: weaponId }));
      engineRef.current?.setEquippedWeapon(weaponId);
      soundEngine.playUiBlip();
      showToast(`Equipped ${WEAPONS[weaponId].name}`);
    },
    [showToast]
  );

  const handleCycleWeapon = useCallback(() => {
    const ids = Object.keys(WEAPONS);
    const idx = ids.indexOf(stateRef.current.player.equippedWeaponId);
    const nextId = ids[(idx + 1) % ids.length];
    handleSelectWeapon(nextId);
  }, [handleSelectWeapon]);

  const handleInteract = useCallback(
    (target: InteractionTarget) => {
      if (target.type === 'npc') {
        const npc = NPCS.find((n) => n.id === target.id);
        if (!npc) return;
        soundEngine.playUiBlip();
        setActiveDialogue({ npc, nodeId: 0 });
        setPhase('dialogue');
        progressQuestObjective(QuestObjectiveType.TALK_TO, npc.id, 1);
      } else {
        const obj = WORLD_OBJECTS.find((o) => o.id === target.id);
        if (!obj) return;
        if (target.densityLocked) {
          showToast(`Shift to ${target.densityLocked}th Density [Press ${target.densityLocked - 1}] first`);
          return;
        }
        soundEngine.playUiBlip();

        if (obj.isHarmonizeAltar) {
          if (stateRef.current.examinedIds.includes(obj.id)) {
            showToast('The Harmonic Resonance Altar already sings in unity.');
            return;
          }
          setExaminedIds((prev) => [...prev, obj.id]);
          engineRef.current?.triggerHealEffect();
          setPlayer((prev) => ({
            ...prev,
            serviceToOthers: prev.serviceToOthers + 35,
            harvestScore: prev.harvestScore + 80,
            loveEnergy: prev.maxLoveEnergy,
          }));
          progressQuestObjective(QuestObjectiveType.HARMONIZE, 'harmony_altar', 1);
          showToast('Harmonized with the 4th-Density Altar! (+80 Harvest)');
          return;
        }

        if (!stateRef.current.examinedIds.includes(obj.id)) {
          setExaminedIds((prev) => [...prev, obj.id]);
          if (obj.loreId) {
            setLore((prev) =>
              prev.map((l) => (l.id === obj.loreId ? { ...l, discovered: true } : l))
            );
            addJournal(obj.name, obj.description, 'LORE');
          }
          if (obj.objectiveTarget) {
            progressQuestObjective(QuestObjectiveType.EXAMINE, obj.objectiveTarget, 1);
          }
        }

        if (obj.itemRewardId && !stateRef.current.collectedIds.includes(obj.id)) {
          setCollectedIds((prev) => [...prev, obj.id]);
          grantItem(obj.itemRewardId);
          engineRef.current?.markObjectCollected(obj.id);
        } else {
          showToast(obj.description);
        }
      }
    },
    [addJournal, grantItem, progressQuestObjective, showToast]
  );

  // Shared Civilization + EVE Empire Action Executors (used by both Player & Autonomous Agents)
  const executeClaimSector = useCallback(
    (actorId: FactionId, sectorId: string): { ok: boolean; label: string } => {
      const sec = stateRef.current.sectors.find((s) => s.id === sectorId);
      const econ = stateRef.current.factions[actorId];
      if (!sec || !econ || sec.ownerId === actorId) return { ok: false, label: sec?.name || sectorId };
      if (econ.credits < 180) return { ok: false, label: sec.name };

      setFactions((prev) => ({
        ...prev,
        [actorId]: { ...prev[actorId], credits: prev[actorId].credits - 180 },
      }));
      setSectors((prev) =>
        prev.map((s) => (s.id === sectorId ? { ...s, ownerId: actorId, controlPercent: 100 } : s))
      );
      if (actorId === 'player') {
        soundEngine.playDensityShift(4);
        showToast(`Claimed sovereignty over ${sec.name}!`);
      } else {
        showToast(`${econ.corpName} claimed sovereignty over ${sec.name}`);
      }
      return { ok: true, label: sec.name };
    },
    [showToast]
  );

  const executeBuildStructure = useCallback(
    (actorId: FactionId, sectorId: string, type: StructureType): { ok: boolean; label: string } => {
      const sec = stateRef.current.sectors.find((s) => s.id === sectorId);
      const econ = stateRef.current.factions[actorId];
      const def = STRUCTURE_CATALOG[type];
      if (!sec || !econ || !def || sec.ownerId !== actorId) {
        return { ok: false, label: def?.name || type };
      }
      if (
        econ.credits < def.costCredits ||
        econ.cargo.ore < def.costOre ||
        econ.cargo.alloys < def.costAlloys
      ) {
        return { ok: false, label: def.name };
      }

      const existingInSector = stateRef.current.structures.filter((st) => st.sectorId === sectorId).length;
      const angle = existingInSector * 1.18 + 0.4;
      const dist = 11 + (existingInSector % 3) * 5.2;
      const pos: [number, number] = [
        Math.round(sec.center[0] + Math.cos(angle) * dist),
        Math.round(sec.center[1] + Math.sin(angle) * dist),
      ];

      setFactions((prev) => ({
        ...prev,
        [actorId]: {
          ...prev[actorId],
          credits: prev[actorId].credits - def.costCredits,
          cargo: {
            ...prev[actorId].cargo,
            ore: prev[actorId].cargo.ore - def.costOre,
            alloys: prev[actorId].cargo.alloys - def.costAlloys,
          },
        },
      }));

      setStructures((prev) => [
        ...prev,
        {
          id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type,
          sectorId,
          ownerId: actorId,
          position: pos,
          builtAt: `Cycle ${stateRef.current.cycleCount}`,
        },
      ]);

      if (actorId === 'player') {
        soundEngine.playDensityShift(5);
        showToast(`Constructed ${def.name} in ${sec.name}`);
      } else {
        showToast(`${econ.name} built ${def.name} in ${sec.name}`);
      }
      return { ok: true, label: `${def.name} (${sec.name})` };
    },
    [showToast]
  );

  const executeCommissionFrigate = useCallback(
    (actorId: FactionId): boolean => {
      const econ = stateRef.current.factions[actorId];
      if (!econ || econ.credits < 200 || econ.cargo.alloys < 12) return false;
      setFactions((prev) => ({
        ...prev,
        [actorId]: {
          ...prev[actorId],
          credits: prev[actorId].credits - 200,
          fleetSize: prev[actorId].fleetSize + 1,
          cargo: { ...prev[actorId].cargo, alloys: prev[actorId].cargo.alloys - 12 },
        },
      }));
      if (actorId === 'player') {
        soundEngine.playDash();
        showToast('Escort Frigate commissioned — joining orbital wing');
      } else {
        showToast(`${econ.corpName} launched a new 3D Escort Frigate`);
      }
      return true;
    },
    [showToast]
  );

  const executeMarketTrade = useCallback(
    (actorId: FactionId, commodity: CommodityId, side: 'BUY' | 'SELL', rawQty: number): { ok: boolean; label: string } => {
      const qty = Math.max(5, Math.min(30, Math.round(rawQty)));
      const item = stateRef.current.market.find((m) => m.id === commodity);
      const econ = stateRef.current.factions[actorId];
      if (!item || !econ) return { ok: false, label: commodity };

      const total = item.price * qty;
      if (side === 'BUY') {
        if (econ.credits < total) return { ok: false, label: item.name };
        setFactions((prev) => ({
          ...prev,
          [actorId]: {
            ...prev[actorId],
            credits: prev[actorId].credits - total,
            cargo: { ...prev[actorId].cargo, [commodity]: prev[actorId].cargo[commodity] + qty },
          },
        }));
      } else {
        if (econ.cargo[commodity] < qty) return { ok: false, label: item.name };
        setFactions((prev) => ({
          ...prev,
          [actorId]: {
            ...prev[actorId],
            credits: prev[actorId].credits + total,
            cargo: { ...prev[actorId].cargo, [commodity]: prev[actorId].cargo[commodity] - qty },
          },
        }));
      }

      // Dynamic EVE supply/demand price shift
      setMarket((prev) =>
        prev.map((m) => {
          if (m.id !== commodity) return m;
          const impact = side === 'BUY' ? 1 + qty * 0.0055 : 1 - qty * 0.0055;
          const nextPrice = Math.max(
            m.basePrice * 0.45,
            Math.min(m.basePrice * 2.4, Number((m.price * impact).toFixed(1)))
          );
          const nextSupply = Math.max(20, m.supply + (side === 'SELL' ? qty : -qty));
          return { ...m, prevPrice: m.price, price: nextPrice, supply: nextSupply };
        })
      );

      setTradeTape((prev) =>
        [
          {
            id: `tr_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            actorName: econ.name,
            actorColor: econ.colorHex,
            side,
            commodity,
            qty,
            unitPrice: item.price,
          },
          ...prev,
        ].slice(0, 24)
      );

      if (actorId === 'player') {
        soundEngine.playUiBlip();
        showToast(`${side === 'BUY' ? 'Bought' : 'Sold'} ${qty} ${item.symbol} @ ${item.price.toFixed(1)} ISK`);
      }
      return { ok: true, label: `${side} ${qty} ${item.symbol}` };
    },
    [showToast]
  );

  const executeResearchTech = useCallback(
    (actorId: FactionId, techId: TechId): { ok: boolean; label: string } => {
      const tech = TECH_TREE.find((t) => t.id === techId);
      const econ = stateRef.current.factions[actorId];
      if (!tech || !econ || econ.techs.includes(techId) || econ.science < tech.costScience) {
        return { ok: false, label: tech?.name || techId };
      }

      setFactions((prev) => ({
        ...prev,
        [actorId]: {
          ...prev[actorId],
          science: prev[actorId].science - tech.costScience,
          techs: [...prev[actorId].techs, techId],
          fleetSize: techId === 'warp_conduits' ? prev[actorId].fleetSize + 1 : prev[actorId].fleetSize,
        },
      }));

      if (actorId === 'player') {
        soundEngine.playDensityShift(5);
        showToast(`Researched ${tech.name}!`);
      } else {
        showToast(`${econ.corpName} unlocked ${tech.name}`);
      }
      return { ok: true, label: tech.name };
    },
    [showToast]
  );

  const executeDiplomacy = useCallback(
    (fromId: FactionId, toId: FactionId, stance: DiplomaticStance, message: string) => {
      if (fromId === toId) return;
      setDiplomacy((prev) => ({
        ...prev,
        [fromId]: { ...prev[fromId], [toId]: stance },
        [toId]: { ...prev[toId], [fromId]: stance },
      }));
      setDiplomacyFeed((prev) =>
        [
          {
            id: `dip_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            fromId,
            toId,
            stance,
            message,
          },
          ...prev,
        ].slice(0, 20)
      );
      const fromCorp = stateRef.current.factions[fromId]?.corpName || fromId;
      const toCorp = stateRef.current.factions[toId]?.corpName || toId;
      showToast(`${fromCorp} → ${toCorp}: ${stance.replace('_', ' ')}`);
    },
    [showToast]
  );

  const executeMineSector = useCallback((actorId: FactionId, sectorId: string): string => {
    const sec = stateRef.current.sectors.find((s) => s.id === sectorId) || stateRef.current.sectors[0];
    const econ = stateRef.current.factions[actorId];
    if (!sec || !econ) return 'Sector';
    const mult = econ.techs.includes('deep_core_extraction') ? 1.45 : 1.0;
    const amt = Math.round((sec.baseYieldResource + 6) * mult);
    const bonusIsk = Math.round(sec.baseYieldCredits * 0.8);
    setFactions((prev) => ({
      ...prev,
      [actorId]: {
        ...prev[actorId],
        credits: prev[actorId].credits + bonusIsk,
        cargo: {
          ...prev[actorId].cargo,
          [sec.specialty]: prev[actorId].cargo[sec.specialty] + amt,
        },
      },
    }));
    return `+${amt} ${sec.specialty.toUpperCase()} (${sec.name})`;
  }, []);

  const runAgentTurn = useCallback(
    async (agentId: string, directive?: string) => {
      if (inFlightAgentsRef.current.has(agentId)) return;
      const agent = stateRef.current.agents.find((a) => a.id === agentId);
      if (!agent) return;
      const fid = agentId as FactionId;

      inFlightAgentsRef.current.add(agentId);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agentId ? { ...a, status: 'thinking', errorMessage: undefined } : a
        )
      );

      try {
        const ctx = engineRef.current?.getAgentWorldContext(agentId);
        const curPlayer = stateRef.current.player;
        const econ = stateRef.current.factions[fid];
        const recentHistory = stateRef.current.agentLogs
          .filter((l) => l.agentId === agentId)
          .slice(0, 4)
          .map((l) => `${l.action} (${l.targetLabel}): ${l.thought}`);

        const empireContext = {
          economy: {
            credits: Math.round(econ.credits),
            science: Math.round(econ.science),
            fleetSize: econ.fleetSize,
            cargo: econ.cargo,
            techs: econ.techs,
          },
          sectors: stateRef.current.sectors.map((s) => ({
            id: s.id,
            name: s.name,
            ownerId: s.ownerId,
            securityRating: s.securityRating,
            specialty: s.specialty,
            structureCount: stateRef.current.structures.filter((st) => st.sectorId === s.id).length,
          })),
          market: stateRef.current.market.map((m) => ({
            id: m.id,
            name: m.name,
            price: m.price,
            prevPrice: m.prevPrice,
          })),
          diplomacy: stateRef.current.diplomacy[fid],
          availableTechs: TECH_TREE.filter((t) => !econ.techs.includes(t.id)).map((t) => ({
            id: t.id,
            name: t.name,
            costScience: t.costScience,
          })),
          recentDiplomacy: stateRef.current.diplomacyFeed
            .slice(0, 4)
            .map((d) => `${d.fromId}→${d.toId} (${d.stance}): ${d.message}`),
        };

        const res = await fetch('/api/agents/decide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent: {
              id: agent.id,
              name: agent.name,
              title: agent.title,
              corpName: agent.corpName,
              philosophy: agent.philosophy,
              density: agent.density,
              hp: agent.hp,
              maxHp: agent.maxHp,
              loveEnergy: agent.loveEnergy,
              sto: agent.sto,
              sts: agent.sts,
              locationId: agent.locationId,
              locationName: agent.locationName,
              currentAction: agent.currentAction,
            },
            playerState: {
              locationId: curPlayer.currentLocationId,
              locationName: curPlayer.currentLocationName,
              hp: Math.round(curPlayer.health),
              maxHp: curPlayer.maxHealth,
              density: curPlayer.currentDensity,
              distanceToAgent: ctx?.distToPlayer ?? 99,
            },
            nearbyEnemies: ctx?.nearbyEnemies ?? [],
            nearbyNpcs: ctx?.nearbyNpcs ?? [],
            nearbyObjects: ctx?.nearbyObjects ?? [],
            regions: LOCATIONS.map((l) => ({
              id: l.id,
              name: l.name,
              description: l.ambientHint,
            })),
            recentHistory,
            directive,
            empireContext,
          }),
        });

        const payload = (await res.json().catch(() => ({}))) as Partial<AgentDecisionResponse> & {
          error?: string;
        };

        if (!res.ok) {
          throw new Error(payload.error || `Server error (${res.status})`);
        }

        const decision: AgentDecisionResponse = {
          thought: payload.thought || 'Evaluating strategic opportunities across Digital Eden.',
          action: payload.action || 'MINE_RESOURCES',
          targetId: payload.targetId || agent.locationId,
          targetDensity:
            payload.targetDensity === 4 || payload.targetDensity === 5 ? payload.targetDensity : 3,
          say: payload.say || '',
          structureType: payload.structureType,
          commodity: payload.commodity,
          tradeSide: payload.tradeSide,
          tradeQty: payload.tradeQty,
          techId: payload.techId,
          diplomacyTarget: payload.diplomacyTarget,
          diplomacyStance: payload.diplomacyStance,
        };

        // Execute autonomous 4X / EVE strategic action
        let targetLabel =
          engineRef.current?.applyAgentDecision(
            agentId,
            decision.action,
            decision.targetId,
            decision.targetDensity
          ) || decision.targetId;

        let category: AgentLogEntry['category'] = 'TACTICAL';

        if (decision.action === 'CLAIM_SECTOR') {
          category = 'EMPIRE';
          const claimRes = executeClaimSector(fid, decision.targetId || agent.locationId);
          targetLabel = claimRes.ok ? `Claimed ${claimRes.label}` : `Moving to ${claimRes.label}`;
        } else if (decision.action === 'BUILD_STRUCTURE') {
          category = 'EMPIRE';
          const stType: StructureType = decision.structureType || 'mining_rig';
          const ownedSector =
            stateRef.current.sectors.find((s) => s.id === decision.targetId && s.ownerId === fid) ||
            stateRef.current.sectors.find((s) => s.ownerId === fid);
          if (ownedSector) {
            const buildRes = executeBuildStructure(fid, ownedSector.id, stType);
            targetLabel = buildRes.ok ? `Built ${buildRes.label}` : `Saving for ${buildRes.label}`;
          }
        } else if (decision.action === 'MINE_RESOURCES') {
          category = 'EMPIRE';
          targetLabel = executeMineSector(fid, decision.targetId || agent.locationId);
        } else if (decision.action === 'MARKET_TRADE') {
          category = 'MARKET';
          const comm: CommodityId = decision.commodity || 'ore';
          const side = decision.tradeSide || 'BUY';
          const qty = decision.tradeQty || 10;
          const trRes = executeMarketTrade(fid, comm, side, qty);
          targetLabel = trRes.ok ? trRes.label : `Watched ${comm.toUpperCase()} book`;
        } else if (decision.action === 'BUILD_FLEET') {
          category = 'EMPIRE';
          const ok = executeCommissionFrigate(fid);
          targetLabel = ok ? 'Escort Frigate Launched' : 'Gathering Alloys for Fleet';
        } else if (decision.action === 'RESEARCH_TECH') {
          category = 'EMPIRE';
          const fallbackTech = TECH_TREE.find(
            (t) => !econ.techs.includes(t.id) && econ.science >= t.costScience
          );
          const tid = decision.techId || fallbackTech?.id;
          if (tid) {
            const rRes = executeResearchTech(fid, tid);
            targetLabel = rRes.ok ? `Unlocked ${rRes.label}` : `Studying ${rRes.label}`;
          }
        } else if (decision.action === 'DIPLOMACY') {
          category = 'DIPLOMACY';
          const targetFac =
            decision.diplomacyTarget && decision.diplomacyTarget !== fid
              ? decision.diplomacyTarget
              : 'player';
          const stance = decision.diplomacyStance || 'TRADE_PACT';
          executeDiplomacy(fid, targetFac, stance, decision.say || decision.thought);
          targetLabel = `${stateRef.current.factions[targetFac].corpName} (${stance.replace('_', ' ')})`;
        } else if (decision.action === 'HEAL_ALLY') {
          setPlayer((p) => ({
            ...p,
            health: Math.min(p.maxHealth, p.health + 25),
            shield: Math.min(p.maxShield, p.shield + 20),
          }));
          showToast(`${agent.name} channeled Love Energy (+25 HP, +20 Shield)`);
        }

        setAgents((prev) =>
          prev.map((a) => {
            if (a.id !== agentId) return a;
            const stoGain =
              decision.action === 'HEAL_ALLY' ||
              (decision.action === 'DIPLOMACY' &&
                (decision.diplomacyStance === 'ALLIED' || decision.diplomacyStance === 'TRADE_PACT'))
                ? 7
                : decision.action === 'RESEARCH_TECH' || decision.action === 'MEDITATE'
                  ? 3
                  : a.philosophy === 'Service to Others'
                    ? 2
                    : 0;
            const stsGain =
              (decision.action === 'ENGAGE_ENEMY' || decision.action === 'BUILD_FLEET' || decision.action === 'CLAIM_SECTOR') &&
              a.philosophy === 'Service to Self'
                ? 6
                : decision.action === 'DIPLOMACY' &&
                    (decision.diplomacyStance === 'WAR' || decision.diplomacyStance === 'RIVAL')
                  ? 7
                  : 0;
            const loveDelta =
              decision.action === 'MEDITATE'
                ? 25
                : decision.action === 'HEAL_ALLY'
                  ? -20
                  : 4;

            return {
              ...a,
              currentAction: decision.action,
              targetId: decision.targetId,
              targetLabel,
              density:
                decision.action === 'SHIFT_DENSITY' ? decision.targetDensity : a.density,
              thought: decision.thought,
              lastSay: decision.say,
              sto: a.sto + stoGain,
              sts: a.sts + stsGain,
              loveEnergy: Math.max(0, Math.min(100, a.loveEnergy + loveDelta)),
              status: 'acting',
              errorMessage: undefined,
            };
          })
        );

        const logEntry: AgentLogEntry = {
          id: `${Date.now()}_${agentId}`,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          agentId: agent.id,
          agentName: agent.name,
          colorHex: agent.colorHex,
          action: decision.action,
          thought: decision.thought,
          say: decision.say,
          targetLabel,
          category,
        };

        setAgentLogs((prev) => [logEntry, ...prev].slice(0, 35));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to reach agent decision service.';
        setAgents((prev) =>
          prev.map((a) =>
            a.id === agentId ? { ...a, status: 'error', errorMessage: msg } : a
          )
        );
      } finally {
        inFlightAgentsRef.current.delete(agentId);
      }
    },
    [
      executeBuildStructure,
      executeClaimSector,
      executeCommissionFrigate,
      executeDiplomacy,
      executeMarketTrade,
      executeMineSector,
      executeResearchTech,
      showToast,
    ]
  );

  const handleToggleSpectate = useCallback(
    (agentId: string | null) => {
      const nextId = stateRef.current.spectateAgentId === agentId ? null : agentId;
      const nextMode: CameraMode = nextId ? 'spectate' : 'fps';
      setSpectateAgentId(nextId);
      setCameraMode(nextMode);
      engineRef.current?.setCameraMode(nextMode, nextId);
      if (nextId) {
        const ag = stateRef.current.agents.find((a) => a.id === nextId);
        if (ag) showToast(`Spectating ${ag.name} (${ag.corpName})`);
      } else {
        showToast('Returned to Guardian first-person view');
      }
    },
    [showToast]
  );

  const handleToggleOrbitalCam = useCallback(() => {
    const nextMode: CameraMode = stateRef.current.cameraMode === 'orbital' ? 'fps' : 'orbital';
    setCameraMode(nextMode);
    setSpectateAgentId(null);
    engineRef.current?.setCameraMode(nextMode, null);
    showToast(
      nextMode === 'orbital'
        ? 'Orbital 4X Command View — Drag or [A/D] to survey sectors & fleets'
        : 'Returned to Guardian first-person view'
    );
  }, [showToast]);

  const handleStepAllAgents = useCallback(() => {
    for (const ag of stateRef.current.agents) {
      void runAgentTurn(ag.id);
    }
  }, [runAgentTurn]);

  const handleSendDirective = useCallback(
    (targetAgentId: string | 'all', directive: string) => {
      if (targetAgentId === 'all') {
        for (const ag of stateRef.current.agents) {
          void runAgentTurn(ag.id, directive);
        }
        showToast('Broadcast sent to all sovereign faction leaders');
      } else {
        void runAgentTurn(targetAgentId, directive);
        const ag = stateRef.current.agents.find((a) => a.id === targetAgentId);
        showToast(`Broadcast sent to ${ag?.name || targetAgentId}`);
      }
    },
    [runAgentTurn, showToast]
  );

  // Sync engine phase whenever React phase changes
  useEffect(() => {
    engineRef.current?.setPhase(phase);
  }, [phase]);

  // Sync 3D Sovereignty Rings, Warp Lanes, Structures & EVE Escort Frigates
  useEffect(() => {
    if (!engineRef.current) return;
    const colors: Record<FactionId, number> = {
      player: factions.player.colorInt,
      lyra: factions.lyra.colorInt,
      kael: factions.kael.colorInt,
      soren: factions.soren.colorInt,
    };
    const fleets: Record<FactionId, number> = {
      player: factions.player.fleetSize,
      lyra: factions.lyra.fleetSize,
      kael: factions.kael.fleetSize,
      soren: factions.soren.fleetSize,
    };
    engineRef.current.syncEmpireVisuals(sectors, structures, colors, fleets);
  }, [sectors, structures, factions]);

  // Civilization + EVE Economic Yield Cycle (every 4 seconds while playing or viewing Empire)
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'empire') return;
    const id = window.setInterval(() => {
      const curSectors = stateRef.current.sectors;
      const curStructs = stateRef.current.structures;
      const curDip = stateRef.current.diplomacy;

      setCycleCount((c) => c + 1);
      setFactions((prev) => {
        const next = { ...prev };
        (['player', 'lyra', 'kael', 'soren'] as FactionId[]).forEach((fid) => {
          const f = prev[fid];
          const ownedSecs = curSectors.filter((s) => s.ownerId === fid);
          const ownedStructs = curStructs.filter((st) => st.ownerId === fid);

          let iskGain = 14;
          let sciGain = 4;
          const cargoAdd: Record<CommodityId, number> = { ore: 2, crystals: 0, isotopes: 0, alloys: 1 };

          for (const s of ownedSecs) {
            iskGain += s.baseYieldCredits;
            sciGain += s.baseYieldScience;
            cargoAdd[s.specialty] += s.baseYieldResource;
          }

          for (const st of ownedStructs) {
            if (st.type === 'citadel') {
              iskGain += f.techs.includes('sub_logos_citadel') ? 90 : 45;
              sciGain += 6;
            } else if (st.type === 'mining_rig') {
              const sec = curSectors.find((s) => s.id === st.sectorId);
              const spec = sec?.specialty || 'ore';
              cargoAdd[spec] += f.techs.includes('deep_core_extraction') ? 17 : 12;
              iskGain += 18;
            } else if (st.type === 'research_spire') {
              sciGain += 16;
            }
          }

          // Diplomacy Trade Pact & Alliance dividends
          const partners = (['player', 'lyra', 'kael', 'soren'] as FactionId[]).filter(
            (other) => other !== fid && (curDip[fid][other] === 'TRADE_PACT' || curDip[fid][other] === 'ALLIED')
          );
          const dipBonus = f.techs.includes('quantum_diplomacy') ? 22 : 10;
          iskGain += partners.length * dipBonus;
          sciGain += partners.length * (f.techs.includes('quantum_diplomacy') ? 8 : 3);

          if (f.techs.includes('orbital_logistics')) iskGain = Math.round(iskGain * 1.25);

          next[fid] = {
            ...f,
            credits: f.credits + iskGain,
            science: f.science + sciGain,
            cargo: {
              ore: f.cargo.ore + cargoAdd.ore,
              crystals: f.cargo.crystals + cargoAdd.crystals,
              isotopes: f.cargo.isotopes + cargoAdd.isotopes,
              alloys: f.cargo.alloys + cargoAdd.alloys,
            },
          };
        });
        return next;
      });

      // Gentle mean reversion on market prices
      setMarket((prev) =>
        prev.map((m) => {
          const drifted = m.price + (m.basePrice - m.price) * 0.04;
          return { ...m, price: Number(drifted.toFixed(1)) };
        })
      );
    }, 4000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Autonomous staggered Gemini agent decision loop while playing or managing empire
  useEffect(() => {
    if ((phase !== 'playing' && phase !== 'empire') || autonomySpeed === 'paused') return;
    const stepMs = autonomySpeed === 'fast' ? 2400 : 4800;

    const initialTimer = window.setTimeout(() => {
      const order = ['lyra', 'kael', 'soren'];
      const id = order[agentCursorRef.current % order.length];
      agentCursorRef.current += 1;
      void runAgentTurn(id);
    }, 1000);

    const intervalId = window.setInterval(() => {
      if (stateRef.current.phase !== 'playing' && stateRef.current.phase !== 'empire') return;
      const order = ['lyra', 'kael', 'soren'];
      const id = order[agentCursorRef.current % order.length];
      agentCursorRef.current += 1;
      void runAgentTurn(id);
    }, stepMs);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalId);
    };
  }, [phase, autonomySpeed, runAgentTurn]);

  // Global keyboard shortcut for Dock [H]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement | null)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') return;
      if (e.code === 'KeyH' && stateRef.current.phase === 'playing') {
        setDockCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Passive Shield & Astral Energy regeneration while playing
  useEffect(() => {
    const id = window.setInterval(() => {
      if (stateRef.current.phase !== 'playing') return;
      setPlayer((prev) => ({
        ...prev,
        shield: Math.min(prev.maxShield, prev.shield + 2.2),
        astralEnergy: Math.min(prev.maxAstralEnergy, prev.astralEnergy + 2.5),
        superCharge: Math.min(100, prev.superCharge + 1.2),
      }));
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  // Initialize Three.js Engine ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new GameEngine(container, {
      onPlayerDamaged: (amount) => {
        setPlayer((prev) => {
          const reduced = Math.max(2, amount - Math.floor(prev.defense * 0.4));
          let shield = prev.shield;
          let health = prev.health;
          if (shield > 0) {
            const absorbed = Math.min(shield, reduced);
            shield -= absorbed;
            health -= reduced - absorbed;
          } else {
            health -= reduced;
          }
          if (health <= 0) {
            health = 0;
            window.setTimeout(() => setPhase('gameover'), 50);
          }
          return { ...prev, shield, health };
        });
      },
      onEnemyHit: (_dmg, _isCrit, defeated, enemyName, _arch, xp, love) => {
        setHitmarkerActive(true);
        if (hitmarkerTimerRef.current) window.clearTimeout(hitmarkerTimerRef.current);
        hitmarkerTimerRef.current = window.setTimeout(() => setHitmarkerActive(false), 120);

        if (defeated) {
          setPlayer((prev) => {
            let newXp = prev.experience + xp;
            let level = prev.level;
            let xpToNext = prev.xpToNext;
            let maxHealth = prev.maxHealth;
            let attack = prev.attack;
            let defense = prev.defense;
            while (newXp >= xpToNext) {
              newXp -= xpToNext;
              level += 1;
              xpToNext = Math.round(xpToNext * 1.35);
              maxHealth += 15;
              attack += 3;
              defense += 2;
            }
            return {
              ...prev,
              level,
              experience: newXp,
              xpToNext,
              maxHealth,
              health: level > prev.level ? maxHealth : prev.health,
              attack,
              defense,
              loveEnergy: Math.min(prev.maxLoveEnergy, prev.loveEnergy + love),
              superCharge: Math.min(100, prev.superCharge + 18),
              enemiesDefeated: prev.enemiesDefeated + 1,
              harvestScore: prev.harvestScore + 15,
            };
          });
          // EVE Online combat bounty & salvage directly funds player corporation
          setFactions((prev) => ({
            ...prev,
            player: {
              ...prev.player,
              credits: prev.player.credits + 45,
              cargo: {
                ...prev.player.cargo,
                ore: prev.player.cargo.ore + 4,
                alloys: prev.player.cargo.alloys + 3,
              },
            },
          }));
          progressQuestObjective(QuestObjectiveType.DEFEAT_ENEMY, enemyName, 1);
        } else {
          setPlayer((prev) => ({
            ...prev,
            superCharge: Math.min(100, prev.superCharge + 4),
          }));
        }
      },
      onLocationChanged: (locationId, locationName) => {
        setPlayer((prev) => ({
          ...prev,
          currentLocationId: locationId,
          currentLocationName: locationName,
        }));
        progressQuestObjective(QuestObjectiveType.LOCATION, locationId, 1);
        const loc = LOCATIONS.find((l) => l.id === locationId);
        if (loc) showToast(`${locationName} — ${loc.ambientHint}`);
      },
      onInteractTargetChanged: (target) => setInteractTarget(target),
      onInteract: (target) => handleInteract(target),
      onActionKey: (action) => {
        const curPhase = stateRef.current.phase;
        if (action === 'pause') {
          if (curPhase === 'playing') setPhase('paused');
          else if (curPhase === 'paused' || curPhase === 'codex' || curPhase === 'dialogue' || curPhase === 'empire') {
            setActiveDialogue(null);
            setPhase('playing');
          }
        } else if (action === 'codex') {
          if (curPhase === 'playing') setPhase('codex');
          else if (curPhase === 'codex') setPhase('playing');
        } else if (action === 'empire') {
          if (curPhase === 'playing') setPhase('empire');
          else if (curPhase === 'empire') setPhase('playing');
        } else if (action === 'orbitalCam') {
          if (curPhase === 'playing') handleToggleOrbitalCam();
        } else if (action === 'heal') {
          handleLoveHeal();
        } else if (action === 'super') {
          handleSuperNova();
        } else if (action === 'density3') {
          handleDensityShift(3);
        } else if (action === 'density4') {
          handleDensityShift(4);
        } else if (action === 'density5') {
          handleDensityShift(5);
        } else if (action === 'cycleWeapon') {
          handleCycleWeapon();
        } else if (action === 'agents') {
          if (curPhase === 'playing') setAgentsPanelOpen((v) => !v);
        } else if (action === 'spectateCycle') {
          if (curPhase === 'playing') {
            const ids = stateRef.current.agents.map((a) => a.id);
            const cur = stateRef.current.spectateAgentId;
            const idx = cur ? ids.indexOf(cur) : -1;
            const nextId = idx === -1 ? ids[0] : idx + 1 < ids.length ? ids[idx + 1] : null;
            const nextMode: CameraMode = nextId ? 'spectate' : 'fps';
            setSpectateAgentId(nextId);
            setCameraMode(nextMode);
            engineRef.current?.setCameraMode(nextMode, nextId);
            if (nextId) {
              const ag = stateRef.current.agents.find((a) => a.id === nextId);
              if (ag) showToast(`Spectating ${ag.name} (${ag.corpName})`);
            } else {
              showToast('Returned to Guardian first-person view');
            }
          }
        }
      },
      onFloatingDamage: (items) => setFloatingDamages(items),
      onPlayerPosition: (pos, yaw) => setPlayerTransform({ pos, yaw }),
      onPointerLockChange: (locked) => setPointerLocked(locked),
      onDashUsed: () => {
        if (stateRef.current.player.astralEnergy < 12) return false;
        setPlayer((prev) => ({ ...prev, astralEnergy: Math.max(0, prev.astralEnergy - 12) }));
        return true;
      },
      onAgentsSync: (synced) => {
        setAgents((prev) =>
          prev.map((a) => {
            const s = synced.find((item) => item.id === a.id);
            return s
              ? {
                  ...a,
                  position: s.position,
                  locationId: s.locationId,
                  locationName: s.locationName,
                }
              : a;
          })
        );
      },
    });

    engineRef.current = engine;
    const initFactions = stateRef.current.factions;
    engine.syncEmpireVisuals(
      stateRef.current.sectors,
      stateRef.current.structures,
      {
        player: initFactions.player.colorInt,
        lyra: initFactions.lyra.colorInt,
        kael: initFactions.kael.colorInt,
        soren: initFactions.soren.colorInt,
      },
      {
        player: initFactions.player.fleetSize,
        lyra: initFactions.lyra.fleetSize,
        kael: initFactions.kael.fleetSize,
        soren: initFactions.soren.fleetSize,
      }
    );
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [
    handleCycleWeapon,
    handleDensityShift,
    handleInteract,
    handleLoveHeal,
    handleSuperNova,
    handleToggleOrbitalCam,
    progressQuestObjective,
    showToast,
  ]);

  const handleSelectDialogueChoice = (choice: DialogueChoice) => {
    soundEngine.playUiBlip();
    if (choice.serviceEffect) {
      const { type, amount, polarity } = choice.serviceEffect;
      setPlayer((prev) => ({
        ...prev,
        serviceToOthers:
          polarity === 'STO'
            ? prev.serviceToOthers + amount
            : polarity === 'BALANCED'
              ? prev.serviceToOthers + Math.round(amount * 0.5)
              : prev.serviceToOthers,
        serviceToSelf:
          polarity === 'STS'
            ? prev.serviceToSelf + amount
            : polarity === 'BALANCED'
              ? prev.serviceToSelf + Math.round(amount * 0.5)
              : prev.serviceToSelf,
        loveEnergy:
          polarity === 'STO'
            ? Math.min(prev.maxLoveEnergy, prev.loveEnergy + 20)
            : prev.loveEnergy,
        harvestScore: prev.harvestScore + Math.round(amount * 0.8),
        serviceLevels: {
          ...prev.serviceLevels,
          [type]: (prev.serviceLevels[type] || 50) + amount,
        },
      }));
    }

    if (choice.unlockLoreId) {
      setLore((prev) =>
        prev.map((l) => (l.id === choice.unlockLoreId ? { ...l, discovered: true } : l))
      );
      showToast('New Law of One Lore Unlocked!');
    }

    if (choice.worldFlag) {
      setWorldFlags((prev) => ({ ...prev, [choice.worldFlag!.key]: choice.worldFlag!.value }));
    }

    if (choice.rewardItemId) {
      grantItem(choice.rewardItemId);
    }

    if (choice.nextNodeId === null) {
      setActiveDialogue(null);
      setPhase('playing');
    } else if (activeDialogue) {
      setActiveDialogue({ ...activeDialogue, nodeId: choice.nextNodeId });
    }
  };

  const handleMeditate = (focus: MeditationFocus) => {
    soundEngine.playDensityShift(4);
    const bonus = 25;
    setPlayer((prev) => {
      if (focus === MeditationFocus.SERVICE_TO_OTHERS_FOCUS) {
        return {
          ...prev,
          serviceToOthers: prev.serviceToOthers + bonus,
          loveEnergy: Math.min(prev.maxLoveEnergy, prev.loveEnergy + 35),
          astralEnergy: prev.maxAstralEnergy,
          harvestScore: prev.harvestScore + 20,
        };
      }
      if (focus === MeditationFocus.SERVICE_TO_SELF_FOCUS) {
        return {
          ...prev,
          serviceToSelf: prev.serviceToSelf + bonus,
          attack: prev.attack + 1,
          astralEnergy: prev.maxAstralEnergy,
          harvestScore: prev.harvestScore + 15,
        };
      }
      return {
        ...prev,
        serviceToOthers: prev.serviceToOthers + 12,
        serviceToSelf: prev.serviceToSelf + 12,
        shield: prev.maxShield,
        astralEnergy: prev.maxAstralEnergy,
        harvestScore: prev.harvestScore + 20,
      };
    });
    showToast('Meditation complete — Astral Energy restored.');
  };

  const handleUseItem = (itemId: string) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;
    soundEngine.playLoveHeal();
    setPlayer((prev) => ({
      ...prev,
      health: Math.min(prev.maxHealth, prev.health + (item.healthRestore || 0)),
      loveEnergy: Math.min(prev.maxLoveEnergy, prev.loveEnergy + (item.loveRestore || 0)),
      astralEnergy: Math.min(prev.maxAstralEnergy, prev.astralEnergy + (item.energyRestore || 0)),
    }));
    setInventory((prev) =>
      prev
        .map((i) => (i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
    showToast(`Used ${item.name}`);
  };

  const handleEquipItem = (itemId: string) => {
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;
    const equipping = !item.equipped;
    setInventory((prev) => prev.map((i) => (i.id === itemId ? { ...i, equipped: equipping } : i)));
    setPlayer((prev) => ({
      ...prev,
      attack: prev.attack + (equipping ? item.attackBonus : -item.attackBonus),
      defense: prev.defense + (equipping ? item.defenseBonus : -item.defenseBonus),
    }));
    soundEngine.playUiBlip();
    showToast(`${equipping ? 'Equipped' : 'Unequipped'} ${item.name}`);
  };

  const handleReflectLore = (loreId: string) => {
    soundEngine.playDensityShift(5);
    setLore((prev) => prev.map((l) => (l.id === loreId ? { ...l, reflected: true } : l)));
    setPlayer((prev) => ({
      ...prev,
      harvestScore: prev.harvestScore + 35,
      astralEnergy: prev.maxAstralEnergy,
    }));
    showToast('Reflected on Law of One teaching (+35 Harvest)');
  };

  const handleSaveGame = () => {
    const data: SaveState = {
      version: 1,
      savedAt: new Date().toISOString(),
      player,
      inventory,
      quests,
      lore,
      journal,
      worldFlags,
      collectedObjectIds: collectedIds,
      examinedObjectIds: examinedIds,
      playerPosition: playerTransform.pos,
      playerYaw: playerTransform.yaw,
    };
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
    setHasSave(true);
    soundEngine.playUiBlip();
    showToast('Consciousness State Saved');
  };

  const handleLoadGame = () => {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return;
    try {
      const data: SaveState = JSON.parse(raw);
      setPlayer(data.player);
      setInventory(data.inventory);
      setQuests(data.quests);
      setLore(data.lore);
      setJournal(data.journal);
      setWorldFlags(data.worldFlags || {});
      setCollectedIds(data.collectedObjectIds || []);
      setExaminedIds(data.examinedObjectIds || []);
      engineRef.current?.setDensity(data.player.currentDensity);
      engineRef.current?.setEquippedWeapon(data.player.equippedWeaponId);
      engineRef.current?.setPlayerTransform(data.playerPosition, data.playerYaw);
      for (const id of data.collectedObjectIds || []) {
        engineRef.current?.markObjectCollected(id);
      }
      setPhase('playing');
      showToast('Saved Progress Restored');
    } catch {
      showToast('Could not parse saved data');
    }
  };

  const handleStartNew = () => {
    const freshPlayer = createInitialPlayerStats();
    setPlayer(freshPlayer);
    setInventory(createInitialInventory());
    setQuests(structuredClone(INITIAL_QUESTS));
    setLore(structuredClone(INITIAL_LORE));
    setWorldFlags({});
    setCollectedIds([]);
    setExaminedIds([]);
    setVictoryShown(false);
    setAgents(createInitialAgents());
    setAgentLogs([]);
    setCycleCount(1);
    setSectors(createInitialSectors());
    setStructures(createInitialStructures());
    setFactions(createInitialFactions());
    setMarket(createInitialMarket());
    setTradeTape([]);
    setDiplomacy(createInitialDiplomacy());
    setDiplomacyFeed([]);
    setCameraMode('fps');
    setSpectateAgentId(null);
    engineRef.current?.setCameraMode('fps', null);
    engineRef.current?.setDensity(3);
    engineRef.current?.setEquippedWeapon('lumen_pulse');
    engineRef.current?.setPlayerTransform([0, 0, 14], 0);
    soundEngine.playDensityShift(3);
    setPhase('playing');
  };

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Isolated WebGL Canvas Mount (never unmounted on React state changes) */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {phase === 'title' && (
        <TitleScreen
          hasSave={hasSave}
          muted={muted}
          onStartNew={handleStartNew}
          onResumeSave={handleLoadGame}
          onToggleMute={handleToggleMute}
        />
      )}

      {phase !== 'title' && (
        <GameHUD
          player={player}
          quests={quests}
          interactTarget={interactTarget}
          floatingDamages={floatingDamages}
          hitmarkerActive={hitmarkerActive}
          pointerLocked={pointerLocked}
          dockCollapsed={dockCollapsed}
          muted={muted}
          toastMessage={toastMessage}
          agentsOpen={agentsPanelOpen}
          autonomySpeed={autonomySpeed}
          cameraMode={cameraMode}
          spectateAgentName={
            spectateAgentId ? agents.find((a) => a.id === spectateAgentId)?.name || null : null
          }
          playerEconomy={factions.player}
          playerSectorCount={sectors.filter((s) => s.ownerId === 'player').length}
          onToggleDock={() => setDockCollapsed((c) => !c)}
          onToggleMute={handleToggleMute}
          onDensityShift={handleDensityShift}
          onSelectWeapon={handleSelectWeapon}
          onHeal={handleLoveHeal}
          onSuper={handleSuperNova}
          onOpenCodex={() => setPhase('codex')}
          onOpenEmpire={() => setPhase('empire')}
          onFastTravel={(locId) => {
            engineRef.current?.teleportToLocation(locId);
            soundEngine.playDash();
          }}
          onToggleAgents={() => setAgentsPanelOpen((v) => !v)}
          onToggleOrbitalCam={handleToggleOrbitalCam}
          onExitSpectate={() => handleToggleSpectate(null)}
        />
      )}

      {phase === 'playing' && agentsPanelOpen && (
        <AgentPanel
          agents={agents}
          factions={factions}
          sectors={sectors}
          diplomacy={diplomacy}
          logs={agentLogs}
          autonomySpeed={autonomySpeed}
          spectateAgentId={spectateAgentId}
          onSetAutonomySpeed={setAutonomySpeed}
          onStepAgent={(id) => void runAgentTurn(id)}
          onStepAllAgents={handleStepAllAgents}
          onSendDirective={handleSendDirective}
          onToggleSpectate={(id) => handleToggleSpectate(id)}
          onClose={() => setAgentsPanelOpen(false)}
        />
      )}

      {phase === 'empire' && (
        <EmpireModal
          cycleCount={cycleCount}
          sectors={sectors}
          structures={structures}
          factions={factions}
          market={market}
          tradeTape={tradeTape}
          diplomacy={diplomacy}
          diplomacyFeed={diplomacyFeed}
          onClose={() => setPhase('playing')}
          onClaimSector={(secId) => executeClaimSector('player', secId)}
          onBuildStructure={(secId, type) => executeBuildStructure('player', secId, type)}
          onCommissionFrigate={() => executeCommissionFrigate('player')}
          onMarketTrade={(comm, side, qty) => executeMarketTrade('player', comm, side, qty)}
          onResearchTech={(tid) => executeResearchTech('player', tid)}
          onSetDiplomacy={(targetId, stance) =>
            executeDiplomacy(
              'player',
              targetId,
              stance,
              `Vanguard Collective declared ${stance.replace('_', ' ').toLowerCase()} with ${factions[targetId].corpName}.`
            )
          }
          onWarpToSector={(secId) => {
            engineRef.current?.teleportToLocation(secId);
            soundEngine.playDash();
          }}
          onOpenOrbitalView={() => {
            setCameraMode('orbital');
            setSpectateAgentId(null);
            engineRef.current?.setCameraMode('orbital', null);
          }}
        />
      )}

      {phase === 'dialogue' && activeDialogue && (
        <DialogueModal
          npc={activeDialogue.npc}
          currentNodeId={activeDialogue.nodeId}
          currentDensity={player.currentDensity}
          onSelectChoice={handleSelectDialogueChoice}
          onClose={() => {
            setActiveDialogue(null);
            setPhase('playing');
          }}
        />
      )}

      {phase === 'codex' && (
        <CodexModal
          player={player}
          inventory={inventory}
          quests={quests}
          lore={lore}
          journal={journal}
          hasSave={hasSave}
          onClose={() => setPhase('playing')}
          onMeditate={handleMeditate}
          onDensityShift={handleDensityShift}
          onUseItem={handleUseItem}
          onEquipItem={handleEquipItem}
          onSelectWeapon={handleSelectWeapon}
          onReflectLore={handleReflectLore}
          onSaveGame={handleSaveGame}
          onLoadGame={handleLoadGame}
          onFastTravel={(locId) => {
            engineRef.current?.teleportToLocation(locId);
            soundEngine.playDash();
          }}
        />
      )}

      {(phase === 'paused' || phase === 'victory' || phase === 'gameover') && (
        <PauseModal
          phase={phase}
          player={player}
          onResume={() => setPhase('playing')}
          onSave={handleSaveGame}
          onRestart={handleStartNew}
        />
      )}
    </div>
  );
}
