import { AUTHORED_VISITOR_ARCHETYPES } from '../content/cohorts';
import { applyIdentityTraitDelta, IDENTITY_CONSEQUENCES } from '../content/identity';
import { createSeededRandom, generateId } from './random';
import type { EconomyState, TowerIdentity, TowerState } from './types';

export type VisitorArchetypeId =
  | 'movie-star'
  | 'politician'
  | 'foreign-prince'
  | 'buddhist-monks'
  | 'school-teachers'
  | 'stamp-collectors'
  | 'labor-delegation'
  | 'trade-buyers'
  | 'city-inspectors'
  | 'press-swarm'
  | 'film-festival-jury'
  | 'tech-investors'
  | 'civic-delegation';

export type VisitorGoal = 'publicity' | 'shopping' | 'lodging' | 'quiet' | 'meeting' | 'food';
export type VisitStatus = 'inquiry' | 'arriving' | 'inside';
export type VisitOutcome = 'pending' | 'praised' | 'mixed' | 'complained';

export interface VisitorTraitVector {
  ego: number;
  patience: number;
  spendingPower: number;
  cleanlinessDemand: number;
  privacyDemand: number;
  noiseTolerance: number;
  groupCohesion: number;
  statusSensitivity: number;
  kindness: number;
}

export interface VisitorArchetype {
  id: VisitorArchetypeId;
  label: string;
  minSize: number;
  maxSize: number;
  traits: VisitorTraitVector;
  goals: VisitorGoal[];
  volatility: number;
}

export interface VisitorBehaviorProfile {
  temperament: string;
  groupDynamic: string;
  moneySignal: string;
  summary: string;
  values: string[];
  dealbreakers: string[];
}

export interface VisitMemory {
  sentiment: number;
  frictionScore: number;
  outcome: VisitOutcome;
  impressions: string[];
  pressureReasons: string[];
  updatedDay: number;
  updatedHour: number;
}

export interface VisitMemoryRecord extends VisitMemory {
  id: string;
  cohortId: string;
  archetypeId: VisitorArchetypeId;
  label: string;
  size: number;
  createdDay: number;
  resolvedDay: number;
}

export interface VisitCohort {
  id: string;
  archetypeId: VisitorArchetypeId;
  label: string;
  size: number;
  traits: VisitorTraitVector;
  goals: VisitorGoal[];
  volatility: number;
  status: VisitStatus;
  createdDay: number;
  createdHour: number;
  arrivalHour: number;
  dwellHours: number;
  targetRoomId: string | null;
  representativeCount: number;
  spawnedAgents: number;
  spendCollected: boolean;
  memory: VisitMemory;
}

export interface CohortFriction {
  score: number;
  reasons: string[];
  mood: 'delighted' | 'steady' | 'annoyed' | 'angry';
}

export interface CohortExperienceContext {
  eventReadiness?: number;
  noiseControl?: number;
  privacyComfort?: number;
  safetyReadiness?: number;
  weatherRisk?: number;
}

export interface VisitGenerationContext {
  economy?: Pick<
    EconomyState,
    'cleanliness' | 'servicePressure' | 'tenantSatisfaction' | 'transitPressure'
  >;
  fame?: number;
  publicTrust?: number;
  regulationPressure?: number;
  scandalRisk?: number;
  towerIdentity?: TowerIdentity;
  weatherRisk?: number;
  operations?: CohortExperienceContext;
}

export const VISITOR_ARCHETYPES: Record<VisitorArchetypeId, VisitorArchetype> =
  AUTHORED_VISITOR_ARCHETYPES;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueShortList(values: string[], limit: number): string[] {
  return [...new Set(values)].slice(0, limit);
}

