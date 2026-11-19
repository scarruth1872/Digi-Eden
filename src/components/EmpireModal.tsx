import React, { useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  Compass,
  FlaskConical,
  Globe,
  Handshake,
  Rocket,
  Shield,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  CommodityId,
  DiplomacyEvent,
  DiplomaticStance,
  EmpireStructure,
  FactionEconomy,
  FactionId,
  MarketCommodity,
  MarketTradeEntry,
  SectorState,
  StructureType,
  TechId,
} from '../types/game';
import { STRUCTURE_CATALOG, TECH_TREE } from '../data/worldData';

interface EmpireModalProps {
  cycleCount: number;
  sectors: SectorState[];
  structures: EmpireStructure[];
  factions: Record<FactionId, FactionEconomy>;
  market: MarketCommodity[];
  tradeTape: MarketTradeEntry[];
  diplomacy: Record<FactionId, Record<FactionId, DiplomaticStance>>;
  diplomacyFeed: DiplomacyEvent[];
  onClose: () => void;
  onClaimSector: (sectorId: string) => void;
  onBuildStructure: (sectorId: string, type: StructureType) => void;
  onCommissionFrigate: () => void;
  onMarketTrade: (commodity: CommodityId, side: 'BUY' | 'SELL', qty: number) => void;
  onResearchTech: (techId: TechId) => void;
  onSetDiplomacy: (targetId: FactionId, stance: DiplomaticStance) => void;
  onWarpToSector: (sectorId: string) => void;
  onOpenOrbitalView: () => void;
}

type EmpireTab = 'sectors' | 'market' | 'diplomacy' | 'tech';

const STANCE_LABEL: Record<DiplomaticStance, string> = {
  ALLIED: 'Allied',
  TRADE_PACT: 'Trade Pact',
  NEUTRAL: 'Neutral',
  RIVAL: 'Rival',
  WAR: 'War',
};

const STANCE_COLOR: Record<DiplomaticStance, string> = {
  ALLIED: 'text-emerald-300',
  TRADE_PACT: 'text-sky-300',
  NEUTRAL: 'text-slate-300',
  RIVAL: 'text-amber-300',
  WAR: 'text-rose-400',
};

