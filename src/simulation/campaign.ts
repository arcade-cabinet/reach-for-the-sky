import { getHour } from './time';
import {
  BUILDINGS,
  type BuildingId,
  type CampaignState,
  type ClockState,
  type ContractObjective,
  type ContractPressure,
  type DailyReport,
  type EconomyState,
  type FloorBandOperations,
  type GameContract,
  type MacroState,
  type OperationsState,
  type TowerIdentity,
  type TowerIdentityScores,
  type TowerRoom,
  type TowerState,
} from './types';
import type { VisitMemoryRecord } from './visitors';

interface ObjectiveDraft {
  id: string;
  label: string;
  metric: ContractObjective['metric'];
  target: number;
  direction: ContractObjective['direction'];
  roomType?: BuildingId;
  identity?: TowerIdentity;
}

interface ContractBlueprint {
  id: string;
  act: CampaignState['act'];
  title: string;
  brief: string;
  deadlineOffset: number | null;
  rewardFunds: number;
  penaltyTrust: number;
  objectives: ObjectiveDraft[];
  unlocks: string[];
  permit: string;
}

interface GameSpineInput {
  tower: TowerState;
  economy: EconomyState;
  clock: ClockState;
  campaign: CampaignState;
  macro: MacroState;
  operations: OperationsState;
  events: string[];
}

export interface GameSpineResult {
  tower: TowerState;
  economy: EconomyState;
  campaign: CampaignState;
  macro: MacroState;
  operations: OperationsState;
  events: string[];
}

const ACT_TITLES: Record<CampaignState['act'], string> = {
  1: 'Empty Lot',
  2: 'Working Tower',
  3: 'District Player',
  4: 'Public Landmark',
  5: 'Reach For The Sky',
};

const CAMPAIGN_BLUEPRINTS: ContractBlueprint[] = [
  {
    id: 'act-1-viable-core',
    act: 1,
    title: 'First Viable Core',
    brief:
      'Create a readable, working tower spine before the city lets serious tenants sign leases.',
    deadlineOffset: null,
    rewardFunds: 25_000,
    penaltyTrust: 0,
    permit: 'working-core',
    unlocks: ['daily-report', 'operations-brief'],
    objectives: [
      {
        id: 'lobby',
        label: 'Ground lobby',
        metric: 'room-count',
        roomType: 'lobby',
        target: 1,
        direction: 'at-least',
      },
      {
        id: 'floors',
        label: 'Four rentable floor bays',
        metric: 'room-count',
        roomType: 'floor',
        target: 4,
        direction: 'at-least',
      },
      {
        id: 'office',
        label: 'Anchor office suite',
        metric: 'room-count',
        roomType: 'office',
        target: 1,
        direction: 'at-least',
      },
      {
        id: 'elevator',
        label: 'Working elevator core',
        metric: 'room-count',
        roomType: 'elevator',
        target: 1,
        direction: 'at-least',
      },
    ],
  },
  {
    id: 'act-2-stable-operations',
    act: 2,
    title: 'Stable Operations',
    brief:
      'A tower is not a stack of rentable rooms. Prove it can move, clean, and pay for itself.',
    deadlineOffset: 5,
    rewardFunds: 55_000,
    penaltyTrust: 8,
    permit: 'operations-permit',
    unlocks: ['reactive-contracts', 'service-lens', 'sentiment-lens'],
    objectives: [
      {
        id: 'population',
        label: '24 committed occupants',
        metric: 'population',
        target: 24,
        direction: 'at-least',
      },
      {
        id: 'revenue',
        label: '$3k daily yield',
        metric: 'daily-revenue',
        target: 3_000,
        direction: 'at-least',
      },
      {
        id: 'cleanliness',
        label: '75% cleanliness',
        metric: 'cleanliness',
        target: 75,
        direction: 'at-least',
      },
      {
        id: 'transit',
        label: 'Transit pressure under 60%',
        metric: 'transit-pressure',
        target: 60,
        direction: 'at-most',
      },
      {
        id: 'maint',
        label: 'Maintenance office',
        metric: 'room-count',
        roomType: 'maint',
        target: 1,
        direction: 'at-least',
      },
    ],
  },
  {
    id: 'act-3-tower-identity',
    act: 3,
    title: 'Declare An Identity',
    brief:
      'Specialize the tower so the district starts reacting to what this building actually is.',
    deadlineOffset: 8,
    rewardFunds: 90_000,
    penaltyTrust: 10,
    permit: 'district-profile',
    unlocks: ['event-contracts', 'macro-brief', 'event-lens'],
    objectives: [
      {
        id: 'identity',
        label: 'Clear tower identity',
        metric: 'identity-score',
        target: 45,
        direction: 'at-least',
      },
      {
        id: 'declared',
        label: 'Declare tower identity',
        metric: 'declared-identity',
        target: 1,
        direction: 'at-least',
      },
      {
        id: 'venue',
        label: 'Credible public venue',
        metric: 'venue-credibility',
        target: 35,
        direction: 'at-least',
      },
      {
        id: 'sentiment',
        label: '70% tenant sentiment',
        metric: 'tenant-satisfaction',
        target: 70,
        direction: 'at-least',
      },
      {
        id: 'visit',
        label: 'One successful public visit',
        metric: 'successful-visits',
        target: 1,
        direction: 'at-least',
      },
    ],
  },
  {
    id: 'act-4-public-landmark',
    act: 4,
    title: 'Public Landmark',
    brief:
      'Public attention is now part of operations. Keep the tower legitimate while people flood it.',
    deadlineOffset: 12,
    rewardFunds: 175_000,
    penaltyTrust: 14,
    permit: 'landmark-review',
    unlocks: ['safety-lens', 'prestige-venues', 'weather-risk'],
    objectives: [
      { id: 'fame', label: '45 fame', metric: 'fame', target: 45, direction: 'at-least' },
      {
        id: 'trust',
        label: '60 public trust',
        metric: 'public-trust',
        target: 60,
        direction: 'at-least',
      },
      {
        id: 'events',
        label: '55 event readiness',
        metric: 'event-readiness',
        target: 55,
        direction: 'at-least',
      },
      {
        id: 'visits',
        label: 'Two successful public visits',
        metric: 'successful-visits',
        target: 2,
        direction: 'at-least',
      },
    ],
  },
  {
    id: 'act-5-skyline-institution',
    act: 5,
    title: 'Skyline Institution',
    brief: 'Reach for the sky without becoming an unsafe, hated, bankrupt monument to ego.',
    deadlineOffset: null,
    rewardFunds: 500_000,
    penaltyTrust: 0,
    permit: 'skyline-charter',
    unlocks: ['sandbox-city-cycle'],
    objectives: [
      {
        id: 'height',
        label: '18 occupied floors',
        metric: 'height',
        target: 18,
        direction: 'at-least',
      },
      {
        id: 'skyline',
        label: '70 skyline status',
        metric: 'skyline-status',
        target: 70,
        direction: 'at-least',
      },
      {
        id: 'trust',
        label: '65 public trust',
        metric: 'public-trust',
        target: 65,
        direction: 'at-least',
      },
      {
        id: 'operations',
        label: '65 operations grade',
        metric: 'operations-grade',
        target: 65,
        direction: 'at-least',
      },
      {
        id: 'funds',
        label: '$750k treasury',
        metric: 'funds',
        target: 750_000,
        direction: 'at-least',
      },
    ],
  },
];

const IDENTITY_KEYS = ['business', 'residential', 'hospitality', 'civic', 'luxury'] as const;
const MAX_REACTIVE_CONTRACTS = 8;
const SANDBOX_CONTRACT_DEADLINE_DAYS = 7;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function roomCount(tower: TowerState, type: BuildingId): number {
  return tower.rooms.filter((room) => room.type === type).length;
}