export function describeVisitorBehavior(
  visitor: Pick<VisitCohort, 'archetypeId' | 'goals' | 'traits'> | VisitorArchetype,
): VisitorBehaviorProfile {
  const { goals, traits } = visitor;
  const temperament =
    traits.statusSensitivity > 0.78 && traits.ego > 0.7
      ? 'status-sensitive'
      : traits.kindness > 0.82 && traits.patience > 0.68
        ? 'generous and patient'
        : traits.patience < 0.38
          ? 'low-patience'
          : traits.noiseTolerance < 0.32
            ? 'quiet-order'
            : traits.groupCohesion > 0.84
              ? 'cohesive flock'
              : 'pragmatic';
  const groupDynamic =
    traits.groupCohesion > 0.86
      ? 'Moves as a flock; one bottleneck becomes the whole group memory.'
      : traits.ego > 0.74 && traits.kindness < 0.46
        ? 'Small slights become status stories quickly.'
        : traits.kindness > 0.82
          ? 'Forgiving people, but they still remember visible disorder.'
          : traits.statusSensitivity > 0.7
            ? 'Judges whether the building seems legitimate under scrutiny.'
            : 'Reads the tower through practical comfort and flow.';
  const moneySignal =
    traits.spendingPower > 0.78
      ? 'high-spend if impressed'
      : traits.spendingPower > 0.5
        ? 'selective spend'
        : traits.spendingPower < 0.25
          ? 'low-spend, reputation-heavy'
          : 'modest spend';
  const values = uniqueShortList(
    [
      goals.includes('quiet') || traits.noiseTolerance < 0.35 ? 'quiet order' : '',
      traits.privacyDemand > 0.68 ? 'privacy' : '',
      traits.statusSensitivity > 0.7 ? 'status legitimacy' : '',
      goals.includes('food') ? 'food and service' : '',
      goals.includes('shopping') ? 'retail discovery' : '',
      goals.includes('meeting') ? 'organized gathering space' : '',
      goals.includes('publicity') ? 'public image' : '',
      traits.cleanlinessDemand > 0.68 ? 'clean surfaces' : '',
      traits.kindness > 0.8 ? 'civic warmth' : '',
    ].filter(Boolean),
    5,
  );
  const dealbreakers = uniqueShortList(
    [
      traits.patience < 0.46 ? 'visible queues' : '',
      traits.cleanlinessDemand > 0.72 ? 'dirt in public rooms' : '',
      traits.privacyDemand > 0.72 ? 'uncontrolled crowds' : '',
      traits.noiseTolerance < 0.35 ? 'noise bleeding into quiet rooms' : '',
      traits.statusSensitivity > 0.78 ? 'unsafe or unimpressive venues' : '',
      traits.groupCohesion > 0.86 ? 'splitting the group across bad routes' : '',
    ].filter(Boolean),
    5,
  );
  const summary = `${groupDynamic} ${moneySignal}.`;
  return {
    temperament,
    groupDynamic,
    moneySignal,
    summary,
    values: values.length > 0 ? values : ['clear routing'],
    dealbreakers: dealbreakers.length > 0 ? dealbreakers : ['visible disorder'],
  };
}

function estimateIdentity(tower: TowerState): TowerIdentity {
  const counts = (types: string[]) =>
    tower.rooms.filter((room) => types.includes(room.type)).length;
  const business = counts(['office', 'conference']);
  const hospitality = counts(['hotel', 'cafe', 'retail', 'eventHall', 'observation']);
  const civic = counts(['clinic', 'gallery', 'skyGarden', 'restroom']);
  const luxury = counts(['luxurySuite', 'observation', 'hotel']);
  const residential = counts(['condo', 'luxurySuite', 'skyGarden']);
  const scores = { business, civic, hospitality, luxury, residential };
  const [identity, score] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0] ?? [
    'unformed',
    0,
  ];
  if (score <= 0) return 'unformed';
  return identity === 'hospitality' ||
    identity === 'business' ||
    identity === 'civic' ||
    identity === 'luxury' ||
    identity === 'residential'
    ? identity
    : 'mixed-use';
}

