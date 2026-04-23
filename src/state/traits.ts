import { trait } from 'koota';
import type {
  Agent,
  BuildDrag,
  CampaignState,
  CloudSprite,
  ElevatorCar,
  ElevatorShaft,
  FloatingParticle,
  GameNotification,
  InspectionState,
  MacroState,
  OperationsState,
  TowerRoom,
  UiSettings,
} from '@/simulation/types';
import type { VisitCohort, VisitMemoryRecord } from '@/simulation/visitors';

export const TowerTrait = trait({
  rooms: () => [] as TowerRoom[],
  shafts: () => [] as ElevatorShaft[],
  elevators: () => [] as ElevatorCar[],
  agents: () => [] as Agent[],
  particles: () => [] as FloatingParticle[],
  notifications: () => [] as GameNotification[],
  clouds: () => [] as CloudSprite[],
  visits: () => [] as VisitCohort[],
  visitMemories: () => [] as VisitMemoryRecord[],
});

export const EconomyTrait = trait({
  funds: 200_000,
  population: 0,
  activeAgents: 0,
  stars: 1,
  cleanliness: 100,
  lifetimeRent: 0,
  dailyRevenue: 0,
  dailyCosts: 0,
  netRevenue: 0,
  towerValue: 200_000,
  transitPressure: 0,
  servicePressure: 0,
  tenantSatisfaction: 100,
  rentEfficiency: 100,
});

export const CampaignTrait = trait({
  mode: 'campaign' as CampaignState['mode'],
  act: 1 as CampaignState['act'],
  actTitle: 'Empty Lot',
  permits: () => ['foundation'],
  reputation: 30,
  towerIdentity: 'unformed' as CampaignState['towerIdentity'],
  declaredIdentity: null as CampaignState['declaredIdentity'],
  identityScores: () => ({
    business: 0,
    residential: 0,
    hospitality: 0,
    civic: 0,
    luxury: 0,
    mixedUse: 0,
  }),
  unlockedSystems: () => ['construction', 'transit-basics'],
  activeContracts: () => [] as CampaignState['activeContracts'],
  completedContracts: () => [] as CampaignState['completedContracts'],
  failedContracts: () => [] as CampaignState['failedContracts'],
  reports: () => [] as CampaignState['reports'],
  victory: 'none' as CampaignState['victory'],
  lastReportDay: 1,
  successfulVisits: 0,
  failedVisits: 0,
});

export const MacroTrait = trait({
  districtIdentity: 'unformed' as MacroState['districtIdentity'],
  marketCycle: 'steady' as MacroState['marketCycle'],
  publicTrust: 58,
  businessDemand: 34,
  residentialDemand: 28,
  tourismDemand: 18,
  regulationPressure: 8,
  weatherRisk: 6,
  fame: 0,
  civicPressure: 12,
  scandalRisk: 4,
  cityInfluence: 0,
  skylineStatus: 0,
  lastUpdatedDay: 1,
});

export const OperationsTrait = trait({
  floorCount: 0,
  heightRisk: 0,
  transitTopology: 0,
  serviceCoverage: 0,
  venueCredibility: 0,
  safetyReadiness: 0,
  privacyComfort: 40,
  noiseControl: 70,
  eventReadiness: 0,
  revenueHealth: 0,
  operationalGrade: 0,
  floorBands: () => [] as OperationsState['floorBands'],
});

export const ClockTrait = trait({
  tick: 500,
  day: 1,
  speed: 0 as 0 | 1 | 4,
  rngSeed: 0x5eed_4104,
});

export const ViewTrait = trait({
  selectedTool: null as import('@/simulation/types').BuildingId | null,
  lensMode: 'normal' as import('@/simulation/types').LensMode,
  panX: 0,
  panY: 150,
  zoom: 1,
  tutorialStep: 0,
});

export const SettingsTrait = trait({
  audio: () => ({ proceduralVolume: 0.55, sampleVolume: 0.75, muted: false }),
  accessibility: () => ({ highContrast: false, reducedMotion: false }),
  ui: () =>
    ({
      displayScale: 1,
      inputHints: true,
      diagnosticsVisible: true,
      safeAreaMode: 'auto',
    }) as UiSettings,
});

export const BuildDragTrait = trait({ drag: () => null as BuildDrag | null });
export const InspectionTrait = trait({ selection: () => null as InspectionState['selection'] });
export const PhaseTrait = trait({ phase: 'menu' as 'menu' | 'playing' });
