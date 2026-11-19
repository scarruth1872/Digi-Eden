export enum ServiceType {
  DIRECT_HELP = 'DIRECT_HELP',
  EMPATHETIC_HEALING = 'EMPATHETIC_HEALING',
  RESOURCE_GIVING = 'RESOURCE_GIVING',
  SELF_IMPROVEMENT = 'SELF_IMPROVEMENT',
  RESOURCE_GATHERING = 'RESOURCE_GATHERING',
  EXPLOITATION = 'EXPLOITATION',
}

export enum MeditationFocus {
  NONE = 'NONE',
  SERVICE_TO_OTHERS_FOCUS = 'SERVICE_TO_OTHERS_FOCUS',
  SERVICE_TO_SELF_FOCUS = 'SERVICE_TO_SELF_FOCUS',
  BALANCE_FOCUS = 'BALANCE_FOCUS',
}

export enum ItemType {
  WEAPON = 'WEAPON',
  ARMOR = 'ARMOR',
  CONSUMABLE = 'CONSUMABLE',
  QUEST = 'QUEST',
  RELIC = 'RELIC',
}

export enum QuestType {
  SERVICE_TO_OTHERS = 'SERVICE_TO_OTHERS',
  SERVICE_TO_SELF = 'SERVICE_TO_SELF',
  BALANCED = 'BALANCED',
}

export enum QuestObjectiveType {
  LOCATION = 'LOCATION',
  COLLECT_ITEM = 'COLLECT_ITEM',
  DEFEAT_ENEMY = 'DEFEAT_ENEMY',
  TALK_TO = 'TALK_TO',
  EXAMINE = 'EXAMINE',
  HARMONIZE = 'HARMONIZE',
}

export enum EnemyArchetype {
  FALLEN_SCOUT = 'FALLEN_SCOUT',
  ORION_BRUTE = 'ORION_BRUTE',
  CRYSTAL_GUARDIAN = 'CRYSTAL_GUARDIAN',
}

export type DensityLevel = 3 | 4 | 5;

export type GamePhase = 'title' | 'playing' | 'paused' | 'dialogue' | 'codex' | 'empire' | 'victory' | 'gameover';

export interface WeaponDef {
  id: string;
  name: string;
  archetype: 'pulse' | 'cannon' | 'beam';
  damage: number;
  fireRate: number; // shots per second
  projectileSpeed: number;
  spread: number;
  color: number;
  accentHex: string;
  description: string;
  densityBonus?: DensityLevel;
}

export interface GameItem {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  attackBonus: number;
  defenseBonus: number;
  healthRestore?: number;
  energyRestore?: number;
  loveRestore?: number;
  equipped?: boolean;
  quantity: number;
}

export interface QuestObjective {
  id: string;
  type: QuestObjectiveType;
  target: string;
  description: string;
  requiredCount: number;
  currentCount: number;
  completed: boolean;
  actionTag?: string;
}

export interface QuestStage {
  stageNumber: number;
  description: string;
  objectives: QuestObjective[];
  completed: boolean;
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  type: QuestType;
  experienceReward: number;
  serviceToOthersReward: number;
  serviceToSelfReward: number;
  harvestReward: number;
  completionMessage: string;
  currentStage: number;
  stages: QuestStage[];
  completed: boolean;
  active: boolean;
}

export interface LoreEntry {
  id: string;
  title: string;
  content: string;
  source: string;
  category: 'Ra Material' | 'Sub-Logos' | 'Densities' | 'Field Log';
  discovered: boolean;
  reflected: boolean;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  category: 'QUEST' | 'LORE' | 'ALIGNMENT';
}

export interface DialogueChoice {
  text: string;
  nextNodeId: number | null; // null closes dialogue
  serviceEffect?: { type: ServiceType; amount: number; polarity: 'STO' | 'STS' | 'BALANCED' };
  questTriggerId?: string;
  questObjectiveTag?: string;
  unlockLoreId?: string;
  worldFlag?: { key: string; value: boolean };
  minSTO?: number;
  minDensity?: DensityLevel;
  rewardItemId?: string;
}

export interface DialogueNode {
  id: number;
  text: string;
  choices: DialogueChoice[];
}

export interface NPCData {
  id: string;
  name: string;
  title: string;
  smcAffiliation: string;
  locationId: string;
  position: [number, number]; // x, z
  distortions: string[];
  emotion4D: string;
  backstory: string;
  primaryColor: number;
  accentColor: number;
  dialogue: Record<number, DialogueNode>;
}

export interface WorldObjectData {
  id: string;
  name: string;
  description: string;
  densityRequired?: DensityLevel;
  locationId: string;
  position: [number, number];
  kind: 'statue' | 'tablet' | 'crystal_rock' | 'altar' | 'relic_cache';
  itemRewardId?: string;
  loreId?: string;
  objectiveTarget?: string;
  isHarmonizeAltar?: boolean;
  examined?: boolean;
  collected?: boolean;
}

export interface LocationData {
  id: string;
  name: string;
  center: [number, number];
  radius: number;
  description3D: string;
  description4D: string;
  description5D: string;
  distortionLevel: number;
  ambientHint: string;
}