function chooseArchetype(
  random: () => number,
  tower: TowerState,
  context: VisitGenerationContext = {},
): VisitorArchetype {
  const hasHotel = tower.rooms.some((room) => room.type === 'hotel');
  const hasCafe = tower.rooms.some((room) => room.type === 'cafe');
  const hasEventVenue = tower.rooms.some((room) =>
    ['eventHall', 'conference', 'gallery', 'observation'].includes(room.type),
  );
  const highCommerce =
    tower.rooms.filter((room) => ['cafe', 'hotel', 'retail', 'eventHall'].includes(room.type))
      .length >= 3;
  const towerIdentity = context.towerIdentity ?? estimateIdentity(tower);
  const fame = context.fame ?? Math.min(100, tower.rooms.length * 2 + (hasEventVenue ? 22 : 0));
  const trust = context.publicTrust ?? 58;
  const regulation = context.regulationPressure ?? 8;
  const scandal =
    context.scandalRisk ??
    Math.max(
      0,
      100 - (context.economy?.tenantSatisfaction ?? 100),
      context.economy?.transitPressure ?? 0,
    );
  const weather = context.weatherRisk ?? 0;
  const dirty = 100 - (context.economy?.cleanliness ?? 100);
  const service = context.economy?.servicePressure ?? 0;
  const weighted: Array<[VisitorArchetypeId, number]> = [
    ['school-teachers', 1.1],
    ['stamp-collectors', 0.9],
    ['labor-delegation', 0.8],
    ['trade-buyers', highCommerce ? 1.1 : 0.55],
    ['buddhist-monks', hasCafe ? 0.42 : 0.18],
    ['politician', hasCafe || hasEventVenue ? 0.46 : 0.12],
    ['movie-star', hasHotel ? 0.34 : 0.08],
    ['foreign-prince', hasHotel ? 0.2 : 0.04],
    ['city-inspectors', 0.12],
    ['press-swarm', 0.1],
    ['film-festival-jury', hasEventVenue ? 0.34 : 0.08],
    ['tech-investors', hasEventVenue || highCommerce ? 0.38 : 0.12],
    ['civic-delegation', 0.3],
  ];
  const addWeight = (id: VisitorArchetypeId, amount: number) => {
    const entry = weighted.find(([candidate]) => candidate === id);
    if (entry) entry[1] += Math.max(0, amount);
  };

  const identityBias = IDENTITY_CONSEQUENCES[towerIdentity]?.archetypeBias ?? {};
  for (const [id, amount] of Object.entries(identityBias) as Array<[VisitorArchetypeId, number]>) {
    addWeight(id, amount);
  }

  addWeight('movie-star', fame > 70 && trust > 50 ? 1.2 : fame > 45 ? 0.45 : 0);
  addWeight('foreign-prince', fame > 82 && hasHotel ? 0.82 : 0);
  addWeight('press-swarm', fame > 65 ? 0.74 : 0);
  addWeight('press-swarm', scandal > 48 || trust < 38 ? 1.3 : 0);
  addWeight('city-inspectors', regulation > 45 || weather > 52 ? 1.2 : 0);
  addWeight('city-inspectors', dirty > 35 || service > 65 ? 0.7 : 0);
  addWeight('labor-delegation', trust < 45 || service > 55 ? 0.62 : 0);

  const total = weighted.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [id, weight] of weighted) {
    roll -= weight;
    if (roll <= 0) return VISITOR_ARCHETYPES[id];
  }
  return VISITOR_ARCHETYPES['school-teachers'];
}

function roomPriority(roomType: string, goals: VisitorGoal[]): number {
  let score = 0;
  if (roomType === 'hotel' && goals.includes('lodging')) score += 7;
  if (roomType === 'cafe' && goals.includes('food')) score += 6;
  if (roomType === 'eventHall' && goals.includes('publicity')) score += 8;
  if (roomType === 'conference' && goals.includes('meeting')) score += 8;
  if (roomType === 'gallery' && goals.includes('quiet')) score += 6;
  if (roomType === 'retail' && goals.includes('shopping')) score += 7;
  if (roomType === 'observation' && goals.includes('publicity')) score += 7;
  if (roomType === 'office' && (goals.includes('meeting') || goals.includes('publicity')))
    score += 5;
  if (roomType === 'cafe' && goals.includes('shopping')) score += 3;
  if (roomType === 'office' && goals.includes('quiet')) score += 2;
  if (roomType === 'cafe') score += 1;
  if (roomType === 'hotel') score += 1;
  if (roomType === 'office') score += 1;
  return score;
}

