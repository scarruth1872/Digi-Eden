import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Compass,
  Heart,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  BookOpen,
  Zap,
  Bot,
  Eye,
  Globe,
  Landmark,
} from 'lucide-react';
import {
  CameraMode,
  DensityLevel,
  FactionEconomy,
  FloatingDamage,
  InteractionTarget,
  PlayerStats,
  Quest,
} from '../types/game';
import { LOCATIONS, WEAPONS } from '../data/worldData';

interface GameHUDProps {
  player: PlayerStats;
  quests: Quest[];
  interactTarget: InteractionTarget | null;
  floatingDamages: FloatingDamage[];
  hitmarkerActive: boolean;
  pointerLocked: boolean;
  dockCollapsed: boolean;
  muted: boolean;
  toastMessage: string | null;
  agentsOpen: boolean;
  autonomySpeed: 'paused' | 'normal' | 'fast';
  cameraMode: CameraMode;
  spectateAgentName: string | null;
  playerEconomy: FactionEconomy;
  playerSectorCount: number;
  onToggleDock: () => void;
  onToggleMute: () => void;
  onDensityShift: (d: DensityLevel) => void;
  onSelectWeapon: (id: string) => void;
  onHeal: () => void;
  onSuper: () => void;
  onOpenCodex: () => void;
  onOpenEmpire: () => void;
  onFastTravel: (locId: string) => void;
  onToggleAgents: () => void;
  onToggleOrbitalCam: () => void;
  onExitSpectate: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  player,
  quests,
  interactTarget,
  floatingDamages,
  hitmarkerActive,
  pointerLocked,
  dockCollapsed,
  muted,
  toastMessage,
  agentsOpen,
  autonomySpeed,
  cameraMode,
  spectateAgentName,
  playerEconomy,
  playerSectorCount,
  onToggleDock,
  onToggleMute,
  onDensityShift,
  onSelectWeapon,
  onHeal,
  onSuper,
  onOpenCodex,
  onOpenEmpire,
  onFastTravel,
  onToggleAgents,
  onToggleOrbitalCam,
  onExitSpectate,
}) => {
  const activeQuest = quests.find((q) => !q.completed && q.active);
  const currentStage = activeQuest?.stages.find((s) => s.stageNumber === activeQuest.currentStage);
  const totalService = player.serviceToOthers + player.serviceToSelf;
  const stoPercent = totalService > 0 ? Math.round((player.serviceToOthers / totalService) * 100) : 50;
  const weapon = WEAPONS[player.equippedWeaponId] || WEAPONS.lumen_pulse;

  const densityColor =
    player.currentDensity === 3
      ? 'text-sky-300 border-sky-500/60'
      : player.currentDensity === 4
        ? 'text-purple-300 border-purple-500/60'
        : 'text-amber-300 border-amber-500/60';

  const densityName =
    player.currentDensity === 3
      ? '3rd Density · Choice'
      : player.currentDensity === 4
        ? '4th Density · Empathy'
        : '5th Density · Wisdom';

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Top-Left Guardian Status Cluster */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 w-72">
        <div className="bg-slate-950/88 border border-slate-700/80 rounded px-3.5 py-2.5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-bold tracking-wider text-slate-100 uppercase">
              LVL <span className="tabular-nums text-amber-300">{player.level}</span> · {player.name}
            </span>
            <span className={`font-semibold px-1.5 py-0.5 rounded border text-[11px] ${densityColor}`}>
              {densityName}
            </span>
          </div>

          {/* Shield Bar */}
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <div className="flex-1 h-2 bg-slate-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-sky-400 transition-all duration-150"
                style={{ width: `${Math.max(0, (player.shield / player.maxShield) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono tabular-nums text-sky-200 w-9 text-right">
              {Math.round(player.shield)}
            </span>
          </div>

          {/* Health Bar */}
          <div className="flex items-center gap-2 mb-1.5">
            <Heart className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="flex-1 h-2.5 bg-slate-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-150"
                style={{ width: `${Math.max(0, (player.health / player.maxHealth) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] font-mono tabular-nums text-emerald-200 w-9 text-right">
              {Math.round(player.health)}
            </span>
          </div>

          {/* Love Energy & Super Charge */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/90 text-[11px]">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-rose-400" />
              <span className="text-slate-400">LOVE</span>
              <span className="font-mono tabular-nums text-rose-300 ml-auto">
                {Math.round(player.loveEnergy)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              <span className="text-slate-400">NOVA</span>
              <span className="font-mono tabular-nums text-amber-300 ml-auto">
                {Math.round(player.superCharge)}%
              </span>
            </div>
          </div>
        </div>

        {/* Polarity & Harvest Mini Readout */}
        <div className="bg-slate-950/88 border border-slate-800/90 rounded px-3 py-1.5 flex items-center justify-between text-[11px]">
          <span className="text-slate-400">Polarity</span>
          <div className="flex items-center gap-2 font-mono tabular-nums">
            <span className="text-emerald-300">STO {stoPercent}%</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-300">Harvest {player.harvestScore}</span>
          </div>
        </div>

        {/* Empire & EVE Economy Strip */}
        <div className="bg-slate-950/88 border border-slate-800/90 rounded px-3 py-1.5 flex items-center justify-between text-[11px] font-mono tabular-nums">
          <span className="text-amber-300 font-semibold">
            {Math.round(playerEconomy.credits).toLocaleString()} ISK
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-sky-300">{Math.round(playerEconomy.science)} Sci</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-200">{playerSectorCount} Sec</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-200">{playerEconomy.fleetSize} Ships</span>
        </div>
      </div>

      {/* Top-Right Location & Active Quest Tracker */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 max-w-xs">
        <div className="bg-slate-950/88 border border-slate-700/80 rounded px-3.5 py-2 text-right">
          <div className="flex items-center justify-end gap-1.5 text-xs font-bold tracking-widest uppercase text-amber-300">
            <Compass className="w-3.5 h-3.5" />
            <span>{player.currentLocationName}</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {pointerLocked ? 'Cursor Locked · Esc Pause' : 'Click viewport to lock aim (or drag)'}
          </div>
        </div>

        {activeQuest && currentStage && (
          <div className="bg-slate-950/85 border border-slate-800 rounded px-3.5 py-2.5 text-right w-full">
            <div className="text-[10px] uppercase tracking-widest text-sky-400 font-semibold">
              Active Path · Stage {activeQuest.currentStage}
            </div>
            <div className="text-xs font-bold text-slate-100 mt-0.5">{activeQuest.name}</div>
            <div className="mt-1.5 space-y-1">
              {currentStage.objectives.map((obj) => (
                <div
                  key={obj.id}
                  className={`text-[11px] flex items-center justify-end gap-1.5 ${
                    obj.completed ? 'text-emerald-400 line-through' : 'text-slate-300'
                  }`}
                >
                  <span>{obj.description}</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    ({obj.currentCount}/{obj.requiredCount})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Spectate or Orbital 4X Camera Banner */}
      {cameraMode === 'spectate' && spectateAgentName && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-950/92 border border-amber-400/80 px-4 py-1.5 rounded flex items-center gap-3 text-xs pointer-events-auto shadow-lg">
          <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
            <Eye className="w-3.5 h-3.5" />
            <span>Spectating: {spectateAgentName}</span>
          </div>
          <span className="text-slate-400 text-[11px] hidden sm:inline">[V] Cycle Agent</span>
          <button
            onClick={onExitSpectate}
            className="px-2.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] cursor-pointer whitespace-nowrap"
          >
            Exit Watch
          </button>
        </div>
      )}

      {cameraMode === 'orbital' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-950/92 border border-sky-400/80 px-4 py-1.5 rounded flex items-center gap-3 text-xs pointer-events-auto shadow-lg">
          <div className="flex items-center gap-1.5 text-sky-300 font-semibold">
            <Globe className="w-3.5 h-3.5" />
            <span>Orbital 4X Command View</span>
          </div>
          <span className="text-slate-400 text-[11px] hidden md:inline">Drag or [A/D] to Orbit</span>
          <button
            onClick={onOpenEmpire}
            className="px-2.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] cursor-pointer whitespace-nowrap"
          >
            Empire [M]
          </button>
          <button
            onClick={onToggleOrbitalCam}
            className="px-2.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-[11px] cursor-pointer whitespace-nowrap"
          >
            FPS View [C]
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-950/92 border border-amber-400/70 text-amber-200 px-4 py-2 rounded text-xs font-semibold tracking-wide">
          {toastMessage}
        </div>
      )}

      {/* Center Reticle & Hitmarker (only in FPS mode) */}
      {cameraMode === 'fps' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: weapon.accentHex }}
            />
            <div className="absolute inset-0 border border-slate-200/35 rounded-full" />
            {hitmarkerActive && (
              <svg viewBox="0 0 32 32" className="absolute inset-0 w-8 h-8">
                <line x1="6" y1="6" x2="12" y2="12" stroke="#fbbf24" strokeWidth="2" />
                <line x1="26" y1="6" x2="20" y2="12" stroke="#fbbf24" strokeWidth="2" />
                <line x1="6" y1="26" x2="12" y2="20" stroke="#fbbf24" strokeWidth="2" />
                <line x1="26" y1="26" x2="20" y2="20" stroke="#fbbf24" strokeWidth="2" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Floating Damage Numbers */}
      {floatingDamages.map((d) => (
        <div
          key={d.id}
          className={`absolute font-mono font-bold tabular-nums pointer-events-none ${
            d.isCrit ? 'text-amber-300 text-base' : 'text-sky-200 text-xs'
          }`}
          style={{
            left: `${d.x * 100}%`,
            top: `${d.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            opacity: Math.max(0, 1 - d.age / 0.75),
          }}
        >
          {d.amount}
          {d.isCrit ? '!' : ''}
        </div>
      ))}

      {/* Context Interaction Prompt */}
      {interactTarget && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-slate-950/92 border border-sky-400/70 px-4 py-2 rounded flex items-center gap-2.5 text-xs">
          {!interactTarget.densityLocked && (
            <span className="px-1.5 py-0.5 rounded bg-sky-500 text-slate-950 font-bold font-mono">
              E
            </span>
          )}
          <span className="text-slate-100 font-semibold">{interactTarget.prompt}</span>
        </div>
      )}

      {/* Collapsible Bottom Tactical Dock */}
      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center transition-transform duration-200 pointer-events-auto ${
          dockCollapsed ? 'translate-y-[calc(100%-26px)]' : 'translate-y-0'
        }`}
        style={{ maxWidth: 'min(940px, 95vw)' }}
      >
        <button
          onClick={onToggleDock}
          className="px-3 py-0.5 rounded-t bg-slate-950/92 border border-b-0 border-slate-700/80 text-[10px] tracking-widest uppercase text-slate-300 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
        >
          {dockCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span>{dockCollapsed ? 'Show Dock [H]' : 'Hide Dock [H]'}</span>
        </button>

        <div className="bg-slate-950/92 border border-slate-700/85 rounded-b rounded-tr rounded-tl px-3 py-2 flex flex-wrap items-center justify-center gap-2 text-xs shadow-xl">
          {/* Density Shift Pills */}
          <div className="flex items-center gap-1 pr-2 border-r border-slate-800">
            {([3, 4, 5] as DensityLevel[]).map((d, idx) => (
              <button
                key={d}
                onClick={() => onDensityShift(d)}
                className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                  player.currentDensity === d
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                [{idx + 1}] {d}D
              </button>
            ))}
          </div>

          {/* Weapon Selector */}
          <div className="flex items-center gap-1 pr-2 border-r border-slate-800">
            {Object.values(WEAPONS).map((w) => (
              <button
                key={w.id}
                onClick={() => onSelectWeapon(w.id)}
                className={`px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${
                  player.equippedWeaponId === w.id
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {w.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Abilities */}
          <button
            onClick={onHeal}
            className="px-2.5 py-1 rounded bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 hover:bg-emerald-900 text-[11px] font-semibold cursor-pointer"
          >
            [Q] Love Heal
          </button>
          <button
            onClick={onSuper}
            disabled={player.superCharge < 100}
            className={`px-2.5 py-1 rounded border text-[11px] font-semibold cursor-pointer ${
              player.superCharge >= 100
                ? 'bg-amber-500 border-amber-300 text-slate-950'
                : 'bg-slate-900 border-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            [F] Nova
          </button>

          {/* Fast Travel Region Selector */}
          <select
            aria-label="Travel to Region"
            value={player.currentLocationId}
            onChange={(e) => onFastTravel(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 rounded px-2 py-1 text-[11px] cursor-pointer"
          >
            {LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.id}>
                Travel: {loc.name}
              </option>
            ))}
          </select>

          <button
            onClick={onOpenEmpire}
            className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>[M] Empire</span>
          </button>

          <button
            onClick={onToggleOrbitalCam}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer border transition-colors whitespace-nowrap ${
              cameraMode === 'orbital'
                ? 'bg-sky-500 border-sky-400 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
            }`}
          >
            <Globe className={`w-3.5 h-3.5 ${cameraMode === 'orbital' ? 'text-slate-950' : 'text-sky-400'}`} />
            <span>[C] Orbital</span>
          </button>

          <button
            onClick={onOpenCodex}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5 text-sky-400" />
            <span>[Tab] Codex</span>
          </button>

          <button
            onClick={onToggleAgents}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer border transition-colors whitespace-nowrap ${
              agentsOpen
                ? 'bg-sky-500 border-sky-400 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-100'
            }`}
          >
            <Bot className={`w-3.5 h-3.5 ${agentsOpen ? 'text-slate-950' : 'text-sky-400'}`} />
            <span>
              [G] Agents{autonomySpeed !== 'paused' ? ` · ${autonomySpeed === 'fast' ? 'Fast' : 'Auto'}` : ''}
            </span>
          </button>

          <button
            onClick={onToggleMute}
            aria-label="Toggle Mute"
            className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