export interface PlayerStats {
  name: string;
  level: number;
  experience: number;
  xpToNext: number;
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  attack: number;
  defense: number;
  loveEnergy: number;
  maxLoveEnergy: number;
  astralEnergy: number;
  maxAstralEnergy: number;
  superCharge: number; // 0-100
  serviceToOthers: number;
  serviceToSelf: number;
  harvestScore: number;
  currentDensity: DensityLevel;
  currentLocationId: string;
  currentLocationName: string;
  equippedWeaponId: string;
  serviceLevels: Record<ServiceType, number>;
  enemiesDefeated: number;
}

export interface FloatingDamage {
  id: number;
  x: number; // normalized screen 0..1
  y: number;
  amount: number;
  isCrit: boolean;
  isHeal?: boolean;
  age: number;
}

export interface InteractionTarget {
  type: 'npc' | 'object';
  id: string;
  name: string;
  prompt: string;
  distance: number;
  densityLocked?: DensityLevel;
}

export interface SaveState {
  version: number;
  savedAt: string;
  player: PlayerStats;
  inventory: GameItem[];
  quests: Quest[];
  lore: LoreEntry[];
  journal: JournalEntry[];
  worldFlags: Record<string, boolean>;
  collectedObjectIds: string[];
  examinedObjectIds: string[];
  playerPosition: [number, number, number];
  playerYaw: number;
}

export type FactionId = 'player' | 'lyra' | 'kael' | 'soren';

export type CommodityId = 'ore' | 'crystals' | 'isotopes' | 'alloys';

export type StructureType = 'citadel' | 'mining_rig' | 'research_spire' | 'defense_turret';

export type DiplomaticStance = 'ALLIED' | 'TRADE_PACT' | 'NEUTRAL' | 'RIVAL' | 'WAR';

export type TechId =
  | 'orbital_logistics'
  | 'deep_core_extraction'
  | 'harmonic_shielding'
  | 'warp_conduits'
  | 'quantum_diplomacy'
  | 'sub_logos_citadel';

export interface TechDef {
  id: TechId;
  name: string;
  era: 'Era I · Frontier' | 'Era II · Industrial' | 'Era III · Ascension';
  costScience: number;
  summary: string;
}

export interface StructureDef {
  type: StructureType;
  name: string;
  costCredits: number;
  costOre: number;
  costAlloys: number;
  effect: string;
}

export interface EmpireStructure {
  id: string;
  type: StructureType;
  sectorId: string;
  ownerId: FactionId;
  position: [number, number];
  builtAt: string;
}

export interface SectorState {
  id: string;
  name: string;
  center: [number, number];
  securityRating: number; // EVE-style 0.1 (Null-Sec) to 1.0 (High-Sec)
  ownerId: FactionId | null;
  controlPercent: number; // 0..100
  specialty: CommodityId;
  baseYieldCredits: number;
  baseYieldScience: number;
  baseYieldResource: number;
}

export interface MarketCommodity {
  id: CommodityId;
  name: string;
  symbol: string;
  basePrice: number;
  price: number;
  prevPrice: number;
  supply: number;
}

export interface MarketTradeEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorColor: string;
  side: 'BUY' | 'SELL';
  commodity: CommodityId;
  qty: number;
  unitPrice: number;
}

export interface FactionEconomy {
  id: FactionId;
  name: string;
  corpName: string;
  colorHex: string;
  colorInt: number;
  credits: number;
  science: number;
  fleetSize: number;
  cargo: Record<CommodityId, number>;
  techs: TechId[];
}

export interface DiplomacyEvent {
  id: string;
  timestamp: string;
  fromId: FactionId;
  toId: FactionId;
  stance: DiplomaticStance;
  message: string;
}

export type CameraMode = 'fps' | 'orbital' | 'spectate';

export type AgentActionType =
  | 'MOVE_TO_REGION'
  | 'ENGAGE_ENEMY'
  | 'HEAL_ALLY'
  | 'MEDITATE'
  | 'SHIFT_DENSITY'
  | 'INSPECT_OBJECT'
  | 'SPEAK_TO_NPC'
  | 'PATROL'
  | 'CLAIM_SECTOR'
  | 'BUILD_STRUCTURE'
  | 'MINE_RESOURCES'
  | 'MARKET_TRADE'
  | 'BUILD_FLEET'
  | 'RESEARCH_TECH'
  | 'DIPLOMACY';

export interface AgentState {
  id: string;
  name: string;
  title: string;
  corpName: string;
  philosophy: 'Service to Others' | 'Service to Self' | 'Balanced Observer';
  colorHex: string;
  primaryColor: number;
  accentColor: number;
  hp: number;
  maxHp: number;
  density: DensityLevel;
  loveEnergy: number;
  sto: number;
  sts: number;
  locationId: string;
  locationName: string;
  position: [number, number, number];
  currentAction: AgentActionType;
  targetId: string;
  targetLabel: string;
  thought: string;
  lastSay: string;
  status: 'idle' | 'thinking' | 'acting' | 'error';
  errorMessage?: string;
}

export interface AgentDecisionResponse {
  thought: string;
  action: AgentActionType;
  targetId: string;
  targetDensity: DensityLevel;
  say: string;
  structureType?: StructureType;
  commodity?: CommodityId;
  tradeSide?: 'BUY' | 'SELL';
  tradeQty?: number;
  techId?: TechId;
  diplomacyTarget?: FactionId;
  diplomacyStance?: DiplomaticStance;
}

export interface AgentLogEntry {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  colorHex: string;
  action: AgentActionType;
  thought: string;
  say: string;
  targetLabel: string;
  category: 'TACTICAL' | 'EMPIRE' | 'MARKET' | 'DIPLOMACY';
}