export function chooseVisitVenue(
  tower: TowerState,
  goals: VisitorGoal[],
  random: () => number = Math.random,
): string | null {
  const candidates = tower.rooms.filter((room) =>
    [
      'cafe',
      'hotel',
      'office',
      'eventHall',
      'retail',
      'observation',
      'conference',
      'gallery',
    ].includes(room.type),
  );
  if (candidates.length === 0) return null;
  const ranked = candidates
    .map((room) => ({ room, score: roomPriority(room.type, goals) + random() * 0.25 }))
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.room.id ?? null;
}

function varyTraits(base: VisitorTraitVector, random: () => number): VisitorTraitVector {
  const vary = (value: number) => clamp01(value + (random() - 0.5) * 0.14);
  return {
    ego: vary(base.ego),
    patience: vary(base.patience),
    spendingPower: vary(base.spendingPower),
    cleanlinessDemand: vary(base.cleanlinessDemand),
    privacyDemand: vary(base.privacyDemand),
    noiseTolerance: vary(base.noiseTolerance),
    groupCohesion: vary(base.groupCohesion),
    statusSensitivity: vary(base.statusSensitivity),
    kindness: vary(base.kindness),
  };
}

export function generateVisitCohort(
  seed: number,
  tower: TowerState,
  schedule: { day?: number; hour?: number } = {},
  context: VisitGenerationContext = {},
  idFactory: (prefix?: string) => string = generateId,
): VisitCohort {
  const random = createSeededRandom(seed);
  const archetype = chooseArchetype(random, tower, context);
  const activeIdentity = context.towerIdentity ?? estimateIdentity(tower);
  const sizeRange = archetype.maxSize - archetype.minSize;
  const createdHour = schedule.hour ?? 9;
  const size = archetype.minSize + Math.round(random() * sizeRange);
  const representativeCount = Math.max(1, Math.min(8, Math.ceil(size / 12)));
  return {
    id: idFactory('visit'),
    archetypeId: archetype.id,
    label: archetype.label,
    size,
    traits: applyIdentityTraitDelta(varyTraits(archetype.traits, random), activeIdentity),
    goals: [...archetype.goals],
    volatility: clamp01(archetype.volatility + (random() - 0.5) * 0.12),
    status: 'inquiry',
    createdDay: schedule.day ?? 1,
    createdHour,
    arrivalHour: Math.min(22, createdHour + 1 + Math.floor(random() * 3)),
    dwellHours: 1 + Math.floor(random() * 3),
    targetRoomId: chooseVisitVenue(tower, archetype.goals, random),
    representativeCount,
    spawnedAgents: 0,
    spendCollected: false,
    memory: createInitialVisitMemory(schedule.day ?? 1, createdHour),
  };
}

export function createInitialVisitMemory(day = 1, hour = 9): VisitMemory {
  return {
    sentiment: 72,
    frictionScore: 0,
    outcome: 'pending',
    impressions: ['The visit has not formed a public story yet.'],
    pressureReasons: [],
    updatedDay: day,
    updatedHour: hour,
  };
}

function inferPressureReasonsFromImpressions(impressions: readonly string[]): string[] {
  const text = impressions.join(' ').toLowerCase();
  const reasons = new Set<string>();
  if (text.includes('wait') || text.includes('queue')) reasons.add('queues');
  if (text.includes('clean')) reasons.add('cleanliness');
  if (text.includes('service')) reasons.add('service');
  if (text.includes('noise') || text.includes('orderly')) reasons.add('noise');
  if (text.includes('privacy')) reasons.add('privacy');
  if (text.includes('safety')) reasons.add('safety');
  if (text.includes('weather') || text.includes('height')) reasons.add('weather');
  return [...reasons];
}

export function normalizeVisitMemory(
  memory: Partial<VisitMemory> | undefined,
  day = 1,
  hour = 9,
): VisitMemory {
  const fallback = createInitialVisitMemory(day, hour);
  const impressions =
    memory?.impressions && memory.impressions.length > 0
      ? [...memory.impressions]
      : fallback.impressions;
  const pressureReasons =
    memory?.pressureReasons && memory.pressureReasons.length > 0
      ? [...memory.pressureReasons]
      : inferPressureReasonsFromImpressions(impressions);
  return {
    ...fallback,
    ...memory,
    impressions,
    pressureReasons,
  };
}

