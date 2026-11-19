import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  Eye,
  EyeOff,
  FastForward,
  Pause,
  Play,
  Send,
  StepForward,
  X,
} from 'lucide-react';
import {
  AgentLogEntry,
  AgentState,
  DiplomaticStance,
  FactionEconomy,
  FactionId,
  SectorState,
} from '../types/game';

interface AgentPanelProps {
  agents: AgentState[];
  factions: Record<FactionId, FactionEconomy>;
  sectors: SectorState[];
  diplomacy: Record<FactionId, Record<FactionId, DiplomaticStance>>;
  logs: AgentLogEntry[];
  autonomySpeed: 'paused' | 'normal' | 'fast';
  spectateAgentId: string | null;
  onSetAutonomySpeed: (speed: 'paused' | 'normal' | 'fast') => void;
  onStepAgent: (agentId: string) => void;
  onStepAllAgents: () => void;
  onSendDirective: (targetAgentId: string | 'all', directive: string) => void;
  onToggleSpectate: (agentId: string) => void;
  onClose: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  MOVE_TO_REGION: 'Travelling',
  ENGAGE_ENEMY: 'Engaging Threat',
  HEAL_ALLY: 'Healing Guardian',
  MEDITATE: 'Meditating',
  SHIFT_DENSITY: 'Shifting Density',
  INSPECT_OBJECT: 'Examining Relic',
  SPEAK_TO_NPC: 'Conversing',
  PATROL: 'Patrolling',
  CLAIM_SECTOR: 'Claiming Sector',
  BUILD_STRUCTURE: 'Constructing',
  MINE_RESOURCES: 'Mining Sector',
  MARKET_TRADE: 'Market Order',
  BUILD_FLEET: 'Commissioning Fleet',
  RESEARCH_TECH: 'Researching Tech',
  DIPLOMACY: 'Diplomacy',
};

const STANCE_TEXT: Record<DiplomaticStance, string> = {
  ALLIED: 'Allied',
  TRADE_PACT: 'Trade Pact',
  NEUTRAL: 'Neutral',
  RIVAL: 'Rival',
  WAR: 'At War',
};

