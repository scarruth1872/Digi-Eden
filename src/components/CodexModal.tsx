import React, { useState } from 'react';
import {
  BookOpen,
  Compass,
  Package,
  Save,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import {
  DensityLevel,
  GameItem,
  ItemType,
  JournalEntry,
  LoreEntry,
  MeditationFocus,
  PlayerStats,
  Quest,
  ServiceType,
} from '../types/game';
import { LOCATIONS, WEAPONS } from '../data/worldData';

interface CodexModalProps {
  player: PlayerStats;
  inventory: GameItem[];
  quests: Quest[];
  lore: LoreEntry[];
  journal: JournalEntry[];
  onClose: () => void;
  onMeditate: (focus: MeditationFocus) => void;
  onDensityShift: (density: DensityLevel) => void;
  onUseItem: (itemId: string) => void;
  onEquipItem: (itemId: string) => void;
  onSelectWeapon: (weaponId: string) => void;
  onReflectLore: (loreId: string) => void;
  onSaveGame: () => void;
  onLoadGame: () => void;
  onFastTravel: (locId: string) => void;
  hasSave: boolean;
}

type CodexTab = 'polarity' | 'quests' | 'arsenal' | 'lore' | 'save';

const SERVICE_LABELS: Record<ServiceType, string> = {
  [ServiceType.DIRECT_HELP]: 'Direct Help (STO)',
  [ServiceType.EMPATHETIC_HEALING]: 'Empathetic Healing (STO)',
  [ServiceType.RESOURCE_GIVING]: 'Resource Giving (STO)',
  [ServiceType.SELF_IMPROVEMENT]: 'Inner Balance',
  [ServiceType.RESOURCE_GATHERING]: 'Resource Gathering (STS)',
  [ServiceType.EXPLOITATION]: 'Control & Power (STS)',
};

export const CodexModal: React.FC<CodexModalProps> = ({
  player,
  inventory,
  quests,
  lore,
  journal,
  onClose,
  onMeditate,
  onDensityShift,
  onUseItem,
  onEquipItem,
  onSelectWeapon,
  onReflectLore,
  onSaveGame,
  onLoadGame,
  onFastTravel,
  hasSave,
}) => {
  const [tab, setTab] = useState<CodexTab>('polarity');

  const totalService = player.serviceToOthers + player.serviceToSelf;
  const stoPercent = totalService > 0 ? Math.round((player.serviceToOthers / totalService) * 100) : 50;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/78 p-4 md:p-8">
      <div className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-slate-950 border border-slate-700 rounded-lg shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold tracking-widest uppercase text-amber-300">
              Sub-Logos Codex &amp; Guardian Record
            </h2>
            <p className="text-xs text-slate-400">
              Level {player.level} · {player.currentLocationName} · {player.currentDensity}th Density
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Codex"
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 px-6 py-2.5 bg-slate-900/60 border-b border-slate-800 text-xs">
          {[
            { id: 'polarity', label: 'Polarity & Meditation', icon: Sparkles },
            { id: 'quests', label: 'Quests & Regions', icon: Compass },
            { id: 'arsenal', label: 'Arsenal & Inventory', icon: Package },
            { id: 'lore', label: 'Law of One & Journal', icon: BookOpen },
            { id: 'save', label: 'Save / Load', icon: Save },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id as CodexTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded font-semibold cursor-pointer transition-colors ${
                  tab === item.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {tab === 'polarity' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* Alignment & Harvest */}
              <div className="bg-slate-900/80 border border-slate-800 rounded p-4 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-sky-300">
                  Harvest Polarity &amp; Service
                </h3>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-emerald-300 font-semibold">
                      Service to Others ({stoPercent}%)
                    </span>
                    <span className="text-rose-300 font-semibold">
                      Service to Self ({100 - stoPercent}%)
                    </span>
                  </div>
                  <div className="h-3 w-full bg-rose-900/70 rounded overflow-hidden flex">
                    <div
                      className="h-full bg-emerald-400 transition-all"
                      style={{ width: `${stoPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 font-mono tabular-nums mt-2">
                    <span>STO: {player.serviceToOthers}</span>
                    <span>Harvest Score: {player.harvestScore}</span>
                    <span>STS: {player.serviceToSelf}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  {(Object.keys(player.serviceLevels) as ServiceType[]).map((svc) => (
                    <div key={svc} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{SERVICE_LABELS[svc]}</span>
                      <span className="font-mono tabular-nums text-amber-300">
                        {player.serviceLevels[svc]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meditation & Density Shifting */}
              <div className="space-y-4">
                <div className="bg-slate-900/80 border border-slate-800 rounded p-4 space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300">
                    Density Consciousness Shift
                  </h3>
                  <p className="text-xs text-slate-400">
                    Astral Energy: <span className="font-mono text-sky-300">{Math.round(player.astralEnergy)}/{player.maxAstralEnergy}</span>
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {([3, 4, 5] as DensityLevel[]).map((d) => (
                      <button
                        key={d}
                        onClick={() => onDensityShift(d)}
                        className={`py-2 px-2 rounded text-xs font-semibold border cursor-pointer ${
                          player.currentDensity === d
                            ? 'bg-purple-500 border-purple-300 text-slate-950'
                            : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-purple-400'
                        }`}
                      >
                        {d}th Density
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded p-4 space-y-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
                    Meditation &amp; Inner Reflection
                  </h3>
                  <p className="text-xs text-slate-400">
                    Focus your intent to restore Astral Energy, replenish Love Energy, and attune your polarity.
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => onMeditate(MeditationFocus.SERVICE_TO_OTHERS_FOCUS)}
                      className="px-3 py-2 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-200 text-xs font-semibold text-left cursor-pointer"
                    >
                      Meditate on Compassion &amp; Unity (+STO, +Love Energy, +Astral)
                    </button>
                    <button
                      onClick={() => onMeditate(MeditationFocus.BALANCE_FOCUS)}
                      className="px-3 py-2 rounded bg-sky-950/90 hover:bg-sky-900 border border-sky-600/50 text-sky-200 text-xs font-semibold text-left cursor-pointer"
                    >
                      Meditate on Harmonic Balance (+Balanced, +Shields, +Astral)
                    </button>
                    <button
                      onClick={() => onMeditate(MeditationFocus.SERVICE_TO_SELF_FOCUS)}
                      className="px-3 py-2 rounded bg-rose-950/90 hover:bg-rose-900 border border-rose-600/50 text-rose-200 text-xs font-semibold text-left cursor-pointer"
                    >
                      Meditate on Inner Sovereignty (+STS, +Attack Surge)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'quests' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                {quests.map((q) => (
                  <div
                    key={q.id}
                    className={`p-4 rounded border ${
                      q.completed
                        ? 'bg-emerald-950/30 border-emerald-700/50'
                        : 'bg-slate-900/85 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-sm text-amber-300">{q.name}</h4>
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {q.completed ? 'Completed' : `Stage ${q.currentStage}/${q.stages.length}`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mb-3">{q.description}</p>
                    <div className="space-y-1.5">
                      {q.stages.map((st) => (
                        <div key={st.stageNumber} className="text-xs border-l-2 border-slate-700 pl-2.5">
                          <div className="text-slate-400 font-semibold">
                            Stage {st.stageNumber}: {st.description}
                          </div>
                          {st.objectives.map((o) => (
                            <div
                              key={o.id}
                              className={`font-mono text-[11px] ${
                                o.completed ? 'text-emerald-400' : 'text-sky-300'
                              }`}
                            >
                              • {o.description} ({o.currentCount}/{o.requiredCount})
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300 mb-3">
                  Realms of Digital Eden (Quick Travel)
                </h4>
                <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {LOCATIONS.map((loc) => (
                    <button
                      key={loc.id}
                      onClick={() => {
                        onFastTravel(loc.id);
                        onClose();
                      }}
                      className={`p-2.5 rounded border text-left text-xs cursor-pointer ${
                        player.currentLocationId === loc.id
                          ? 'bg-sky-950/90 border-sky-400 text-sky-100'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-bold">{loc.name}</div>
                      <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {player.currentDensity === 4
                          ? loc.description4D
                          : player.currentDensity === 5
                            ? loc.description5D
                            : loc.description3D}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'arsenal' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                  <Swords className="w-4 h-4" /> Light Weapons
                </h3>
                {Object.values(WEAPONS).map((w) => (
                  <div
                    key={w.id}
                    className={`p-3.5 rounded border flex items-center justify-between gap-3 ${
                      player.equippedWeaponId === w.id
                        ? 'bg-amber-950/40 border-amber-400'
                        : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-slate-100">{w.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{w.description}</div>
                      <div className="text-[11px] font-mono text-sky-300 mt-1">
                        DMG {w.damage} · ROF {w.fireRate}/s
                        {w.densityBonus ? ` · +35% in ${w.densityBonus}D` : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => onSelectWeapon(w.id)}
                      className={`px-3 py-1.5 rounded text-xs font-bold shrink-0 cursor-pointer ${
                        player.equippedWeaponId === w.id
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {player.equippedWeaponId === w.id ? 'Equipped' : 'Equip'}
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-sky-300">
                  Inventory &amp; Relics ({inventory.length}/10)
                </h3>
                <div className="text-xs text-slate-400 font-mono">
                  Attack Bonus: +{player.attack} · Defense: {player.defense}
                </div>
                {inventory.length === 0 ? (
                  <p className="text-xs text-slate-500">Your inventory is empty.</p>
                ) : (
                  <div className="space-y-2">
                    {inventory.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-100">
                            {item.name} <span className="text-slate-400 font-mono">x{item.quantity}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{item.description}</div>
                        </div>
                        {item.type === ItemType.CONSUMABLE && (
                          <button
                            onClick={() => onUseItem(item.id)}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer shrink-0"
                          >
                            Use
                          </button>
                        )}
                        {(item.type === ItemType.ARMOR || item.type === ItemType.RELIC) && (
                          <button
                            onClick={() => onEquipItem(item.id)}
                            className={`px-2.5 py-1 rounded font-bold text-xs cursor-pointer shrink-0 ${
                              item.equipped
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                            }`}
                          >
                            {item.equipped ? 'Equipped' : 'Equip'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'lore' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-300">
                  Law of One Teachings (Reflect for Wisdom)
                </h3>
                {lore.map((entry) => (
                  <div
                    key={entry.id}
                    className={`p-3.5 rounded border ${
                      entry.discovered
                        ? 'bg-slate-900/85 border-slate-700'
                        : 'bg-slate-950 border-slate-900 opacity-55'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-sky-300">
                        {entry.discovered ? entry.title : 'Undiscovered Teaching'}
                      </span>
                      <span className="text-[10px] text-slate-400">{entry.source}</span>
                    </div>
                    {entry.discovered && (
                      <>
                        <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">{entry.content}</p>
                        <div className="mt-2.5 flex justify-end">
                          <button
                            disabled={entry.reflected}
                            onClick={() => onReflectLore(entry.id)}
                            className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                              entry.reflected
                                ? 'bg-slate-800 text-emerald-400 cursor-default'
                                : 'bg-purple-600 hover:bg-purple-500 text-white'
                            }`}
                          >
                            {entry.reflected ? 'Reflected (+Harvest)' : 'Reflect on Teaching'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase tracking-wider text-sky-300">
                  Chronicle Journal
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {journal.map((j) => (
                    <div key={j.id} className="p-3 rounded bg-slate-900/75 border border-slate-800">
                      <div className="flex justify-between text-[11px] text-amber-300 font-semibold">
                        <span>{j.title}</span>
                        <span className="text-slate-500 font-mono">{j.timestamp}</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{j.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'save' && (
            <div className="max-w-md mx-auto bg-slate-900/80 border border-slate-800 rounded p-6 space-y-4 text-center">
              <h3 className="text-base font-bold text-amber-300 uppercase tracking-wider">
                Continuity of Consciousness
              </h3>
              <p className="text-xs text-slate-300">
                Preserve your stats, Harvest alignment, inventory, active quests, and position in Digital Eden.
              </p>
              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={onSaveGame}
                  className="w-full py-2.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-widest cursor-pointer"
                >
                  Save Current Progress
                </button>
                <button
                  disabled={!hasSave}
                  onClick={onLoadGame}
                  className={`w-full py-2.5 rounded border text-xs uppercase tracking-widest font-bold ${
                    hasSave
                      ? 'border-sky-400 bg-slate-950 hover:bg-sky-950 text-sky-200 cursor-pointer'
                      : 'border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  Load Saved Progress
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