export function normalizeVisitMemoryRecord(memory: Partial<VisitMemoryRecord>): VisitMemoryRecord {
  const archetype = VISITOR_ARCHETYPES[memory.archetypeId ?? 'school-teachers'];
  const resolvedDay = memory.resolvedDay ?? memory.updatedDay ?? memory.createdDay ?? 1;
  const normalized = normalizeVisitMemory(memory, resolvedDay, memory.updatedHour ?? 9);
  return {
    ...normalized,
    id: memory.id ?? generateId('visit-memory'),
    cohortId: memory.cohortId ?? memory.id ?? generateId('visit-cohort'),
    archetypeId: memory.archetypeId ?? archetype.id,
    label: memory.label ?? archetype.label,
    size: memory.size ?? archetype.minSize,
    createdDay: memory.createdDay ?? resolvedDay,
    resolvedDay,
  };
}

export function normalizeVisitCohort(visit: Partial<VisitCohort>): VisitCohort {
  const fallback = VISITOR_ARCHETYPES[visit.archetypeId ?? 'school-teachers'];
  const createdDay = visit.createdDay ?? 1;
  const createdHour = visit.createdHour ?? 9;
  return {
    id: visit.id ?? generateId('visit'),
    archetypeId: visit.archetypeId ?? fallback.id,
    label: visit.label ?? fallback.label,
    size: visit.size ?? fallback.minSize,
    traits: visit.traits ?? fallback.traits,
    goals: visit.goals ?? [...fallback.goals],
    volatility: visit.volatility ?? fallback.volatility,
    status: visit.status ?? 'inquiry',
    createdDay,
    createdHour,
    arrivalHour: visit.arrivalHour ?? Math.min(22, createdHour + 1),
    dwellHours: visit.dwellHours ?? 2,
    targetRoomId: visit.targetRoomId ?? null,
    representativeCount:
      visit.representativeCount ??
      Math.max(1, Math.min(8, Math.ceil((visit.size ?? fallback.minSize) / 12))),
    spawnedAgents: visit.spawnedAgents ?? 0,
    spendCollected: visit.spendCollected ?? false,
    memory: normalizeVisitMemory(visit.memory, createdDay, createdHour),
  };
}

export function estimateCohortSpend(cohort: VisitCohort): number {
  const basePerVisitor = 14 + Math.round(cohort.traits.spendingPower * 86);
  const goalMultiplier =
    1 +
    (cohort.goals.includes('food') ? 0.18 : 0) +
    (cohort.goals.includes('lodging') ? 0.55 : 0) +
    (cohort.goals.includes('shopping') ? 0.34 : 0) +
    (cohort.goals.includes('publicity') ? 0.12 : 0);
  return Math.max(25, Math.round(cohort.size * basePerVisitor * goalMultiplier));
}

export function evaluateCohortFriction(
  cohort: VisitCohort,
  economy: EconomyState,
  context: CohortExperienceContext = {},
): CohortFriction {
  const transit = (economy.transitPressure / 100) * (1 - cohort.traits.patience) * 44;
  const dirt = ((100 - economy.cleanliness) / 100) * cohort.traits.cleanlinessDemand * 36;
  const service = (economy.servicePressure / 100) * cohort.traits.statusSensitivity * 22;
  const quietMismatch = cohort.goals.includes('quiet')
    ? (economy.transitPressure / 100) * (1 - cohort.traits.noiseTolerance) * 18
    : 0;
  const privacy =
    context.privacyComfort !== undefined
      ? ((100 - context.privacyComfort) / 100) * cohort.traits.privacyDemand * 26
      : 0;
  const noise =
    context.noiseControl !== undefined
      ? ((100 - context.noiseControl) / 100) * (1 - cohort.traits.noiseTolerance) * 24
      : 0;
  const safety =
    context.safetyReadiness !== undefined
      ? ((100 - context.safetyReadiness) / 100) *
        (cohort.traits.statusSensitivity * 0.55 + cohort.traits.groupCohesion * 0.2) *
        22
      : 0;
  const weather =
    context.weatherRisk !== undefined
      ? (context.weatherRisk / 100) *
        (1 - cohort.traits.patience) *
        (cohort.goals.includes('publicity') ? 18 : 10)
      : 0;
  const egoAmplifier = 1 + cohort.traits.ego * cohort.volatility;
  const groupAmplifier = 1 + cohort.traits.groupCohesion * 0.22;
  const kindnessDampener = 1 - cohort.traits.kindness * 0.18;
  const score = Math.round(
    (transit + dirt + service + quietMismatch + privacy + noise + safety + weather) *
      egoAmplifier *
      groupAmplifier *
      kindnessDampener,
  );
  const reasons: string[] = [];
  if (transit > 12) reasons.push('queues');
  if (dirt > 10) reasons.push('cleanliness');
  if (service > 8) reasons.push('service');
  if (quietMismatch > 6 || noise > 6) reasons.push('noise');
  if (privacy > 8) reasons.push('privacy');
  if (safety > 8) reasons.push('safety');
  if (weather > 7) reasons.push('weather');
  const mood =
    score >= 65 ? 'angry' : score >= 38 ? 'annoyed' : score <= 10 ? 'delighted' : 'steady';
  return { score, reasons, mood };
}