function maxFloor(tower: TowerState): number {
  return tower.rooms.reduce((top, room) => Math.max(top, room.y + room.height - 1), 0);
}

function countAny(tower: TowerState, types: BuildingId[]): number {
  return tower.rooms.filter((room) => types.includes(room.type)).length;
}

function hasPermit(campaign: CampaignState, permit: string): boolean {
  return campaign.permits.includes(permit);
}

function pushNotice(tower: TowerState, text: string, type: 'info' | 'success' | 'warning'): void {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 28);
  tower.notifications = [
    ...tower.notifications,
    { id: `campaign-${tower.notifications.length}-${slug}`, text, type, time: 340 },
  ].slice(-5);
}

function objective(draft: ObjectiveDraft): ContractObjective {
  return { ...draft, value: 0, complete: false };
}

function objectiveScore(objective: ContractObjective): number {
  if (objective.target <= 0) return objective.complete ? 100 : 0;
  if (objective.direction === 'at-least') return clamp((objective.value / objective.target) * 100);
  if (objective.value <= objective.target) return 100;
  return clamp((objective.target / Math.max(1, objective.value)) * 100);
}

function contractScore(objectives: ContractObjective[]): number {
  if (objectives.length === 0) return 100;
  const score = objectives.reduce((total, objective) => total + objectiveScore(objective), 0);
  return Math.round(score / objectives.length);
}

function contractPressure(contract: GameContract, score: number, day: number): ContractPressure {
  if (contract.status === 'completed') return 'low';
  if (contract.status === 'failed') return 'high';
  if (contract.deadlineDay === null) return score < 45 ? 'medium' : 'low';
  const daysLeft = contract.deadlineDay - day;
  if (daysLeft < 0) return 'high';
  if (daysLeft <= 1 && score < 90) return 'high';
  if (daysLeft <= 2 && score < 70) return 'high';
  if (daysLeft <= 3 && score < 85) return 'medium';
  if (score < 40) return 'medium';
  return 'low';
}

function normalizeContract(contract: GameContract, day = 1): GameContract {
  const score = contract.score ?? contractScore(contract.objectives);
  return {
    ...contract,
    rewardTrust: contract.rewardTrust ?? 0,
    score,
    pressure: contract.pressure ?? contractPressure(contract, score, day),
  };
}

function instantiateContract(blueprint: ContractBlueprint, day: number): GameContract {
  const contract: GameContract = {
    id: blueprint.id,
    kind: 'campaign',
    act: blueprint.act,
    title: blueprint.title,
    brief: blueprint.brief,
    deadlineDay: blueprint.deadlineOffset === null ? null : day + blueprint.deadlineOffset,
    rewardFunds: blueprint.rewardFunds,
    rewardTrust: 0,
    penaltyTrust: blueprint.penaltyTrust,
    status: 'active',
    objectives: blueprint.objectives.map(objective),
    score: 0,
    pressure: 'low',
    createdDay: day,
  };
  return normalizeContract(contract, day);
}

function sandboxContractSequence(campaign: CampaignState): number {
  return [
    ...campaign.activeContracts,
    ...campaign.completedContracts,
    ...campaign.failedContracts,
  ].filter((contract) => contract.source === 'sandbox').length;
}

function sandboxVisitObjective(campaign: CampaignState, label: string): ObjectiveDraft {
  return {
    id: 'public-outcome',
    label,
    metric: 'successful-visits',
    target: campaign.successfulVisits + 1,
    direction: 'at-least',
  };
}

function sandboxCityCycleContract(
  campaign: CampaignState,
  economy: EconomyState,
  macro: MacroState,
  operations: OperationsState,
  day: number,
): GameContract {
  const sequence = sandboxContractSequence(campaign) + 1;
  const idPrefix = `sandbox-city-cycle-${day}-${sequence}`;
  let title = 'Civic Calendar Mandate';
  let brief =
    'The tower is no longer proving it can exist. It is proving it can remain useful to the city while attention keeps rotating.';
  let rewardFunds = 90_000;
  let rewardTrust = 4;
  let penaltyTrust = 8;
  let objectives: ObjectiveDraft[] = [
    {
      id: 'influence',
      label: '80 city influence',
      metric: 'city-influence',
      target: 80,
      direction: 'at-least',
    },
    {
      id: 'event-ready',
      label: '70 event readiness',
      metric: 'event-readiness',
      target: 70,
      direction: 'at-least',
    },
    sandboxVisitObjective(campaign, 'Host one successful public outcome'),
  ];

  if (macro.weatherRisk >= 55 || operations.heightRisk >= 55) {
    title = 'Weather Resilience Charter';
    brief =
      'The skyline now makes its own weather story. Show the city that height, safety, and public hosting can coexist.';
    rewardFunds = 115_000;
    rewardTrust = 5;
    penaltyTrust = 10;
    objectives = [
      {
        id: 'weather-risk',
        label: 'Weather risk under 55%',
        metric: 'weather-risk',
        target: 55,
        direction: 'at-most',
      },
      {
        id: 'safety',
        label: '72 safety readiness',
        metric: 'safety-readiness',
        target: 72,
        direction: 'at-least',
      },
      {
        id: 'weather-core',
        label: 'Weather core online',
        metric: 'room-count',
        roomType: 'weatherCore',
        target: 1,
        direction: 'at-least',
      },
      sandboxVisitObjective(campaign, 'Host one calm visit during weather scrutiny'),
    ];
  } else if (economy.transitPressure >= 58 || operations.transitTopology < 70) {
    title = 'Keep The City Moving';
    brief =
      'The public now judges the institution by whether crowds move cleanly through it. Clear the core before queue folklore becomes civic memory.';
    rewardFunds = 100_000;
    rewardTrust = 4;
    penaltyTrust = 9;
    objectives = [
      {
        id: 'transit-pressure',
        label: 'Transit pressure under 55%',
        metric: 'transit-pressure',
        target: 55,
        direction: 'at-most',
      },
      {
        id: 'operations',
        label: '75 operations grade',
        metric: 'operations-grade',
        target: 75,
        direction: 'at-least',
      },
      sandboxVisitObjective(campaign, 'Host one crowd without a queue story'),
    ];
  } else if (macro.scandalRisk >= 42 || macro.regulationPressure >= 55) {
    title = 'Public Trust Audit';
    brief =
      'Inspectors, press, and neighbors are testing whether the landmark deserves the benefit of the doubt. Keep the visible systems boring.';
    rewardFunds = 95_000;
    rewardTrust = 6;
    penaltyTrust = 11;
    objectives = [
      {
        id: 'trust',
        label: '70 public trust',
        metric: 'public-trust',
        target: 70,
        direction: 'at-least',
      },
      {
        id: 'scandal-risk',
        label: 'Scandal risk under 42%',
        metric: 'scandal-risk',
        target: 42,
        direction: 'at-most',
      },
      {
        id: 'safety',
        label: '70 safety readiness',
        metric: 'safety-readiness',
        target: 70,
        direction: 'at-least',
      },
      sandboxVisitObjective(campaign, 'Host one visit without feeding the audit'),
    ];
  }

  return normalizeContract(
    {
      id: `${idPrefix}-${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}`,
      kind: 'campaign',
      act: 5,
      title,
      brief,
      deadlineDay: day + SANDBOX_CONTRACT_DEADLINE_DAYS,
      rewardFunds,
      rewardTrust,
      penaltyTrust,
      status: 'active',
      objectives: objectives.map(objective),
      score: 0,
      pressure: 'low',
      createdDay: day,
      source: 'sandbox',
    },
    day,
  );
}