export const EmpireModal: React.FC<EmpireModalProps> = ({
  cycleCount,
  sectors,
  structures,
  factions,
  market,
  tradeTape,
  diplomacy,
  diplomacyFeed,
  onClose,
  onClaimSector,
  onBuildStructure,
  onCommissionFrigate,
  onMarketTrade,
  onResearchTech,
  onSetDiplomacy,
  onWarpToSector,
  onOpenOrbitalView,
}) => {
  const [activeTab, setActiveTab] = useState<EmpireTab>('sectors');
  const [selectedSectorId, setSelectedSectorId] = useState<string>(sectors[0]?.id || 'starting_area');

  const playerEcon = factions.player;
  const selectedSector = sectors.find((s) => s.id === selectedSectorId) || sectors[0];
  const sectorStructures = structures.filter((s) => s.sectorId === selectedSector.id);
  const priceMap = Object.fromEntries(market.map((m) => [m.id, m.price])) as Record<CommodityId, number>;

  const computeNetWorth = (f: FactionEconomy) => {
    const cargoVal =
      f.cargo.ore * priceMap.ore +
      f.cargo.crystals * priceMap.crystals +
      f.cargo.isotopes * priceMap.isotopes +
      f.cargo.alloys * priceMap.alloys;
    const ownedSectors = sectors.filter((s) => s.ownerId === f.id).length;
    const ownedStructs = structures.filter((s) => s.ownerId === f.id).length;
    return Math.round(f.credits + cargoVal + ownedSectors * 450 + ownedStructs * 300 + f.fleetSize * 240);
  };

  const secRatingColor = (sec: number) =>
    sec >= 0.7 ? 'text-emerald-300' : sec >= 0.4 ? 'text-amber-300' : 'text-rose-400';

  const secLabel = (sec: number) =>
    sec >= 0.7 ? 'High-Sec' : sec >= 0.4 ? 'Low-Sec' : 'Null-Sec';

  return (
    <div className="fixed inset-0 z-30 bg-slate-950/88 flex items-center justify-center p-4 pointer-events-auto">
      <div className="w-full max-w-5xl max-h-[88vh] bg-slate-950 border border-slate-700/90 rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/80">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-100 tracking-tight truncate">
              Empire Command &amp; Galactic Exchange
            </h2>
            <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2 mt-0.5 font-mono tabular-nums">
              <span className="text-amber-300">{playerEcon.corpName}</span>
              <span aria-hidden="true">·</span>
              <span>Cycle {cycleCount}</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-300">{Math.round(playerEcon.credits).toLocaleString()} ISK</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-300">{Math.round(playerEcon.science)} Science</span>
              <span aria-hidden="true">·</span>
              <span>{playerEcon.fleetSize} Frigates</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                onClose();
                onOpenOrbitalView();
              }}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-sky-300 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Orbital 3D View</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close Empire Command"
              className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs & Cargo Strip */}
        <div className="px-5 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800">
            {(
              [
                { id: 'sectors', label: 'Sectors & Citadels', icon: Building2 },
                { id: 'market', label: 'EVE Market', icon: TrendingUp },
                { id: 'diplomacy', label: 'Diplomacy', icon: Handshake },
                { id: 'tech', label: 'Ascension Tech', icon: FlaskConical },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === id
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="text-xs font-mono tabular-nums text-slate-300 flex items-center gap-3">
            <span>ORE {Math.round(playerEcon.cargo.ore)}</span>
            <span className="text-slate-600">/</span>
            <span>CRY {Math.round(playerEcon.cargo.crystals)}</span>
            <span className="text-slate-600">/</span>
            <span>ISO {Math.round(playerEcon.cargo.isotopes)}</span>
            <span className="text-slate-600">/</span>
            <span>ALY {Math.round(playerEcon.cargo.alloys)}</span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* TAB 1: SECTORS & STRUCTURES */}
          {activeTab === 'sectors' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Sector List */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Digital Eden Star Sectors
                  </h3>
                  <button
                    onClick={onCommissionFrigate}
                    disabled={playerEcon.credits < 200 || playerEcon.cargo.alloys < 12}
                    className="px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-semibold text-xs flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Rocket className="w-3 h-3" />
                    <span>Build Frigate (200 ISK · 12 ALY)</span>
                  </button>
                </div>

                {sectors.map((sec) => {
                  const owner = sec.ownerId ? factions[sec.ownerId] : null;
                  const count = structures.filter((st) => st.sectorId === sec.id).length;
                  const isSelected = sec.id === selectedSector.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setSelectedSectorId(sec.id)}
                      className={`w-full text-left p-3.5 rounded-md border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 border-amber-400/80'
                          : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-100">{sec.name}</span>
                        <span className={`text-xs font-mono tabular-nums font-semibold ${secRatingColor(sec.securityRating)}`}>
                          {sec.securityRating.toFixed(1)} {secLabel(sec.securityRating)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center justify-between gap-2">
                        <span>
                          Sovereignty:{' '}
                          <strong style={{ color: owner ? owner.colorHex : '#94a3b8' }}>
                            {owner ? owner.corpName : 'Unclaimed Frontier'}
                          </strong>
                        </span>
                        <span className="font-mono tabular-nums text-slate-300">
                          {count} {count === 1 ? 'Structure' : 'Structures'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono tabular-nums">
                        Yield: +{sec.baseYieldCredits} ISK · +{sec.baseYieldScience} Sci · +{sec.baseYieldResource}{' '}
                        {sec.specialty.toUpperCase()}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right: Selected Sector Management */}
              <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-md p-4 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-slate-100">{selectedSector.name}</h3>
                    <div className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                      Security {selectedSector.securityRating.toFixed(1)} ({secLabel(selectedSector.securityRating)}) ·
                      Specialty: {selectedSector.specialty.toUpperCase()} · Control {selectedSector.controlPercent}%
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onWarpToSector(selectedSector.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5 text-sky-400" />
                      <span>Warp to Sector</span>
                    </button>
                    {selectedSector.ownerId !== 'player' && (
                      <button
                        onClick={() => onClaimSector(selectedSector.id)}
                        disabled={playerEcon.credits < 180}
                        className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs cursor-pointer disabled:cursor-not-allowed"
                      >
                        {selectedSector.ownerId ? 'Contest Sovereignty (180 ISK)' : 'Claim Sector (180 ISK)'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Installed 3D Structures */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Active 3D Structures in Sector ({sectorStructures.length})
                  </h4>
                  {sectorStructures.length === 0 ? (
                    <div className="text-xs text-slate-500 py-3 border border-dashed border-slate-800 rounded text-center">
                      No structures built here yet. Claim the sector to construct Citadels, Mining Rigs, or Turrets.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {sectorStructures.map((st) => {
                        const def = STRUCTURE_CATALOG[st.type];
                        const owner = factions[st.ownerId];
                        return (
                          <div
                            key={st.id}
                            className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs flex flex-col gap-0.5"
                          >
                            <div className="font-semibold text-slate-100 flex items-center justify-between">
                              <span>{def.name}</span>
                              <span style={{ color: owner.colorHex }}>{owner.name}</span>
                            </div>
                            <span className="text-[11px] text-slate-400">{def.effect}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Build Menu */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Construct 3D Infrastructure{' '}
                    {selectedSector.ownerId !== 'player' && (
                      <span className="text-amber-400 normal-case font-normal">
                        (Claim sovereignty over this sector first)
                      </span>
                    )}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(Object.keys(STRUCTURE_CATALOG) as StructureType[]).map((type) => {
                      const def = STRUCTURE_CATALOG[type];
                      const canAfford =
                        selectedSector.ownerId === 'player' &&
                        playerEcon.credits >= def.costCredits &&
                        playerEcon.cargo.ore >= def.costOre &&
                        playerEcon.cargo.alloys >= def.costAlloys;
                      return (
                        <div
                          key={type}
                          className="p-3 rounded bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-100">{def.name}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{def.effect}</div>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-900">
                            <span className="text-[11px] font-mono tabular-nums text-slate-300">
                              {def.costCredits} ISK · {def.costOre} ORE · {def.costAlloys} ALY
                            </span>
                            <button
                              onClick={() => onBuildStructure(selectedSector.id, type)}
                              disabled={!canAfford}
                              className="px-2.5 py-1 rounded bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] cursor-pointer disabled:cursor-not-allowed"
                            >
                              Build
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EVE MARKET EXCHANGE */}
          {activeTab === 'market' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Live Commodity Order Book (Prices Shift With Player &amp; Agent Trades)
                </h3>
                <div className="border border-slate-800 rounded-md overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                        <th className="py-2.5 px-3">Commodity</th>
                        <th className="py-2.5 px-3 text-right">Spot Price</th>
                        <th className="py-2.5 px-3 text-right">Delta</th>
                        <th className="py-2.5 px-3 text-right">Your Cargo</th>
                        <th className="py-2.5 px-3 text-right">Execute Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-950">
                      {market.map((item) => {
                        const diff = item.price - item.prevPrice;
                        const pct = item.prevPrice > 0 ? (diff / item.prevPrice) * 100 : 0;
                        const owned = Math.round(playerEcon.cargo[item.id]);
                        return (
                          <tr key={item.id} className="hover:bg-slate-900/40">
                            <td className="py-3 px-3">
                              <div className="font-bold text-slate-100">{item.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {item.symbol} · Pool {item.supply}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-amber-300">
                              {item.price.toFixed(1)} ISK
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">
                              <span
                                className={`inline-flex items-center gap-0.5 ${
                                  diff > 0
                                    ? 'text-emerald-400'
                                    : diff < 0
                                      ? 'text-rose-400'
                                      : 'text-slate-400'
                                }`}
                              >
                                {diff > 0 && <ArrowUpRight className="w-3 h-3" />}
                                {diff < 0 && <ArrowDownRight className="w-3 h-3" />}
                                {diff >= 0 ? '+' : ''}
                                {pct.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                              {owned}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => onMarketTrade(item.id, 'BUY', 10)}
                                  disabled={playerEcon.credits < item.price * 10}
                                  className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] cursor-pointer disabled:cursor-not-allowed"
                                >
                                  Buy 10
                                </button>
                                <button
                                  onClick={() => onMarketTrade(item.id, 'SELL', 10)}
                                  disabled={owned < 10}
                                  className="px-2 py-1 rounded bg-rose-500 hover:bg-rose-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-[11px] cursor-pointer disabled:cursor-not-allowed"
                                >
                                  Sell 10
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="lg:col-span-4 space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Live Exchange Tape
                </h3>
                <div className="bg-slate-900/60 border border-slate-800 rounded-md p-3 space-y-2 max-h-[340px] overflow-y-auto">
                  {tradeTape.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-6">
                      No trades executed yet. Place an order or let autonomous agents trade on the exchange.
                    </div>
                  ) : (
                    tradeTape.map((t) => (
                      <div
                        key={t.id}
                        className="text-xs border-b border-slate-800/80 pb-2 last:border-b-0 last:pb-0 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="font-bold" style={{ color: t.actorColor }}>
                            {t.actorName}
                          </span>{' '}
                          <span className={t.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                            {t.side}
                          </span>{' '}
                          <span className="font-mono tabular-nums text-slate-200">
                            {t.qty} {t.commodity.toUpperCase()}
                          </span>
                        </div>
                        <span className="font-mono tabular-nums text-[11px] text-slate-400">
                          @{t.unitPrice.toFixed(1)} · {t.timestamp}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIPLOMACY & STANDINGS */}
          {activeTab === 'diplomacy' && (
            <div className="space-y-5">
              <div className="border border-slate-800 rounded-md overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                      <th className="py-2.5 px-3">Corporation / Commander</th>
                      <th className="py-2.5 px-3 text-right">Net Worth</th>
                      <th className="py-2.5 px-3 text-right">Sectors</th>
                      <th className="py-2.5 px-3 text-right">Fleet</th>
                      <th className="py-2.5 px-3 text-right">Techs</th>
                      <th className="py-2.5 px-3 text-center">Stance</th>
                      <th className="py-2.5 px-3 text-right">Diplomatic Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-950">
                    {(['player', 'lyra', 'kael', 'soren'] as FactionId[]).map((fid) => {
                      const f = factions[fid];
                      const ownedSectors = sectors.filter((s) => s.ownerId === fid).length;
                      const stance = diplomacy.player[fid];
                      return (
                        <tr key={fid} className="hover:bg-slate-900/40">
                          <td className="py-3 px-3">
                            <div className="font-bold" style={{ color: f.colorHex }}>
                              {f.corpName}
                            </div>
                            <div className="text-[11px] text-slate-400">{f.name}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-amber-300">
                            {computeNetWorth(f).toLocaleString()} ISK
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                            {ownedSectors}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                            {f.fleetSize}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-sky-300">
                            {f.techs.length}/{TECH_TREE.length}
                          </td>
                          <td className={`py-3 px-3 text-center font-semibold ${STANCE_COLOR[stance]}`}>
                            {fid === 'player' ? 'You' : STANCE_LABEL[stance]}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {fid === 'player' ? (
                              <span className="text-slate-500 text-[11px]">Sovereign</span>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => onSetDiplomacy(fid, 'TRADE_PACT')}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold text-[11px] cursor-pointer"
                                >
                                  Trade Pact
                                </button>
                                <button
                                  onClick={() => onSetDiplomacy(fid, 'ALLIED')}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold text-[11px] cursor-pointer"
                                >
                                  Ally
                                </button>
                                <button
                                  onClick={() => onSetDiplomacy(fid, 'WAR')}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 font-semibold text-[11px] cursor-pointer"
                                >
                                  War
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Diplomatic Wire &amp; Treaties
                </h3>
                <div className="bg-slate-900/60 border border-slate-800 rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                  {diplomacyFeed.length === 0 ? (
                    <div className="text-xs text-slate-500 text-center py-4">
                      Autonomous faction leaders will broadcast treaties, pacts, and rivalries here.
                    </div>
                  ) : (
                    diplomacyFeed.map((ev) => (
                      <div key={ev.id} className="text-xs border-b border-slate-800/80 pb-2 last:border-b-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            <strong style={{ color: factions[ev.fromId].colorHex }}>
                              {factions[ev.fromId].corpName}
                            </strong>{' '}
                            →{' '}
                            <strong style={{ color: factions[ev.toId].colorHex }}>
                              {factions[ev.toId].corpName}
                            </strong>{' '}
                            · <span className={STANCE_COLOR[ev.stance]}>{STANCE_LABEL[ev.stance]}</span>
                          </span>
                          <span className="font-mono text-[10px] text-slate-500">{ev.timestamp}</span>
                        </div>
                        <div className="text-slate-300 mt-0.5">{ev.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CIVILIZATION ASCENSION TECH TREE */}
          {activeTab === 'tech' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Civilization Research Tree
                </h3>
                <div className="text-xs font-mono tabular-nums text-sky-300">
                  Available Science: {Math.round(playerEcon.science)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {TECH_TREE.map((tech) => {
                  const unlocked = playerEcon.techs.includes(tech.id);
                  const canAfford = !unlocked && playerEcon.science >= tech.costScience;
                  const agentUnlockers = (['lyra', 'kael', 'soren'] as FactionId[]).filter((fid) =>
                    factions[fid].techs.includes(tech.id)
                  );
                  return (
                    <div
                      key={tech.id}
                      className={`p-3.5 rounded-md border flex flex-col justify-between gap-3 ${
                        unlocked
                          ? 'bg-emerald-950/35 border-emerald-500/50'
                          : 'bg-slate-900/70 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                          {tech.era}
                        </div>
                        <div className="text-sm font-bold text-slate-100 mt-0.5">{tech.name}</div>
                        <p className="text-xs text-slate-400 mt-1 leading-snug">{tech.summary}</p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        {agentUnlockers.length > 0 && (
                          <div className="text-[11px] text-slate-400">
                            Researched by:{' '}
                            {agentUnlockers.map((fid, i) => (
                              <span key={fid} style={{ color: factions[fid].colorHex }}>
                                {i > 0 ? ', ' : ''}
                                {factions[fid].name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono tabular-nums text-sky-300">
                            {tech.costScience} Science
                          </span>
                          {unlocked ? (
                            <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5" />
                              Researched
                            </span>
                          ) : (
                            <button
                              onClick={() => onResearchTech(tech.id)}
                              disabled={!canAfford}
                              className="px-3 py-1 rounded bg-sky-500 hover:bg-sky-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs cursor-pointer disabled:cursor-not-allowed"
                            >
                              Research
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