function outcomeForFriction(friction: CohortFriction): VisitOutcome {
  if (friction.mood === 'delighted') return 'praised';
  if (friction.mood === 'angry') return 'complained';
  if (friction.mood === 'annoyed') return 'mixed';
  return 'mixed';
}

function impressionsForFriction(cohort: VisitCohort, friction: CohortFriction): string[] {
  if (friction.reasons.length === 0) {
    if (cohort.traits.kindness > 0.8) return ['The group left calm, grateful, and easy to host.'];
    if (cohort.traits.ego > 0.75) return ['The group got the status signal it expected.'];
    return ['The visit felt orderly and uneventful in the best way.'];
  }
  const impressions = friction.reasons.map((reason) => {
    if (reason === 'queues') return 'They remembered waiting more than the architecture.';
    if (reason === 'cleanliness') return 'Cleanliness shaped the story they told afterward.';
    if (reason === 'service') return 'Service coverage did not match the group profile.';
    if (reason === 'noise') return 'Noise undermined the group dynamic.';
    if (reason === 'privacy') return 'Privacy failures became the visit story.';
    if (reason === 'safety') return 'Safety readiness felt less convincing than the skyline.';
    if (reason === 'weather')
      return 'Weather exposure made the height feel risky instead of grand.';
    return `Pressure point: ${reason}.`;
  });
  if (cohort.archetypeId === 'stamp-collectors' && friction.reasons.includes('noise')) {
    impressions.push('Stamp collectors were polite until the room stopped feeling orderly.');
  }
  return impressions;
}

export function rememberCohortExperience(
  cohort: VisitCohort,
  economy: EconomyState,
  schedule: { day: number; hour: number },
  context: CohortExperienceContext = {},
): VisitCohort {
  const friction = evaluateCohortFriction(cohort, economy, context);
  return {
    ...cohort,
    memory: {
      sentiment: clamp100(100 - friction.score),
      frictionScore: friction.score,
      outcome: outcomeForFriction(friction),
      impressions: impressionsForFriction(cohort, friction),
      pressureReasons: friction.reasons,
      updatedDay: schedule.day,
      updatedHour: schedule.hour,
    },
  };
}

export function createVisitMemoryRecord(
  cohort: VisitCohort,
  schedule: { day: number; hour: number },
): VisitMemoryRecord {
  const memory =
    cohort.memory.outcome === 'pending'
      ? {
          ...cohort.memory,
          outcome: 'mixed' as const,
          pressureReasons: cohort.memory.pressureReasons ?? [],
          updatedDay: schedule.day,
          updatedHour: schedule.hour,
        }
      : cohort.memory;
  return {
    ...memory,
    id: generateId('visit-memory'),
    cohortId: cohort.id,
    archetypeId: cohort.archetypeId,
    label: cohort.label,
    size: cohort.size,
    createdDay: cohort.createdDay,
    resolvedDay: schedule.day,
  };
}