function reactiveContract(
  id: string,
  title: string,
  brief: string,
  source: string,
  day: number,
  objectives: ObjectiveDraft[],
): GameContract {
  const contract: GameContract = {
    id,
    kind: source === 'visit' ? 'event' : 'reactive',
    act: 2,
    title,
    brief,
    deadlineDay: day + 3,
    rewardFunds: source === 'visit' ? 22_000 : 18_000,
    rewardTrust: 0,
    penaltyTrust: source === 'visit' ? 8 : 5,
    status: 'active',
    objectives: objectives.map(objective),
    score: 0,
    pressure: 'low',
    createdDay: day,
    source,
  };
  return normalizeContract(contract, day);
}

function recoveryObjectives(contract: GameContract, campaign: CampaignState): ObjectiveDraft[] {
  if (contract.source === 'transit') {
    return [
      {
        id: 'transit-recovered',
        label: 'Transit pressure under 45%',
        metric: 'transit-pressure',
        target: 45,
        direction: 'at-most',
      },
      {
        id: 'ops-recovered',
        label: '60 operations grade',
        metric: 'operations-grade',
        target: 60,
        direction: 'at-least',
      },
    ];
  }
  if (contract.source === 'sanitation') {
    return [
      {
        id: 'clean-recovered',
        label: '86% cleanliness',
        metric: 'cleanliness',
        target: 86,
        direction: 'at-least',
      },
      {
        id: 'service-recovered',
        label: 'Service pressure under 30%',
        metric: 'service-pressure',
        target: 30,
        direction: 'at-most',
      },
    ];
  }
  if (contract.source === 'weather') {
    return [
      {
        id: 'weather-recovered',
        label: 'Weather risk under 52%',
        metric: 'weather-risk',
        target: 52,
        direction: 'at-most',
      },
      {
        id: 'safety-recovered',
        label: '72 safety readiness',
        metric: 'safety-readiness',
        target: 72,
        direction: 'at-least',
      },
    ];
  }
  if (contract.source === 'inspection') {
    return [
      {
        id: 'scandal-recovered',
        label: 'Scandal risk under 38%',
        metric: 'scandal-risk',
        target: 38,
        direction: 'at-most',
      },
      {
        id: 'safety-recovered',
        label: '70 safety readiness',
        metric: 'safety-readiness',
        target: 70,
        direction: 'at-least',
      },
    ];
  }
  if (contract.source === 'visit') {
    return [
      {
        id: 'host-again',
        label: 'Host one better public visit',
        metric: 'successful-visits',
        target: campaign.successfulVisits + 1,
        direction: 'at-least',
      },
      {
        id: 'event-recovered',
        label: '58 event readiness',
        metric: 'event-readiness',
        target: 58,
        direction: 'at-least',
      },
    ];
  }
  return [
    {
      id: 'trust-recovered',
      label: '58 public trust',
      metric: 'public-trust',
      target: 58,
      direction: 'at-least',
    },
    {
      id: 'ops-recovered',
      label: '58 operations grade',
      metric: 'operations-grade',
      target: 58,
      direction: 'at-least',
    },
  ];
}

function recoveryContract(
  contract: GameContract,
  campaign: CampaignState,
  day: number,
): GameContract {
  const source = `recovery-${contract.source ?? contract.id}`;
  const recovery: GameContract = {
    id: `${source}-${day}`,
    kind: 'reactive',
    act: campaign.act,
    title: `Recovery Plan: ${contract.title}`,
    brief:
      'The tower lost public confidence. Repair the visible cause quickly enough that the next report frames this as recovery, not decline.',
    deadlineDay: day + 5,
    rewardFunds: Math.max(8_000, Math.round(contract.rewardFunds * 0.3)),
    rewardTrust: Math.max(4, Math.ceil(contract.penaltyTrust * 0.75)),
    penaltyTrust: 0,
    status: 'active',
    objectives: recoveryObjectives(contract, campaign).map(objective),
    score: 0,
    pressure: 'low',
    createdDay: day,
    source,
  };
  return normalizeContract(recovery, day);
}

function memoryReasonPriority(reason: string): number {
  if (reason === 'queues') return 100;
  if (reason === 'safety') return 94;
  if (reason === 'privacy') return 90;
  if (reason === 'noise') return 86;
  if (reason === 'cleanliness') return 82;
  if (reason === 'service') return 78;
  if (reason === 'weather') return 74;
  return 50;
}

function dominantMemoryReason(memory: VisitMemoryRecord): string | null {
  return (
    [...memory.pressureReasons].sort(
      (a, b) => memoryReasonPriority(b) - memoryReasonPriority(a),
    )[0] ?? null
  );
}

function publicMemoryObjectives(reason: string, campaign: CampaignState): ObjectiveDraft[] {
  const visitObjective: ObjectiveDraft = {
    id: 'repair-visit',
    label: 'Host one better public visit',
    metric: 'successful-visits',
    target: campaign.successfulVisits + 1,
    direction: 'at-least',
  };
  if (reason === 'queues') {
    return [
      {
        id: 'transit',
        label: 'Transit pressure under 50%',
        metric: 'transit-pressure',
        target: 50,
        direction: 'at-most',
      },
      {
        id: 'operations',
        label: '65 operations grade',
        metric: 'operations-grade',
        target: 65,
        direction: 'at-least',
      },
      visitObjective,
    ];
  }
  if (reason === 'cleanliness') {
    return [
      {
        id: 'cleanliness',
        label: '86% cleanliness',
        metric: 'cleanliness',
        target: 86,
        direction: 'at-least',
      },
      {
        id: 'maintenance',
        label: 'Visible maintenance office',
        metric: 'room-count',
        roomType: 'maint',
        target: 1,
        direction: 'at-least',
      },
      visitObjective,
    ];
  }
  if (reason === 'service') {
    return [
      {
        id: 'service',
        label: 'Service pressure under 35%',
        metric: 'service-pressure',
        target: 35,
        direction: 'at-most',
      },
      {
        id: 'operations',
        label: '66 operations grade',
        metric: 'operations-grade',
        target: 66,
        direction: 'at-least',
      },
      visitObjective,
    ];
  }
  if (reason === 'privacy') {
    return [
      {
        id: 'privacy',
        label: '68 privacy comfort',
        metric: 'privacy-comfort',
        target: 68,
        direction: 'at-least',
      },
      {
        id: 'security',
        label: 'Security desk',
        metric: 'room-count',
        roomType: 'security',
        target: 1,
        direction: 'at-least',
      },
      visitObjective,
    ];
  }
  if (reason === 'noise') {
    return [
      {
        id: 'noise',
        label: '68 noise control',
        metric: 'noise-control',
        target: 68,
        direction: 'at-least',
      },
      {
        id: 'quiet-space',
        label: 'Quiet public buffer',
        metric: 'room-count',
        roomType: 'skyGarden',
        target: 1,
        direction: 'at-least',
      },
      visitObjective,
    ];
  }
  if (reason === 'safety') {
    return [
      {
        id: 'safety',
        label: '74 safety readiness',
        metric: 'safety-readiness',
        target: 74,
        direction: 'at-least',
      },
      {
        id: 'security',
        label: 'Security desk',
        metric: 'room-count',
        roomType: 'security',
        target: 1,
        direction: 'at-least',
      },
      visitObjective,
    ];
  }
  if (reason === 'weather') {
    return [
      {
        id: 'weather',
        label: 'Weather risk under 55%',
        metric: 'weather-risk',
        target: 55,
        direction: 'at-most',
      },
      {
        id: 'weather-core',
        label: 'Weather core',
        metric: 'room-count',
        roomType: 'weatherCore',
        target: 1,
        direction: 'at-least',
      },
      visitObjective,
    ];
  }
  return [
    {
      id: 'trust',
      label: '62 public trust',
      metric: 'public-trust',
      target: 62,
      direction: 'at-least',
    },
    {
      id: 'operations',
      label: '64 operations grade',
      metric: 'operations-grade',
      target: 64,
      direction: 'at-least',
    },
    visitObjective,
  ];
}

