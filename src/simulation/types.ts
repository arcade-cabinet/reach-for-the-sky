import type { VisitCohort, VisitMemoryRecord } from './visitors';

export const CELL_SIZE = { w: 32, h: 24 } as const;
export const TICK_RATE = 1_000 / 30;
export const DAY_TICKS = 2_000;
export const STARTING_FUNDS = 200_000;

export type BuildingId =
  | 'lobby'
  | 'floor'
  | 'elevator'
  | 'stairs'
  | 'office'
  | 'condo'
  | 'cafe'
  | 'hotel'
  | 'maint'
  | 'utilities'
  | 'restroom'
  | 'security'
  | 'mechanical'
  | 'eventHall'
  | 'retail'
  | 'skyGarden'
  | 'observation'
  | 'conference'
  | 'clinic'
  | 'gallery'
  | 'luxurySuite'
  | 'weatherCore';

export type BuildingCategory = 'infra' | 'trans' | 'room' | 'com' | 'fac' | 'amenity' | 'utility';
export type DragMode = 'area' | 'v';
export type LensMode =
  | 'normal'
  | 'maintenance'
  | 'transit'
  | 'value'
  | 'sentiment'
  | 'privacy'
  | 'safety'
  | 'event';
export type AgentState =
  | 'idle'
  | 'walking'
  | 'waiting'
  | 'riding'
  | 'working'
  | 'eating'
  | 'sleeping'
  | 'cleaning'
  | 'visiting';
export type AgentType = 'worker' | 'guest' | 'janitor' | 'visitor';
export type AgentPersonality =
  | 'punctual'
  | 'social'
  | 'comfort'
  | 'impatient'
  | 'diligent'
  | 'status'
  | 'civic'
  | 'quiet';
export type AgentIntent = 'idle' | 'work' | 'eat' | 'exit' | 'clean' | 'visit';
export type ElevatorState = 'idle' | 'moving' | 'open';
export type NotificationType = 'info' | 'success' | 'warning';

export interface BuildingDef {
  id: BuildingId;
  cat: BuildingCategory;
  name: string;
  cost: number;
  color: string;
  drag: DragMode;
  width?: number;
  pop?: number;
  rent?: number;
  sale?: number;
  income?: number;
  cap?: number;
  speed?: number;
  kind?:
    | 'work'
    | 'home'
    | 'food'
    | 'sleep'
    | 'service'
    | 'utility'
    | 'sanitation'
    | 'security'
    | 'event'
    | 'retail'
    | 'green'
    | 'observation'
    | 'health'
    | 'culture'
    | 'luxury'
    | 'weather';
}

export interface StarRequirement {
  pop: number;
  funds: number;
  reward: number;
  title: string;
}

export interface TowerRoom {
  id: string;
  type: BuildingId;
  x: number;
  y: number;
  width: number;
  height: number;
  dirt: number;
  seed: number;
}

export interface ElevatorShaft {
  id: string;
  x: number;
  min: number;
  max: number;
}

export interface ElevatorCar {
  id: string;
  shaftId: string;
  x: number;
  y: number;
  floor: number;
  min: number;
  max: number;
  state: ElevatorState;
  riders: string[];
  timer: number;
  targetY: number | null;
}

export interface Agent {
  id: string;
  type: AgentType;
  x: number;
  y: number;
  floor: number;
  targetX: number;
  targetFloor: number;
  targetId: string;
  state: AgentState;
  color: string;
  seed: number;
  personality: AgentPersonality;
  intent?: AgentIntent;
  elevatorId?: string;
  transitFloor?: number;
  returnToId?: string;
  hadLunch?: boolean;
  jobTimer?: number;
  waitTicks?: number;
  route?: NavigationWaypoint[];
  routeIndex?: number;
  routeTargetId?: string;
  routeStatus?: 'planned' | 'blocked';
  cohortId?: string;
}

export interface NavigationWaypoint {
  x: number;
  floor: number;
  node: number;
  kind: 'corridor' | 'lobby' | 'shaft';
}

export interface FloatingParticle {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  floatSpeed: number;
}

export interface GameNotification {
  id: string;
  text: string;
  type: NotificationType;
  time: number;
}