export const AgentPanel: React.FC<AgentPanelProps> = ({
  agents,
  factions,
  sectors,
  diplomacy,
  logs,
  autonomySpeed,
  spectateAgentId,
  onSetAutonomySpeed,
  onStepAgent,
  onStepAllAgents,
  onSendDirective,
  onToggleSpectate,
  onClose,
}) => {
  const [directiveText, setDirectiveText] = useState('');
  const [directiveTarget, setDirectiveTarget] = useState<string>('all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = directiveText.trim();
    if (!trimmed) return;
    onSendDirective(directiveTarget, trimmed);
    setDirectiveText('');
  };

  return (
    <div className="fixed top-16 right-4 bottom-20 z-20 w-[412px] max-w-[94vw] bg-slate-950/95 border border-slate-700/90 rounded-lg shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-900/90">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-4 h-4 text-sky-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-slate-100 truncate">
              Autonomous Sovereign Agents
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              Live 4X Empires · Market · 3D Combat
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label="Close Agents Panel"
          className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-100 cursor-pointer border border-slate-800 shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Autonomy Speed & Global Step Controls */}
      <div className="px-3 py-2 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => onSetAutonomySpeed('paused')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
              autonomySpeed === 'paused'
                ? 'bg-slate-700 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Pause className="w-3 h-3" />
            <span>Pause</span>
          </button>
          <button
            onClick={() => onSetAutonomySpeed('normal')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
              autonomySpeed === 'normal'
                ? 'bg-emerald-600 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3 h-3" />
            <span>Auto</span>
          </button>
          <button
            onClick={() => onSetAutonomySpeed('fast')}
            className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap ${
              autonomySpeed === 'fast'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FastForward className="w-3 h-3" />
            <span>Fast</span>
          </button>
        </div>

        <button
          onClick={onStepAllAgents}
          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-sky-300 cursor-pointer whitespace-nowrap"
        >
          Run All Turn
        </button>
      </div>

      {/* Catalyst / Diplomatic Broadcast Input */}
      <form onSubmit={handleSubmit} className="p-2.5 border-b border-slate-800/90 bg-slate-900/40 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-semibold text-slate-200">Broadcast Directive</span>
          <select
            aria-label="Directive Target"
            value={directiveTarget}
            onChange={(e) => setDirectiveTarget(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[11px] text-slate-200 cursor-pointer"
          >
            <option value="all">All Factions</option>
            {agents.map((ag) => (
              <option key={ag.id} value={ag.id}>
                {ag.name} ({ag.corpName})
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={directiveText}
            onChange={(e) => setDirectiveText(e.target.value)}
            placeholder="e.g. Claim Hidden Grove, buy Alloys, or form an alliance..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={!directiveText.trim()}
            className="px-2.5 py-1.5 rounded bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <Send className="w-3 h-3" />
            <span>Send</span>
          </button>
        </div>
      </form>

      {/* Scrollable Body: Agent Empire Cards + Live Activity Stream */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        <div className="space-y-2">
          {agents.map((ag) => {
            const fid = ag.id as FactionId;
            const econ = factions[fid];
            const ownedCount = sectors.filter((s) => s.ownerId === fid).length;
            const stance = diplomacy.player[fid];
            const isSpectating = spectateAgentId === ag.id;
            const isThinking = ag.status === 'thinking';

            return (
              <div
                key={ag.id}
                className="bg-slate-900/90 border border-slate-800 rounded-md p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold flex items-center gap-1.5 truncate">
                      <span style={{ color: ag.colorHex }}>{ag.name}</span>
                      <span className="text-slate-500 font-normal" aria-hidden="true">·</span>
                      <span className="text-slate-200 font-semibold truncate">{ag.corpName}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {ag.philosophy} · {STANCE_TEXT[stance]} · {ag.locationName} ({ag.density}D)
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-mono shrink-0 ${
                      ag.status === 'error'
                        ? 'text-red-400 font-semibold'
                        : isThinking
                          ? 'text-sky-300 font-semibold'
                          : 'text-slate-300'
                    }`}
                  >
                    {isThinking
                      ? 'Thinking...'
                      : ag.status === 'error'
                        ? 'Error'
                        : ACTION_LABELS[ag.currentAction] || ag.currentAction}
                  </span>
                </div>

                {/* Empire Resource Strip (Clean unboxed tabular metadata) */}
                {econ && (
                  <div className="text-[11px] font-mono tabular-nums text-slate-300 flex items-center justify-between gap-2 pt-1.5 border-t border-slate-800/80">
                    <span className="text-amber-300">{Math.round(econ.credits).toLocaleString()} ISK</span>
                    <span className="text-slate-600">·</span>
                    <span>{ownedCount} Sec</span>
                    <span className="text-slate-600">·</span>
                    <span>{econ.fleetSize} Ships</span>
                    <span className="text-slate-600">·</span>
                    <span className="text-sky-300">{econ.techs.length} Tech</span>
                  </div>
                )}

                {/* Thought & Transmission */}
                <div className="text-[11px] text-slate-300 leading-snug bg-slate-950/75 rounded px-2.5 py-2 border border-slate-800/80 space-y-1">
                  <div className="text-slate-300">{ag.thought}</div>
                  {ag.lastSay && (
                    <div className="italic" style={{ color: ag.colorHex }}>
                      &ldquo;{ag.lastSay}&rdquo;
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-900 font-mono tabular-nums">
                    <span className="truncate">Target: {ag.targetLabel || 'Sector'}</span>
                    <span className="shrink-0 ml-2">STO {ag.sto} / STS {ag.sts}</span>
                  </div>
                </div>

                {/* Explicit API Error */}
                {ag.status === 'error' && ag.errorMessage && (
                  <div className="flex items-start gap-1.5 text-[11px] text-red-300 bg-red-950/60 border border-red-700/60 rounded px-2.5 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="break-words">{ag.errorMessage}</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onToggleSpectate(ag.id)}
                    className={`flex-1 px-2.5 py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer border transition-colors whitespace-nowrap ${
                      isSpectating
                        ? 'bg-amber-500 border-amber-400 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                    }`}
                  >
                    {isSpectating ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{isSpectating ? 'Exit Watch' : 'Watch 3D'}</span>
                  </button>

                  <button
                    onClick={() => onStepAgent(ag.id)}
                    disabled={isThinking}
                    className="px-3 py-1.5 rounded text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sky-300 border border-slate-700 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <StepForward className="w-3 h-3" />
                    <span>Step</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Decision Stream */}
        <div className="pt-2 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 mb-2">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Autonomous Empire Feed</span>
          </div>

          {logs.length === 0 ? (
            <div className="text-[11px] text-slate-500 bg-slate-900/50 border border-slate-800/80 rounded p-3 text-center">
              Autonomous commanders are initializing. Click Run All Turn or wait for the next cycle.
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-slate-900/75 border border-slate-800/80 rounded px-2.5 py-2 text-[11px] space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate" style={{ color: entry.colorHex }}>
                      {entry.agentName} · {ACTION_LABELS[entry.action] || entry.action}
                    </span>
                    <span className="text-[10px] font-mono tabular-nums text-slate-500 shrink-0">
                      {entry.timestamp}
                    </span>
                  </div>
                  <div className="text-slate-300 leading-snug">{entry.thought}</div>
                  {entry.say && (
                    <div className="text-slate-400 italic text-[10px]">&ldquo;{entry.say}&rdquo;</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
