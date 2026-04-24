import type { BuildingId, TowerIdentity } from './types';

export const SAVE_SCHEMA_VERSION = 1;

export const PRODUCTION_RELEASE = {
  name: 'Reach for the Sky',
  version: '1.1.5', // x-release-please-version
  releaseChannel: 'production',
  contentVersion: '2026.04-production-1',
  targets: ['web', 'android'],
  saveSchemaVersion: SAVE_SCHEMA_VERSION,
} as const;

export const PRODUCTION_BUDGETS = {
  targetFps: 55,
  maxSavedEvents: 2_000,
  maxRecentDiagnosticsEvents: 8,
  maxVisitMemories: 24,
  maxPublicVisits: 12,
  maxAgents: 420,
  firstLoopMinutes: 10,
  firstLandmarkMinutes: 45,
  campaignHours: [3, 6],
} as const;

export type ScenarioId = 'opening' | 'skyline' | 'weather' | 'recovery';

export interface ScenarioCardContent {
  id: ScenarioId;
  title: string;
  description: string;
  preview: string;
  actFocus: number;
}

export const SCENARIO_CARDS: readonly ScenarioCardContent[] = [
  {
    id: 'opening',
    title: 'Working Tower',
    description: 'Queues, rent, daily reports, and the first hard operating diagnosis.',
    preview: 'assets/previews/opening-desktop.png',
    actFocus: 2,
  },
  {
    id: 'skyline',
    title: 'Skyline Charter',
    description: 'A recognized landmark with public memory and rotating city mandates.',
    preview: 'assets/previews/skyline-victory-desktop.png',
    actFocus: 5,
  },
  {
    id: 'weather',
    title: 'Weather Front',
    description: 'Height risk, storm pressure, safety readiness, and skyline atmosphere.',
    preview: 'assets/previews/weather-stress-desktop.png',
    actFocus: 5,
  },
  {
    id: 'recovery',
    title: 'Public Recovery',
    description: 'A damaged reputation turned into targeted repair contracts.',
    preview: 'assets/previews/recovery-contract-desktop.png',
    actFocus: 4,
  },
] as const;

export interface CampaignActContent {
  act: 1 | 2 | 3 | 4 | 5;
  title: string;
  playerPromise: string;
  unlocks: readonly string[];
}

export const CAMPAIGN_ACT_REGISTRY: readonly CampaignActContent[] = [
  {
    act: 1,
    title: 'Empty Lot',
    playerPromise: 'Teach core construction, first tenants, and first vertical transit.',
    unlocks: ['lobby', 'floor', 'office', 'elevator', 'maintenance pressure'],
  },
  {
    act: 2,
    title: 'Working Tower',
    playerPromise: 'Expose queues, dirt, daily reports, rent efficiency, and service coverage.',
    unlocks: ['daily reports', 'service rooms', 'public diagnosis'],
  },
  {
    act: 3,
    title: 'District Player',
    playerPromise: 'Force an explicit tower identity choice with real demand tradeoffs.',
    unlocks: ['identity declaration', 'venues', 'macro demand'],
  },
  {
    act: 4,
    title: 'Public Landmark',
    playerPromise: 'Turn reputation into public visits, scrutiny, failures, and recovery.',
    unlocks: ['cohorts', 'public memory', 'recovery contracts'],
  },
  {
    act: 5,
    title: 'Reach For The Sky',
    playerPromise: 'Win through height, legitimacy, resilience, and a coherent public role.',
    unlocks: ['skyline charter', 'weather pressure', 'campaign-backed sandbox'],
  },
] as const;

export interface RoomUnlockContent {
  room: BuildingId;
  act: CampaignActContent['act'];
  identityBias: TowerIdentity | 'all';
  productionRole: string;
}

export const ROOM_UNLOCK_REGISTRY: readonly RoomUnlockContent[] = [
  { room: 'lobby', act: 1, identityBias: 'all', productionRole: 'public threshold' },
  { room: 'floor', act: 1, identityBias: 'all', productionRole: 'buildable structure' },
  { room: 'office', act: 1, identityBias: 'business', productionRole: 'daily rent anchor' },
  { room: 'elevator', act: 1, identityBias: 'all', productionRole: 'vertical transit spine' },
  { room: 'maint', act: 2, identityBias: 'all', productionRole: 'cleanliness recovery' },
  { room: 'cafe', act: 2, identityBias: 'hospitality', productionRole: 'service income and dwell' },
  { room: 'condo', act: 3, identityBias: 'residential', productionRole: 'resident demand' },
  { room: 'hotel', act: 3, identityBias: 'hospitality', productionRole: 'visitor lodging' },
  { room: 'utilities', act: 3, identityBias: 'all', productionRole: 'operations stability' },
  { room: 'restroom', act: 3, identityBias: 'all', productionRole: 'public comfort' },
  { room: 'security', act: 4, identityBias: 'civic', productionRole: 'visit safety and privacy' },
  { room: 'conference', act: 4, identityBias: 'business', productionRole: 'delegation hosting' },
  { room: 'eventHall', act: 4, identityBias: 'hospitality', productionRole: 'public event anchor' },
  { room: 'retail', act: 4, identityBias: 'mixed-use', productionRole: 'public commerce' },
  { room: 'skyGarden', act: 4, identityBias: 'civic', productionRole: 'noise/privacy buffer' },
  { room: 'clinic', act: 4, identityBias: 'civic', productionRole: 'safety readiness' },
  { room: 'gallery', act: 4, identityBias: 'civic', productionRole: 'cultural credibility' },
  { room: 'mechanical', act: 5, identityBias: 'all', productionRole: 'height resilience' },
  { room: 'observation', act: 5, identityBias: 'luxury', productionRole: 'skyline credibility' },
  { room: 'luxurySuite', act: 5, identityBias: 'luxury', productionRole: 'prestige hosting' },
  { room: 'weatherCore', act: 5, identityBias: 'all', productionRole: 'weather mitigation' },
] as const;

export function isScenarioId(value: string | null): value is ScenarioId {
  return SCENARIO_CARDS.some((scenario) => scenario.id === value);
}