export interface CloudSprite {
  id: string;
  x: number;
  y: number;
  speed: number;
  scale: number;
  opacity: number;
}

export interface TowerState {
  rooms: TowerRoom[];
  shafts: ElevatorShaft[];
  elevators: ElevatorCar[];
  agents: Agent[];
  particles: FloatingParticle[];
  notifications: GameNotification[];
  clouds: CloudSprite[];
  visits: VisitCohort[];
  visitMemories: VisitMemoryRecord[];
}

export interface EconomyState {
  funds: number;
  population: number;
  activeAgents: number;
  stars: number;
  cleanliness: number;
  lifetimeRent: number;
  dailyRevenue: number;
  dailyCosts: number;
  netRevenue: number;
  towerValue: number;
  transitPressure: number;
  servicePressure: number;
  tenantSatisfaction: number;
  rentEfficiency: number;
}

export type TowerIdentity =
  | 'unformed'
  | 'business'
  | 'residential'
  | 'hospitality'
  | 'civic'
  | 'luxury'
  | 'mixed-use';

export interface TowerIdentityScores {
  business: number;
  residential: number;
  hospitality: number;
  civic: number;
  luxury: number;
  mixedUse: number;
}

export type CampaignContractKind = 'campaign' | 'reactive' | 'event';
export type ContractStatus = 'active' | 'completed' | 'failed';
export type ContractMetric =
  | 'room-count'
  | 'population'
  | 'daily-revenue'
  | 'tenant-satisfaction'
  | 'transit-pressure'
  | 'service-pressure'
  | 'cleanliness'
  | 'operations-grade'
  | 'identity-score'
  | 'public-trust'
  | 'fame'
  | 'skyline-status'
  | 'height'
  | 'venue-credibility'
  | 'event-readiness'
  | 'safety-readiness'
  | 'privacy-comfort'
  | 'noise-control'
  | 'weather-risk'
  | 'scandal-risk'
  | 'regulation-pressure'
  | 'city-influence'
  | 'declared-identity'
  | 'successful-visits'
  | 'funds'
  | 'tower-value';

export interface ContractObjective {
  id: string;
  label: string;
  metric: ContractMetric;
  target: number;
  value: number;
  direction: 'at-least' | 'at-most';
  roomType?: BuildingId;
  identity?: TowerIdentity;
  complete: boolean;
}

export type ContractPressure = 'low' | 'medium' | 'high';

export interface GameContract {
  id: string;
  kind: CampaignContractKind;
  act: number;
  title: string;
  brief: string;
  deadlineDay: number | null;
  rewardFunds: number;
  rewardTrust: number;
  penaltyTrust: number;
  status: ContractStatus;
  objectives: ContractObjective[];
  score: number;
  pressure: ContractPressure;
  createdDay: number;
  completedDay?: number;
  failedDay?: number;
  source?: string;
}

export interface DailyReport {
  id: string;
  day: number;
  title: string;
  revenue: number;
  costs: number;
  netRevenue: number;
  sentiment: number;
  cleanliness: number;
  queuePressure: number;
  dirtBurden: number;
  transitPressure: number;
  servicePressure: number;
  publicTrust: number;
  fame: number;
  identity: TowerIdentity;
  reputationDelta: number;
  notes: string[];
  nextRisks: string[];
}

export interface CampaignState {
  mode: 'campaign' | 'sandbox';
  act: 1 | 2 | 3 | 4 | 5;
  actTitle: string;
  permits: string[];
  reputation: number;
  towerIdentity: TowerIdentity;
  declaredIdentity: TowerIdentity | null;
  identityScores: TowerIdentityScores;
  unlockedSystems: string[];
  activeContracts: GameContract[];
  completedContracts: GameContract[];
  failedContracts: GameContract[];
  reports: DailyReport[];
  victory: 'none' | 'won';
  lastReportDay: number;
  successfulVisits: number;
  failedVisits: number;
}

export interface MacroState {
  districtIdentity: TowerIdentity;
  marketCycle: 'soft' | 'steady' | 'boom' | 'correction';
  publicTrust: number;
  businessDemand: number;
  residentialDemand: number;
  tourismDemand: number;
  regulationPressure: number;
  weatherRisk: number;
  fame: number;
  civicPressure: number;
  scandalRisk: number;
  cityInfluence: number;
  skylineStatus: number;
  lastUpdatedDay: number;
}