function publicMemoryRepairTitle(reason: string): string {
  if (reason === 'queues') return 'Public Memory: Queue Story';
  if (reason === 'cleanliness') return 'Public Memory: Cleanliness Story';
  if (reason === 'service') return 'Public Memory: Service Gap';
  if (reason === 'privacy') return 'Public Memory: Privacy Breach';
  if (reason === 'noise') return 'Public Memory: Noise Control';
  if (reason === 'safety') return 'Public Memory: Safety Doubt';
  if (reason === 'weather') return 'Public Memory: Weather Doubt';
  return 'Public Memory Repair';
}

function publicMemoryRepairContract(
  memory: VisitMemoryRecord,
  reason: string,
  campaign: CampaignState,
  day: number,
): GameContract {
  return normalizeContract(
    {
      id: `memory-${reason}-${memory.id}-${day}`,
      kind: 'reactive',
      act: campaign.act,
      title: publicMemoryRepairTitle(reason),
      brief: `${memory.label} left a public story about ${reason}. Fix the visible cause, then host a better group before that memory hardens into reputation.`,
      deadlineDay: day + 4,
      rewardFunds: 32_000,
      rewardTrust: memory.outcome === 'complained' ? 5 : 3,
      penaltyTrust: memory.outcome === 'complained' ? 6 : 4,
      status: 'active',
      objectives: publicMemoryObjectives(reason, campaign).map(objective),
      score: 0,
      pressure: 'low',
      createdDay: day,
      source: `memory-${reason}`,
    },
    day,
  );
}

export function createInitialMacro(): MacroState {
  return {
    districtIdentity: 'unformed',
    marketCycle: 'steady',
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
  };
}

export function createInitialOperations(): OperationsState {
  return {
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
    floorBands: [],
  };
}

export function createInitialCampaign(day = 1): CampaignState {
  return {
    mode: 'campaign',
    act: 1,
    actTitle: ACT_TITLES[1],
    permits: ['foundation'],
    reputation: 30,
    towerIdentity: 'unformed',
    declaredIdentity: null,
    identityScores: {
      business: 0,
      residential: 0,
      hospitality: 0,
      civic: 0,
      luxury: 0,
      mixedUse: 0,
    },
    unlockedSystems: ['construction', 'transit-basics'],
    activeContracts: [instantiateContract(CAMPAIGN_BLUEPRINTS[0], day)],
    completedContracts: [],
    failedContracts: [],
    reports: [],
    victory: 'none',
    lastReportDay: day,
    successfulVisits: 0,
    failedVisits: 0,
  };
}

export function normalizeCampaignState(value: Partial<CampaignState> | undefined): CampaignState {
  const fallback = createInitialCampaign();
  if (!value) return fallback;
  return {
    ...fallback,
    ...value,
    act: value.act ?? fallback.act,
    actTitle: value.actTitle ?? ACT_TITLES[value.act ?? fallback.act],
    permits: value.permits ?? fallback.permits,
    unlockedSystems: value.unlockedSystems ?? fallback.unlockedSystems,
    declaredIdentity: value.declaredIdentity ?? null,
    identityScores: value.identityScores ?? fallback.identityScores,
    activeContracts: (value.activeContracts ?? fallback.activeContracts).map((contract) =>
      normalizeContract(contract, value.lastReportDay ?? fallback.lastReportDay),
    ),
    completedContracts: (value.completedContracts ?? []).map((contract) =>
      normalizeContract(contract, value.lastReportDay ?? fallback.lastReportDay),
    ),
    failedContracts: (value.failedContracts ?? []).map((contract) =>
      normalizeContract(contract, value.lastReportDay ?? fallback.lastReportDay),
    ),
    reports: (value.reports ?? []).map(normalizeDailyReport),
    victory: value.victory ?? 'none',
    lastReportDay: value.lastReportDay ?? fallback.lastReportDay,
    successfulVisits: value.successfulVisits ?? 0,
    failedVisits: value.failedVisits ?? 0,
  };
}

function normalizeDailyReport(report: Partial<DailyReport>): DailyReport {
  const revenue = report.revenue ?? 0;
  const costs = report.costs ?? Math.max(0, Math.round(revenue * 0.22));
  const cleanliness = report.cleanliness ?? 100;
  const transitPressure = report.transitPressure ?? report.queuePressure ?? 0;
  return {
    id: report.id ?? 'legacy-report',
    day: report.day ?? 1,
    title: report.title ?? 'Operations Brief',
    revenue,
    costs,
    netRevenue: report.netRevenue ?? revenue - costs,
    sentiment: report.sentiment ?? 100,
    cleanliness,
    queuePressure: report.queuePressure ?? transitPressure,
    dirtBurden: report.dirtBurden ?? Math.max(0, 100 - cleanliness),
    transitPressure,
    servicePressure: report.servicePressure ?? 0,
    publicTrust: report.publicTrust ?? 58,
    fame: report.fame ?? 0,
    identity: report.identity ?? 'unformed',
    reputationDelta: report.reputationDelta ?? 0,
    notes: report.notes ?? [],
    nextRisks: report.nextRisks ?? [],
  };
}

export function normalizeMacroState(value: Partial<MacroState> | undefined): MacroState {
  return { ...createInitialMacro(), ...value };
}

export function normalizeOperationsState(
  value: Partial<OperationsState> | undefined,
): OperationsState {
  return { ...createInitialOperations(), ...value, floorBands: value?.floorBands ?? [] };
}

export function deriveTowerIdentity(tower: TowerState): {
  primary: TowerIdentity;
  scores: TowerIdentityScores;
} {
  const business = roomCount(tower, 'office') * 12 + roomCount(tower, 'conference') * 14;
  const residential =
    roomCount(tower, 'condo') * 12 +
    roomCount(tower, 'luxurySuite') * 16 +
    roomCount(tower, 'skyGarden') * 7;
  const hospitality =
    roomCount(tower, 'hotel') * 16 +
    roomCount(tower, 'cafe') * 8 +
    roomCount(tower, 'retail') * 12 +
    roomCount(tower, 'eventHall') * 10 +
    roomCount(tower, 'observation') * 16;
  const civic =
    roomCount(tower, 'clinic') * 14 +
    roomCount(tower, 'gallery') * 16 +
    roomCount(tower, 'skyGarden') * 8 +
    roomCount(tower, 'conference') * 6 +
    roomCount(tower, 'restroom') * 3;
  const luxury =
    roomCount(tower, 'luxurySuite') * 18 +
    roomCount(tower, 'observation') * 14 +
    roomCount(tower, 'hotel') * 7 +
    roomCount(tower, 'gallery') * 6 +
    roomCount(tower, 'skyGarden') * 5;
  const activeFamilies = [business, residential, hospitality, civic, luxury].filter(
    (score) => score >= 10,
  ).length;
  const sorted = [business, residential, hospitality, civic, luxury].sort((a, b) => b - a);
  const mixedUse = clamp(activeFamilies * 14 + Math.min(sorted[1] ?? 0, sorted[0] ?? 0) * 0.55);
  const scores: TowerIdentityScores = {
    business: Math.round(clamp(business)),
    residential: Math.round(clamp(residential)),
    hospitality: Math.round(clamp(hospitality)),
    civic: Math.round(clamp(civic)),
    luxury: Math.round(clamp(luxury)),
    mixedUse: Math.round(mixedUse),
  };

  const ranked = IDENTITY_KEYS.map((key) => [key, scores[key]] as const).sort(
    (a, b) => b[1] - a[1],
  );
  const [topKey, topScore] = ranked[0] ?? ['business', 0];
  if (topScore < 20 && scores.mixedUse < 36) return { primary: 'unformed', scores };
  if (activeFamilies >= 3 && scores.mixedUse >= topScore * 0.86)
    return { primary: 'mixed-use', scores };
  return { primary: topKey, scores };
}