export interface FloorBandOperations {
  label: string;
  minFloor: number;
  maxFloor: number;
  dominantUse: string;
  pressure: number;
}

export interface OperationsState {
  floorCount: number;
  heightRisk: number;
  transitTopology: number;
  serviceCoverage: number;
  venueCredibility: number;
  safetyReadiness: number;
  privacyComfort: number;
  noiseControl: number;
  eventReadiness: number;
  revenueHealth: number;
  operationalGrade: number;
  floorBands: FloorBandOperations[];
}

export interface InspectionContext {
  source: 'public-story';
  memoryLabel: string;
  pressureReason: string | null;
  headline: string;
  metricLabel: string;
  metricValue: string;
  diagnostic: string;
  recommendation: string;
}

export interface InspectionTarget {
  id: string;
  kind: 'empty' | 'room' | 'agent' | 'elevator';
  title: string;
  subtitle: string;
  details: string[];
  warnings: string[];
  context?: InspectionContext;
  x: number;
  y: number;
}

export interface InspectionState {
  selection: InspectionTarget | null;
}

export interface ClockState {
  tick: number;
  day: number;
  speed: 0 | 1 | 4;
  rngSeed: number;
}

export interface ViewState {
  selectedTool: BuildingId | null;
  lensMode: LensMode;
  panX: number;
  panY: number;
  zoom: number;
  tutorialStep: number;
}

export interface AudioSettings {
  proceduralVolume: number;
  sampleVolume: number;
  muted: boolean;
}

export interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
}

export interface UiSettings {
  displayScale: number;
  inputHints: boolean;
  diagnosticsVisible: boolean;
  safeAreaMode: 'auto' | 'compact';
}

export interface GameSettings {
  audio: AudioSettings;
  accessibility: AccessibilitySettings;
  ui: UiSettings;
}

export interface BuildDrag {
  start: GridCell;
  end: GridCell;
}

export interface GridCell {
  gx: number;
  gy: number;
}

export interface BuildPreviewItem {
  x: number;
  y: number;
  width: number;
  height: number;
  valid: boolean;
  reason: string;
}

export interface BuildPreview {
  items: BuildPreviewItem[];
  valid: boolean;
  error: string | null;
  cost: number;
  saleProfit: number;
}

export interface PlaceBuildResult {
  ok: boolean;
  message: string;
  tower: TowerState;
  economy: EconomyState;
  tutorialStep: number;
}