function dominantUse(rooms: TowerRoom[]): string {
  if (rooms.length === 0) return 'empty';
  const counts = new Map<string, number>();
  for (const room of rooms) {
    const kind = BUILDINGS[room.type].kind ?? BUILDINGS[room.type].cat;
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mixed';
}

function createFloorBands(tower: TowerState): FloorBandOperations[] {
  const top = maxFloor(tower);
  if (top === 0) return [];
  const bands: FloorBandOperations[] = [];
  for (let min = 0; min <= top; min += 5) {
    const max = Math.min(top, min + 4);
    const rooms = tower.rooms.filter((room) => room.y >= min && room.y <= max);
    if (rooms.length === 0) continue;
    const dirt = rooms.reduce((sum, room) => sum + room.dirt, 0) / rooms.length;
    const utilityGap = rooms.some((room) =>
      ['mechanical', 'utilities', 'weatherCore'].includes(room.type),
    )
      ? 0
      : Math.max(0, min - 6) * 1.7;
    bands.push({
      label: min === 0 ? 'street' : `${min}-${max}`,
      minFloor: min,
      maxFloor: max,
      dominantUse: dominantUse(rooms),
      pressure: Math.round(clamp(dirt * 0.55 + utilityGap)),
    });
  }
  return bands;
}

export function evaluateOperations(tower: TowerState, economy: EconomyState): OperationsState {
  const top = maxFloor(tower);
  const floorCount = new Set(tower.rooms.map((room) => room.y)).size;
  const heightRisk = clamp(
    top * 4 - roomCount(tower, 'weatherCore') * 24 - roomCount(tower, 'mechanical') * 6,
  );
  const transitTopology = clamp(
    18 + tower.elevators.length * 18 + tower.shafts.length * 8 - economy.transitPressure * 0.58,
  );
  const serviceCoverage = clamp(
    18 +
      roomCount(tower, 'maint') * 24 +
      roomCount(tower, 'restroom') * 8 +
      roomCount(tower, 'clinic') * 12 -
      economy.servicePressure * 0.55,
  );
  const venueCredibility = clamp(
    roomCount(tower, 'cafe') * 8 +
      roomCount(tower, 'hotel') * 12 +
      roomCount(tower, 'eventHall') * 22 +
      roomCount(tower, 'conference') * 18 +
      roomCount(tower, 'retail') * 10 +
      roomCount(tower, 'gallery') * 14 +
      roomCount(tower, 'observation') * 24,
  );
  const safetyReadiness = clamp(
    20 +
      roomCount(tower, 'security') * 18 +
      roomCount(tower, 'mechanical') * 12 +
      roomCount(tower, 'weatherCore') * 24 +
      roomCount(tower, 'clinic') * 10 -
      heightRisk * 0.35,
  );
  const privacyComfort = clamp(
    38 +
      roomCount(tower, 'condo') * 4 +
      roomCount(tower, 'luxurySuite') * 14 +
      roomCount(tower, 'skyGarden') * 8 +
      roomCount(tower, 'security') * 4 -
      economy.transitPressure * 0.22,
  );
  const noiseControl = clamp(
    76 +
      roomCount(tower, 'skyGarden') * 8 +
      roomCount(tower, 'mechanical') * 4 -
      economy.transitPressure * 0.32 -
      countAny(tower, ['eventHall', 'retail', 'cafe']) * 3,
  );
  const eventReadiness = clamp(
    venueCredibility * 0.52 +
      safetyReadiness * 0.2 +
      serviceCoverage * 0.16 +
      transitTopology * 0.12,
  );
  const revenueHealth = clamp(
    economy.dailyRevenue / 90 + (economy.funds / Math.max(10_000, economy.towerValue)) * 36,
  );
  const operationalGrade = Math.round(
    clamp(
      transitTopology * 0.2 +
        serviceCoverage * 0.18 +
        safetyReadiness * 0.18 +
        eventReadiness * 0.14 +
        privacyComfort * 0.1 +
        noiseControl * 0.08 +
        revenueHealth * 0.12,
    ),
  );

  return {
    floorCount,
    heightRisk: Math.round(heightRisk),
    transitTopology: Math.round(transitTopology),
    serviceCoverage: Math.round(serviceCoverage),
    venueCredibility: Math.round(venueCredibility),
    safetyReadiness: Math.round(safetyReadiness),
    privacyComfort: Math.round(privacyComfort),
    noiseControl: Math.round(noiseControl),
    eventReadiness: Math.round(eventReadiness),
    revenueHealth: Math.round(revenueHealth),
    operationalGrade,
    floorBands: createFloorBands(tower),
  };
}

function marketCycle(day: number): MacroState['marketCycle'] {
  const slot = day % 18;
  if (slot <= 3) return 'boom';
  if (slot <= 8) return 'steady';
  if (slot <= 12) return 'soft';
  return 'correction';
}

function identityScore(scores: TowerIdentityScores, identity: TowerIdentity | null): number {
  if (!identity || identity === 'unformed') return 0;
  if (identity === 'mixed-use') return scores.mixedUse;
  return scores[identity];
}

function deriveMacro(
  tower: TowerState,
  economy: EconomyState,
  operations: OperationsState,
  previous: MacroState,
  campaign: CampaignState,
  clock: ClockState,
  events: string[],
): MacroState {
  const identity = deriveTowerIdentity(tower);
  const declaredIdentity = campaign.declaredIdentity;
  const declaredScore = identityScore(identity.scores, declaredIdentity);
  const declarationBoost = declaredIdentity ? 8 : 0;
  const declarationMismatch =
    declaredIdentity &&
    declaredIdentity !== 'mixed-use' &&
    identity.primary !== 'mixed-use' &&
    identity.primary !== 'unformed' &&
    declaredIdentity !== identity.primary
      ? 7
      : 0;
  const districtIdentity = declaredIdentity ?? identity.primary;
  const cycle = marketCycle(clock.day);
  const cycleBoost = cycle === 'boom' ? 10 : cycle === 'steady' ? 4 : cycle === 'soft' ? -4 : -9;
  const visitDelta =
    events.filter((event) => event === 'visit-success').length * 5 +
    events.filter((event) => event === 'visit-spend').length;
  const cancelDelta =
    events.filter((event) => event === 'visit-canceled' || event === 'visit-failure').length * -7;
  const contractDelta = events.includes('contract-complete')
    ? 4
    : events.includes('contract-failed')
      ? -8
      : 0;
  const trust = clamp(
    previous.publicTrust * 0.86 +
      economy.tenantSatisfaction * 0.14 +
      visitDelta +
      cancelDelta +
      contractDelta -
      declarationMismatch +
      (declaredScore >= 45 ? 2 : 0) -
      economy.servicePressure * 0.025 -
      economy.transitPressure * 0.02,
  );
  const fame = clamp(
    previous.fame * 0.82 +
      economy.towerValue / 18_000 +
      operations.venueCredibility * 0.16 +
      campaign.successfulVisits * 3 +
      operations.floorCount * 0.8 +
      declarationBoost,
  );
  const weatherRisk = clamp(
    operations.heightRisk +
      Math.max(0, operations.floorCount - 8) * 1.8 +
      (clock.day % 7 === 0 ? 12 : 0),
  );
  const scandalRisk = clamp(
    (100 - trust) * 0.34 +
      economy.transitPressure * 0.18 +
      economy.servicePressure * 0.2 +
      operations.safetyReadiness * -0.12 +
      campaign.failedVisits * 2.2 +
      declarationMismatch,
  );
  const skylineStatus = clamp(
    operations.floorCount * 3.2 + fame * 0.42 + operations.operationalGrade * 0.18,
  );
  const cityInfluence = clamp(trust * 0.34 + fame * 0.34 + skylineStatus * 0.22 + campaign.act * 3);

  return {
    districtIdentity,
    marketCycle: cycle,
    publicTrust: Math.round(trust),
    businessDemand: Math.round(
      clamp(
        identity.scores.business * 0.72 +
          cycleBoost +
          trust * 0.18 +
          (districtIdentity === 'business' || districtIdentity === 'mixed-use' ? 10 : 0),
      ),
    ),
    residentialDemand: Math.round(
      clamp(
        identity.scores.residential * 0.72 +
          cycleBoost * 0.4 +
          trust * 0.22 +
          (districtIdentity === 'residential' || districtIdentity === 'mixed-use' ? 10 : 0),
      ),
    ),
    tourismDemand: Math.round(
      clamp(
        identity.scores.hospitality * 0.74 +
          fame * 0.22 +
          cycleBoost * 0.6 +
          (['hospitality', 'civic', 'luxury', 'mixed-use'].includes(districtIdentity) ? 9 : 0),
      ),
    ),
    regulationPressure: Math.round(
      clamp(campaign.act * 7 + weatherRisk * 0.26 + scandalRisk * 0.22),
    ),
    weatherRisk: Math.round(weatherRisk),
    fame: Math.round(fame),
    civicPressure: Math.round(
      clamp(
        identity.scores.civic * 0.5 +
          (100 - trust) * 0.18 +
          campaign.act * 4 +
          (districtIdentity === 'civic' ? 8 : 0),
      ),
    ),
    scandalRisk: Math.round(scandalRisk),
    cityInfluence: Math.round(cityInfluence),
    skylineStatus: Math.round(skylineStatus),
    lastUpdatedDay: clock.day,
  };
}

function metricValue(
  objective: ContractObjective,
  tower: TowerState,
  economy: EconomyState,
  campaign: CampaignState,
  macro: MacroState,
  operations: OperationsState,
): number {
  switch (objective.metric) {
    case 'room-count':
      return objective.roomType ? roomCount(tower, objective.roomType) : tower.rooms.length;
    case 'population':
      return economy.population;
    case 'daily-revenue':
      return economy.dailyRevenue;
    case 'tenant-satisfaction':
      return economy.tenantSatisfaction;
    case 'transit-pressure':
      return economy.transitPressure;
    case 'service-pressure':
      return economy.servicePressure;
    case 'cleanliness':
      return economy.cleanliness;
    case 'operations-grade':
      return operations.operationalGrade;
    case 'identity-score': {
      if (
        objective.identity &&
        objective.identity !== 'mixed-use' &&
        objective.identity !== 'unformed'
      ) {
        return campaign.identityScores[objective.identity];
      }
      if (objective.identity === 'mixed-use') return campaign.identityScores.mixedUse;
      return Math.max(...Object.values(campaign.identityScores));
    }
    case 'public-trust':
      return macro.publicTrust;
    case 'fame':
      return macro.fame;
    case 'skyline-status':
      return macro.skylineStatus;
    case 'height':
      return operations.floorCount;
    case 'venue-credibility':
      return operations.venueCredibility;
    case 'event-readiness':
      return operations.eventReadiness;
    case 'safety-readiness':
      return operations.safetyReadiness;
    case 'privacy-comfort':
      return operations.privacyComfort;
    case 'noise-control':
      return operations.noiseControl;
    case 'weather-risk':
      return macro.weatherRisk;
    case 'scandal-risk':
      return macro.scandalRisk;
    case 'regulation-pressure':
      return macro.regulationPressure;
    case 'city-influence':
      return macro.cityInfluence;
    case 'declared-identity':
      return campaign.declaredIdentity ? 1 : 0;
    case 'successful-visits':
      return campaign.successfulVisits;
    case 'funds':
      return economy.funds;
    case 'tower-value':
      return economy.towerValue;
    default:
      return 0;
  }
}

function evaluateContract(
  contract: GameContract,
  tower: TowerState,
  economy: EconomyState,
  campaign: CampaignState,
  macro: MacroState,
  operations: OperationsState,
  day: number,
): GameContract {
  const objectives = contract.objectives.map((objective) => {
    const value = Math.round(metricValue(objective, tower, economy, campaign, macro, operations));
    const complete =
      objective.direction === 'at-least' ? value >= objective.target : value <= objective.target;
    return { ...objective, value, complete };
  });
  const complete = objectives.every((objective) => objective.complete);
  const failed = !complete && contract.deadlineDay !== null && day > contract.deadlineDay;
  const status: GameContract['status'] = complete ? 'completed' : failed ? 'failed' : 'active';
  const score = contractScore(objectives);
  const evaluated: GameContract = {
    ...contract,
    objectives,
    score,
    status,
    completedDay: complete ? day : contract.completedDay,
    failedDay: failed ? day : contract.failedDay,
  };
  return { ...evaluated, pressure: contractPressure(evaluated, score, day) };
}

function campaignBlueprintForAct(act: CampaignState['act']): ContractBlueprint {
  const blueprint = CAMPAIGN_BLUEPRINTS.find((candidate) => candidate.act === act);
  if (!blueprint) throw new Error(`Missing campaign blueprint for act ${act}`);
  return blueprint;
}

function ensureCampaignContract(campaign: CampaignState, day: number): CampaignState {
  const blueprint = campaignBlueprintForAct(campaign.act);
  const hasActContract = [...campaign.activeContracts, ...campaign.completedContracts].some(
    (contract) => contract.id === blueprint.id,
  );
  if (hasActContract || campaign.victory === 'won') return campaign;
  return {
    ...campaign,
    activeContracts: [...campaign.activeContracts, instantiateContract(blueprint, day)],
  };
}

function hasActiveSource(campaign: CampaignState, source: string): boolean {
  return campaign.activeContracts.some((contract) => contract.source === source);
}

function ensureSandboxContract(
  campaign: CampaignState,
  tower: TowerState,
  economy: EconomyState,
  macro: MacroState,
  operations: OperationsState,
  day: number,
): CampaignState {
  if (
    campaign.victory !== 'won' ||
    campaign.mode !== 'sandbox' ||
    !campaign.unlockedSystems.includes('sandbox-city-cycle') ||
    hasActiveSource(campaign, 'sandbox')
  ) {
    return campaign;
  }

  const contract = sandboxCityCycleContract(campaign, economy, macro, operations, day);
  const evaluated = evaluateContract(contract, tower, economy, campaign, macro, operations, day);
  return {
    ...campaign,
    activeContracts: [
      evaluated,
      ...campaign.activeContracts.filter((candidate) => candidate.source !== 'sandbox'),
    ].slice(0, 5),
  };
}

function reactivePriority(contract: GameContract): number {
  if (contract.source === 'weather') return 100;
  if (contract.source === 'inspection') return 95;
  if (contract.source?.startsWith('recovery-')) return 88;
  if (contract.source?.startsWith('memory-')) return 86;
  if (contract.source === 'visit') return 84;
  if (contract.source === 'transit') return 76;
  if (contract.source === 'sanitation') return 74;
  return 50;
}

function addReactiveContracts(
  campaign: CampaignState,
  tower: TowerState,
  economy: EconomyState,
  operations: OperationsState,
  macro: MacroState,
  events: string[],
  day: number,
): CampaignState {
  if (!hasPermit(campaign, 'operations-permit') && campaign.act < 3) return campaign;
  const activeReactive = campaign.activeContracts.filter(
    (contract) => contract.kind !== 'campaign',
  );
  const additions: GameContract[] = [];

  if (economy.transitPressure >= 75 && !hasActiveSource(campaign, 'transit')) {
    additions.push(
      reactiveContract(
        `reactive-transit-${day}`,
        'Untangle The Core',
        'People are learning the tower through its worst elevator waits. Fix the route burden before it becomes reputation.',
        'transit',
        day,
        [
          {
            id: 'transit',
            label: 'Transit pressure under 45%',
            metric: 'transit-pressure',
            target: 45,
            direction: 'at-most',
          },
          {
            id: 'topology',
            label: '55 transit topology',
            metric: 'operations-grade',
            target: 55,
            direction: 'at-least',
          },
        ],
      ),
    );
  }

  if (
    (economy.servicePressure >= 72 || economy.cleanliness < 62) &&
    !hasActiveSource(campaign, 'sanitation')
  ) {
    additions.push(
      reactiveContract(
        `reactive-sanitation-${day}`,
        'Sanitation Audit',
        'Tenants can forgive construction noise. They do not forgive a dirty tower that ignores them.',
        'sanitation',
        day,
        [
          {
            id: 'clean',
            label: '82% cleanliness',
            metric: 'cleanliness',
            target: 82,
            direction: 'at-least',
          },
          {
            id: 'service',
            label: 'Service pressure under 35%',
            metric: 'service-pressure',
            target: 35,
            direction: 'at-most',
          },
          {
            id: 'maint',
            label: 'Maintenance capacity',
            metric: 'room-count',
            roomType: 'maint',
            target: 1,
            direction: 'at-least',
          },
        ],
      ),
    );
  }

  if (events.includes('visit-inquiry') && !hasActiveSource(campaign, 'visit')) {
    additions.push(
      reactiveContract(
        `event-host-${day}`,
        'Host Without Humiliation',
        'A public group is considering the tower. Keep the visible experience smooth enough that they leave with a story worth repeating.',
        'visit',
        day,
        [
          {
            id: 'event',
            label: '50 event readiness',
            metric: 'event-readiness',
            target: 50,
            direction: 'at-least',
          },
          {
            id: 'sentiment',
            label: '70 tenant sentiment',
            metric: 'tenant-satisfaction',
            target: 70,
            direction: 'at-least',
          },
          {
            id: 'transit',
            label: 'Transit pressure under 60%',
            metric: 'transit-pressure',
            target: 60,
            direction: 'at-most',
          },
        ],
      ),
    );
  }

  if (
    (macro.regulationPressure >= 60 || macro.scandalRisk >= 58) &&
    !hasActiveSource(campaign, 'inspection') &&
    (campaign.act >= 4 || hasPermit(campaign, 'landmark-review'))
  ) {
    additions.push(
      reactiveContract(
        `reactive-inspection-${day}`,
        'Inspector Walkthrough',
        'The city is watching how the tower treats public risk. Keep visible operations boring before scrutiny becomes scandal.',
        'inspection',
        day,
        [
          {
            id: 'safety',
            label: '65 safety readiness',
            metric: 'safety-readiness',
            target: 65,
            direction: 'at-least',
          },
          {
            id: 'service',
            label: 'Service pressure under 40%',
            metric: 'service-pressure',
            target: 40,
            direction: 'at-most',
          },
          {
            id: 'scandal',
            label: 'Scandal risk under 45%',
            metric: 'scandal-risk',
            target: 45,
            direction: 'at-most',
          },
        ],
      ),
    );
  }

  if (
    (macro.weatherRisk >= 65 || operations.heightRisk >= 68) &&
    !hasActiveSource(campaign, 'weather') &&
    (campaign.act >= 4 || hasPermit(campaign, 'landmark-review'))
  ) {
    additions.push(
      reactiveContract(
        `reactive-weather-${day}`,
        'Storm Front Readiness',
        'Height changes the building into weather infrastructure. Add mitigation before a bad forecast becomes a public failure.',
        'weather',
        day,
        [
          {
            id: 'weather-core',
            label: 'Weather core',
            metric: 'room-count',
            roomType: 'weatherCore',
            target: 1,
            direction: 'at-least',
          },
          {
            id: 'safety',
            label: '70 safety readiness',
            metric: 'safety-readiness',
            target: 70,
            direction: 'at-least',
          },
          {
            id: 'risk',
            label: 'Weather risk under 55%',
            metric: 'weather-risk',
            target: 55,
            direction: 'at-most',
          },
        ],
      ),
    );
  }

  const latestMemory = tower.visitMemories[0];
  const memoryReason = latestMemory ? dominantMemoryReason(latestMemory) : null;
  const memorySource = memoryReason ? `memory-${memoryReason}` : null;
  if (
    latestMemory &&
    memoryReason &&
    memorySource &&
    (events.includes('visit-failure') || events.includes('visit-neutral')) &&
    (latestMemory.outcome === 'complained' || latestMemory.frictionScore >= 28) &&
    !hasActiveSource(campaign, memorySource)
  ) {
    additions.push(publicMemoryRepairContract(latestMemory, memoryReason, campaign, day));
  }

  if (additions.length === 0) return campaign;
  const campaignContracts = campaign.activeContracts.filter(
    (contract) => contract.kind === 'campaign',
  );
  const reactiveContracts = [...activeReactive, ...additions]
    .sort((a, b) => reactivePriority(b) - reactivePriority(a))
    .slice(0, MAX_REACTIVE_CONTRACTS);
  return { ...campaign, activeContracts: [...campaignContracts, ...reactiveContracts] };
}

function advanceAct(act: CampaignState['act']): CampaignState['act'] {
  return Math.min(5, act + 1) as CampaignState['act'];
}

function createReport(
  tower: TowerState,
  campaign: CampaignState,
  macro: MacroState,
  operations: OperationsState,
  economy: EconomyState,
  previousReputation: number,
  day: number,
): DailyReport {
  const notes: string[] = [];
  if (economy.transitPressure > 65) notes.push('Transit waits are becoming the tower story.');
  if (economy.servicePressure > 60) notes.push('Service load is outrunning maintenance coverage.');
  if (macro.weatherRisk > 55)
    notes.push('Height and weather exposure now need dedicated mitigation.');
  if (operations.eventReadiness > 55) notes.push('The building can credibly host public groups.');
  if (campaign.towerIdentity !== 'unformed')
    notes.push(`District chatter reads this as a ${campaign.towerIdentity} tower.`);
  if (campaign.declaredIdentity)
    notes.push(`Public positioning is now declared as ${campaign.declaredIdentity}.`);
  const latestMemory = tower.visitMemories[0];
  if (latestMemory) {
    const verb =
      latestMemory.outcome === 'praised'
        ? 'praised'
        : latestMemory.outcome === 'complained'
          ? 'criticized'
          : 'remembered';
    notes.push(`${latestMemory.label} ${verb} the tower: ${latestMemory.impressions[0]}`);
  }
  if (notes.length === 0)
    notes.push('Operations stayed quiet enough that construction choices can lead tomorrow.');
  const costs = estimateDailyCosts(tower, economy, macro, operations);
  const nextRisks = nextRiskSignals(economy, macro, operations);

  return {
    id: `report-${day}`,
    day,
    title: `Day ${day - 1} Operations Brief`,
    revenue: economy.dailyRevenue,
    costs,
    netRevenue: economy.dailyRevenue - costs,
    sentiment: economy.tenantSatisfaction,
    cleanliness: economy.cleanliness,
    queuePressure: economy.transitPressure,
    dirtBurden: Math.max(0, 100 - economy.cleanliness),
    transitPressure: economy.transitPressure,
    servicePressure: economy.servicePressure,
    publicTrust: macro.publicTrust,
    fame: macro.fame,
    identity: campaign.towerIdentity,
    reputationDelta: campaign.reputation - previousReputation,
    notes,
    nextRisks,
  };
}

function estimateDailyCosts(
  tower: TowerState,
  economy: EconomyState,
  macro: MacroState,
  operations: OperationsState,
): number {
  if (economy.dailyCosts > 0) return economy.dailyCosts;
  const occupiedRooms = tower.rooms.filter((room) => {
    const category = BUILDINGS[room.type].cat;
    return category !== 'infra' && category !== 'trans';
  }).length;
  const servicePayroll =
    roomCount(tower, 'maint') * 720 +
    roomCount(tower, 'security') * 860 +
    roomCount(tower, 'clinic') * 940;
  const utilities = Math.round(occupiedRooms * 38 + operations.floorCount * 140);
  const insurance = Math.round(operations.heightRisk * 95 + macro.weatherRisk * 60);
  const demandWear = Math.round(
    economy.population * 16 + economy.transitPressure * 22 + economy.servicePressure * 28,
  );
  return Math.max(0, servicePayroll + utilities + insurance + demandWear);
}

function nextRiskSignals(
  economy: EconomyState,
  macro: MacroState,
  operations: OperationsState,
): string[] {
  const risks: string[] = [];
  if (economy.transitPressure > 65) risks.push('Queue pressure could become tomorrow front page.');
  if (economy.cleanliness < 72) risks.push('Dirt burden is close to visible tenant backlash.');
  if (economy.servicePressure > 62) risks.push('Service coverage is not keeping up with demand.');
  if (operations.safetyReadiness < 58) risks.push('Code readiness is lagging tower ambition.');
  if (operations.privacyComfort < 58 || operations.noiseControl < 62) {
    risks.push('Privacy and noise are weakening high-value tenant comfort.');
  }
  if (macro.weatherRisk > 55) risks.push('Weather risk needs mitigation before the next climb.');
  if (macro.scandalRisk > 55) risks.push('Scandal risk is high enough to attract press scrutiny.');
  if (risks.length === 0) risks.push('No immediate red-line risk; choose the next identity bet.');
  return risks.slice(0, 4);
}

export function advanceGameSpine(input: GameSpineInput): GameSpineResult {
  const events = [...input.events];
  const tower: TowerState = { ...input.tower, notifications: [...input.tower.notifications] };
  const economy = { ...input.economy };
  let campaign = normalizeCampaignState(input.campaign);
  let operations = evaluateOperations(tower, economy);
  const identity = deriveTowerIdentity(tower);
  const successfulVisitEvents = events.filter((event) => event === 'visit-success').length;
  const failedVisitEvents = events.filter(
    (event) => event === 'visit-canceled' || event === 'visit-failure',
  ).length;
  campaign = {
    ...campaign,
    actTitle: ACT_TITLES[campaign.act],
    towerIdentity: identity.primary,
    identityScores: identity.scores,
    successfulVisits: campaign.successfulVisits + successfulVisitEvents,
    failedVisits: campaign.failedVisits + failedVisitEvents,
  };
  campaign = ensureCampaignContract(campaign, input.clock.day);
  let macro = deriveMacro(tower, economy, operations, input.macro, campaign, input.clock, events);
  campaign = ensureSandboxContract(campaign, tower, economy, macro, operations, input.clock.day);
  campaign = addReactiveContracts(
    campaign,
    tower,
    economy,
    operations,
    macro,
    events,
    input.clock.day,
  );
  const previousReputation = campaign.reputation;
  const evaluated = campaign.activeContracts.map((contract) =>
    evaluateContract(contract, tower, economy, campaign, macro, operations, input.clock.day),
  );
  const completed = evaluated.filter((contract) => contract.status === 'completed');
  const failed = evaluated.filter((contract) => contract.status === 'failed');
  const active = evaluated.filter((contract) => contract.status === 'active');

  for (const contract of completed) {
    economy.funds += contract.rewardFunds;
    if (contract.rewardTrust > 0) {
      macro = {
        ...macro,
        publicTrust: Math.round(clamp(macro.publicTrust + contract.rewardTrust)),
      };
    }
    pushNotice(
      tower,
      `${contract.title} complete. +$${contract.rewardFunds.toLocaleString()}${
        contract.rewardTrust > 0 ? `, +${contract.rewardTrust} trust` : ''
      }`,
      'success',
    );
    events.push('contract-complete');
    const blueprint = CAMPAIGN_BLUEPRINTS.find((candidate) => candidate.id === contract.id);
    if (blueprint) {
      const nextPermits = campaign.permits.includes(blueprint.permit)
        ? campaign.permits
        : [...campaign.permits, blueprint.permit];
      const nextUnlocks = Array.from(new Set([...campaign.unlockedSystems, ...blueprint.unlocks]));
      campaign = { ...campaign, permits: nextPermits, unlockedSystems: nextUnlocks };
      if (contract.act === campaign.act && campaign.act < 5) {
        const nextAct = advanceAct(campaign.act);
        campaign = { ...campaign, act: nextAct, actTitle: ACT_TITLES[nextAct] };
        pushNotice(tower, `Act ${nextAct}: ${ACT_TITLES[nextAct]} unlocked.`, 'info');
      } else if (contract.act === 5) {
        campaign = { ...campaign, victory: 'won', mode: 'sandbox' };
        pushNotice(tower, 'Skyline charter secured. Sandbox city cycle unlocked.', 'success');
        events.push('victory');
      }
    }
  }

  const recoveryContracts: GameContract[] = [];
  for (const contract of failed) {
    pushNotice(tower, `${contract.title} failed. Public trust took the hit.`, 'warning');
    events.push('contract-failed');
    macro = { ...macro, publicTrust: Math.round(clamp(macro.publicTrust - contract.penaltyTrust)) };
    const source = `recovery-${contract.source ?? contract.id}`;
    if (
      contract.penaltyTrust > 0 &&
      !active.some((candidate) => candidate.source === source) &&
      !campaign.activeContracts.some((candidate) => candidate.source === source)
    ) {
      recoveryContracts.push(recoveryContract(contract, campaign, input.clock.day));
    }
  }

  campaign = {
    ...campaign,
    activeContracts: [...active, ...recoveryContracts].slice(0, 5),
    completedContracts: [...campaign.completedContracts, ...completed].slice(-18),
    failedContracts: [...campaign.failedContracts, ...failed].slice(-18),
  };
  campaign = ensureCampaignContract(campaign, input.clock.day);
  operations = evaluateOperations(tower, economy);
  macro = deriveMacro(tower, economy, operations, macro, campaign, input.clock, events);
  campaign = {
    ...campaign,
    reputation: Math.round(
      clamp((macro.publicTrust + macro.fame + operations.operationalGrade) / 3),
    ),
    actTitle: ACT_TITLES[campaign.act],
  };
  campaign = ensureSandboxContract(campaign, tower, economy, macro, operations, input.clock.day);

  if (getHour(input.clock.tick) === 0 && input.clock.day !== campaign.lastReportDay) {
    const report = createReport(
      tower,
      campaign,
      macro,
      operations,
      economy,
      previousReputation,
      input.clock.day,
    );
    campaign = {
      ...campaign,
      lastReportDay: input.clock.day,
      reports: [report, ...campaign.reports].slice(0, 7),
    };
    events.push('daily-report');
  }

  return { tower, economy, campaign, macro, operations, events };
}