export interface SimulationSnapshot {
  version: 1;
  savedAt: string;
  tower: TowerState;
  economy: EconomyState;
  clock: ClockState;
  view: ViewState;
  campaign: CampaignState;
  macro: MacroState;
  operations: OperationsState;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  lobby: { id: 'lobby', cat: 'infra', name: 'Lobby', cost: 1_500, color: '#9FB0B5', drag: 'area' },
  floor: { id: 'floor', cat: 'infra', name: 'Floor', cost: 500, color: '#394650', drag: 'area' },
  elevator: {
    id: 'elevator',
    cat: 'trans',
    name: 'Elevator',
    cost: 25_000,
    color: '#9F5A52',
    drag: 'v',
    speed: 10,
    cap: 20,
  },
  stairs: {
    id: 'stairs',
    cat: 'trans',
    name: 'Stairs',
    cost: 1_000,
    color: '#7B6A5C',
    drag: 'v',
    speed: 2,
    cap: 50,
  },
  office: {
    id: 'office',
    cat: 'room',
    name: 'Office',
    cost: 12_000,
    width: 2,
    color: '#607F96',
    pop: 6,
    rent: 1_500,
    kind: 'work',
    drag: 'area',
  },
  condo: {
    id: 'condo',
    cat: 'room',
    name: 'Condo',
    cost: 8_000,
    width: 2,
    color: '#6F8270',
    pop: 3,
    sale: 12_000,
    kind: 'home',
    drag: 'area',
  },
  cafe: {
    id: 'cafe',
    cat: 'com',
    name: 'Cafe',
    cost: 15_000,
    width: 3,
    color: '#9B7041',
    cap: 20,
    income: 80,
    kind: 'food',
    drag: 'area',
  },
  hotel: {
    id: 'hotel',
    cat: 'com',
    name: 'Hotel',
    cost: 30_000,
    width: 2,
    color: '#716887',
    cap: 2,
    income: 300,
    kind: 'sleep',
    drag: 'area',
  },
  maint: {
    id: 'maint',
    cat: 'fac',
    name: 'Maint.',
    cost: 15_000,
    width: 2,
    color: '#A49452',
    pop: 2,
    kind: 'service',
    drag: 'area',
  },
  utilities: {
    id: 'utilities',
    cat: 'utility',
    name: 'Utilities',
    cost: 18_000,
    width: 2,
    color: '#687987',
    kind: 'utility',
    drag: 'area',
  },
  restroom: {
    id: 'restroom',
    cat: 'amenity',
    name: 'Restroom',
    cost: 6_000,
    width: 1,
    color: '#7C9091',
    kind: 'sanitation',
    drag: 'area',
  },
  security: {
    id: 'security',
    cat: 'fac',
    name: 'Security',
    cost: 22_000,
    width: 2,
    color: '#6B6D7E',
    pop: 2,
    kind: 'security',
    drag: 'area',
  },
  mechanical: {
    id: 'mechanical',
    cat: 'utility',
    name: 'Mechanical',
    cost: 20_000,
    width: 2,
    color: '#5F6B67',
    kind: 'utility',
    drag: 'area',
  },
  eventHall: {
    id: 'eventHall',
    cat: 'com',
    name: 'Event Hall',
    cost: 45_000,
    width: 4,
    color: '#856B5B',
    cap: 60,
    income: 160,
    kind: 'event',
    drag: 'area',
  },
  retail: {
    id: 'retail',
    cat: 'com',
    name: 'Retail',
    cost: 22_000,
    width: 2,
    color: '#81755B',
    cap: 25,
    income: 110,
    kind: 'retail',
    drag: 'area',
  },
  skyGarden: {
    id: 'skyGarden',
    cat: 'amenity',
    name: 'Sky Garden',
    cost: 35_000,
    width: 3,
    color: '#667B62',
    kind: 'green',
    drag: 'area',
  },
  observation: {
    id: 'observation',
    cat: 'com',
    name: 'Observation',
    cost: 80_000,
    width: 4,
    color: '#7D826F',
    cap: 100,
    income: 250,
    kind: 'observation',
    drag: 'area',
  },
  conference: {
    id: 'conference',
    cat: 'com',
    name: 'Conference',
    cost: 36_000,
    width: 3,
    color: '#6F7789',
    cap: 45,
    income: 130,
    kind: 'event',
    drag: 'area',
  },
  clinic: {
    id: 'clinic',
    cat: 'fac',
    name: 'Clinic',
    cost: 30_000,
    width: 2,
    color: '#6B8580',
    pop: 4,
    kind: 'health',
    drag: 'area',
  },
  gallery: {
    id: 'gallery',
    cat: 'com',
    name: 'Gallery',
    cost: 42_000,
    width: 3,
    color: '#857176',
    cap: 40,
    income: 120,
    kind: 'culture',
    drag: 'area',
  },
  luxurySuite: {
    id: 'luxurySuite',
    cat: 'room',
    name: 'Luxury Suite',
    cost: 55_000,
    width: 3,
    color: '#8A7A61',
    pop: 2,
    sale: 75_000,
    kind: 'luxury',
    drag: 'area',
  },
  weatherCore: {
    id: 'weatherCore',
    cat: 'utility',
    name: 'Weather Core',
    cost: 60_000,
    width: 2,
    color: '#647D8A',
    kind: 'weather',
    drag: 'area',
  },
};

export const STAR_REQUIREMENTS: Record<number, StarRequirement> = {
  1: { pop: 0, funds: 0, reward: 0, title: 'Empty Lot' },
  2: { pop: 15, funds: 100_000, reward: 50_000, title: 'Local Business Hub' },
  3: { pop: 40, funds: 250_000, reward: 100_000, title: 'Rising Skyscraper' },
  4: { pop: 100, funds: 500_000, reward: 250_000, title: 'Metropolitan Landmark' },
  5: { pop: 250, funds: 1_000_000, reward: 1_000_000, title: 'Executive Mega-Tower' },
};
