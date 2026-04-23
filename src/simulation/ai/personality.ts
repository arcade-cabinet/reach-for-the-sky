import { GoalEvaluator, Think } from 'yuka';
import type {
  Agent,
  AgentIntent,
  AgentPersonality,
  BuildingId,
  EconomyState,
  TowerRoom,
  TowerState,
} from '../types';
import { BUILDINGS } from '../types';
import type { VisitCohort, VisitorGoal, VisitorTraitVector } from '../visitors';

interface PersonalityProfile {
  lunchBias: number;
  punctuality: number;
  patience: number;
  cleanlinessSensitivity: number;
  serviceBias: number;
}

export const PERSONALITY_PROFILES: Record<AgentPersonality, PersonalityProfile> = {
  punctual: {
    lunchBias: 0.35,
    punctuality: 0.95,
    patience: 0.72,
    cleanlinessSensitivity: 0.42,
    serviceBias: 0.42,
  },
  social: {
    lunchBias: 0.95,
    punctuality: 0.46,
    patience: 0.66,
    cleanlinessSensitivity: 0.54,
    serviceBias: 0.5,
  },
  comfort: {
    lunchBias: 0.78,
    punctuality: 0.52,
    patience: 0.5,
    cleanlinessSensitivity: 0.95,
    serviceBias: 0.6,
  },
  impatient: {
    lunchBias: 0.52,
    punctuality: 0.7,
    patience: 0.22,
    cleanlinessSensitivity: 0.62,
    serviceBias: 0.45,
  },
  diligent: {
    lunchBias: 0.28,
    punctuality: 0.82,
    patience: 0.78,
    cleanlinessSensitivity: 0.8,
    serviceBias: 0.98,
  },
  status: {
    lunchBias: 0.68,
    punctuality: 0.66,
    patience: 0.28,
    cleanlinessSensitivity: 0.86,
    serviceBias: 0.74,
  },
  civic: {
    lunchBias: 0.46,
    punctuality: 0.74,
    patience: 0.84,
    cleanlinessSensitivity: 0.72,
    serviceBias: 0.72,
  },
  quiet: {
    lunchBias: 0.38,
    punctuality: 0.62,
    patience: 0.64,
    cleanlinessSensitivity: 0.76,
    serviceBias: 0.48,
  },
};

export interface AgentDecisionContext {
  agent: Agent;
  tower: TowerState;
  economy: EconomyState;
  hour: number;
  intent: AgentIntent;
  targetRoom?: TowerRoom;
  cohort?: VisitCohort;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function personalityFromSeed(type: Agent['type'], seed: number): AgentPersonality {
  if (type === 'janitor') return seed > 0.35 ? 'diligent' : 'impatient';
  if (type === 'guest') {
    if (seed > 0.78) return 'status';
    return seed > 0.5 ? 'comfort' : 'social';
  }
  if (type === 'visitor') {
    if (seed < 0.24) return 'social';
    if (seed < 0.48) return 'comfort';
    if (seed < 0.68) return 'quiet';
    if (seed < 0.84) return 'civic';
    return 'impatient';
  }
  if (seed < 0.28) return 'punctual';
  if (seed < 0.56) return 'social';
  if (seed < 0.8) return 'comfort';
  return 'impatient';
}

export function personalityFromVisitTraits(
  traits: VisitorTraitVector,
  seed: number,
): AgentPersonality {
  const statusPressure = traits.statusSensitivity * 0.6 + traits.ego * 0.4;
  if (statusPressure > 0.78 && traits.kindness < 0.58) return 'status';
  if (traits.privacyDemand > 0.74 || traits.noiseTolerance < 0.32) return 'quiet';
  if (traits.kindness > 0.82 || (traits.groupCohesion > 0.86 && traits.ego < 0.36)) {
    return 'civic';
  }
  if (traits.patience < 0.36) return 'impatient';
  if (traits.groupCohesion > 0.76 || seed < 0.25) return 'social';
  if (traits.cleanlinessDemand > 0.72) return 'comfort';
  return personalityFromSeed('visitor', seed);
}

function profileFor(agent: Agent): PersonalityProfile {
  return PERSONALITY_PROFILES[agent.personality] ?? PERSONALITY_PROFILES.punctual;
}

function firstCafe(tower: TowerState): TowerRoom | undefined {
  return tower.rooms.find((room) => room.type === 'cafe');
}

function roomsByPreference(tower: TowerState, types: BuildingId[]): TowerRoom[] {
  return tower.rooms.filter((room) => types.includes(room.type));
}

function bestVisitorRoom(
  tower: TowerState,
  cohort: VisitCohort,
  types: BuildingId[],
): TowerRoom | undefined {
  return roomsByPreference(tower, types)
    .map((room) => {
      const dirtPenalty = (room.dirt / 100) * cohort.traits.cleanlinessDemand * 18;
      const widthBonus = Math.min(10, room.width * 1.5);
      const heightBonus = Math.min(8, room.y * 0.8);
      return { room, score: widthBonus + heightBonus - dirtPenalty };
    })
    .sort((a, b) => b.score - a.score)[0]?.room;
}

function dirtiestServiceTarget(tower: TowerState): TowerRoom | undefined {
  return [...tower.rooms]
    .filter((room) => {
      const category = BUILDINGS[room.type].cat;
      return room.dirt > 30 && category !== 'infra' && category !== 'trans';
    })
    .sort((a, b) => b.dirt - a.dirt)[0];
}

class EatAtCafeEvaluator extends GoalEvaluator {
  override calculateDesirability(owner: AgentDecisionContext): number {
    const { agent, economy, hour, tower } = owner;
    if (agent.type !== 'worker' || agent.hadLunch || hour !== 12 || !firstCafe(tower)) return 0;
    const profile = profileFor(agent);
    const transitFriction = (economy.transitPressure / 100) * profile.punctuality * 0.55;
    const hungerWindow = hour === 12 ? 0.28 : 0;
    return clamp01(hungerWindow + profile.lunchBias * 0.72 - transitFriction);
  }

  override setGoal(owner: AgentDecisionContext): void {
    owner.intent = 'eat';
    owner.targetRoom = firstCafe(owner.tower);
  }
}

class KeepWorkingEvaluator extends GoalEvaluator {
  override calculateDesirability(owner: AgentDecisionContext): number {
    if (owner.agent.type !== 'worker') return 0;
    const profile = profileFor(owner.agent);
    const pressure = owner.economy.transitPressure / 100;
    return clamp01(0.25 + profile.punctuality * 0.54 + pressure * profile.punctuality * 0.28);
  }

  override setGoal(owner: AgentDecisionContext): void {
    owner.intent = 'work';
  }
}

class ExitEvaluator extends GoalEvaluator {
  override calculateDesirability(owner: AgentDecisionContext): number {
    if (owner.agent.type !== 'worker' || owner.hour < 17) return 0;
    const profile = profileFor(owner.agent);
    return clamp01(0.62 + profile.punctuality * 0.28 + (1 - profile.patience) * 0.1);
  }

  override setGoal(owner: AgentDecisionContext): void {
    owner.intent = 'exit';
  }
}

class CleanRoomEvaluator extends GoalEvaluator {
  override calculateDesirability(owner: AgentDecisionContext): number {
    if (owner.agent.type !== 'janitor') return 0;
    const dirty = dirtiestServiceTarget(owner.tower);
    if (!dirty) return 0;
    const profile = profileFor(owner.agent);
    return clamp01(0.15 + profile.serviceBias * 0.65 + (dirty.dirt / 100) * 0.35);
  }

  override setGoal(owner: AgentDecisionContext): void {
    owner.intent = 'clean';
    owner.targetRoom = dirtiestServiceTarget(owner.tower);
  }
}

class VisitorRoomEvaluator extends GoalEvaluator {
  readonly goals: VisitorGoal[];
  readonly preferredTypes: BuildingId[];
  readonly desirability: (owner: AgentDecisionContext, profile: PersonalityProfile) => number;

  constructor(
    goals: VisitorGoal[],
    preferredTypes: BuildingId[],
    desirability: (owner: AgentDecisionContext, profile: PersonalityProfile) => number,
    characterBias = 1,
  ) {
    super(characterBias);
    this.goals = goals;
    this.preferredTypes = preferredTypes;
    this.desirability = desirability;
  }

  override calculateDesirability(owner: AgentDecisionContext): number {
    if (owner.agent.type !== 'visitor' || !owner.cohort) return 0;
    if (!this.goals.some((goal) => owner.cohort?.goals.includes(goal))) return 0;
    if (!bestVisitorRoom(owner.tower, owner.cohort, this.preferredTypes)) return 0;
    return clamp01(this.desirability(owner, profileFor(owner.agent)) * this.characterBias);
  }

  override setGoal(owner: AgentDecisionContext): void {
    if (!owner.cohort) return;
    owner.intent = 'visit';
    owner.targetRoom = bestVisitorRoom(owner.tower, owner.cohort, this.preferredTypes);
  }
}

class IdleEvaluator extends GoalEvaluator {
  override calculateDesirability(): number {
    return 0.08;
  }

  override setGoal(owner: AgentDecisionContext): void {
    owner.intent = 'idle';
  }
}

export function selectAgentIntent(
  agent: Agent,
  tower: TowerState,
  economy: EconomyState,
  hour: number,
  cohort?: VisitCohort,
): AgentDecisionContext {
  const context: AgentDecisionContext = { agent, tower, economy, hour, intent: 'idle', cohort };
  const thinker = new Think(context);
  thinker
    .addEvaluator(new EatAtCafeEvaluator(profileFor(agent).lunchBias))
    .addEvaluator(new KeepWorkingEvaluator(profileFor(agent).punctuality))
    .addEvaluator(new ExitEvaluator(profileFor(agent).punctuality))
    .addEvaluator(new CleanRoomEvaluator(profileFor(agent).serviceBias))
    .addEvaluator(
      new VisitorRoomEvaluator(
        ['quiet'],
        ['gallery', 'skyGarden', 'conference', 'office'],
        (owner, profile) =>
          0.2 +
          (1 - (owner.cohort?.traits.noiseTolerance ?? 0.5)) * 0.52 +
          profile.cleanlinessSensitivity * 0.16 -
          owner.economy.transitPressure / 500,
      ),
    )
    .addEvaluator(
      new VisitorRoomEvaluator(
        ['publicity', 'lodging'],
        ['observation', 'luxurySuite', 'hotel', 'eventHall'],
        (owner) =>
          0.18 +
          (owner.cohort?.traits.statusSensitivity ?? 0) * 0.5 +
          (owner.cohort?.traits.ego ?? 0) * 0.28,
      ),
    )
    .addEvaluator(
      new VisitorRoomEvaluator(
        ['meeting', 'publicity'],
        ['conference', 'eventHall', 'office', 'gallery'],
        (owner) =>
          0.24 +
          (owner.cohort?.traits.groupCohesion ?? 0.5) * 0.28 +
          (owner.cohort?.traits.patience ?? 0.5) * 0.22,
      ),
    )
    .addEvaluator(
      new VisitorRoomEvaluator(
        ['shopping'],
        ['retail', 'observation', 'gallery'],
        (owner) => 0.18 + (owner.cohort?.traits.spendingPower ?? 0.4) * 0.52,
      ),
    )
    .addEvaluator(
      new VisitorRoomEvaluator(
        ['food'],
        ['cafe', 'hotel', 'retail'],
        (owner, profile) =>
          0.18 + profile.lunchBias * 0.34 + (owner.cohort?.traits.kindness ?? 0.5) * 0.12,
      ),
    )
    .addEvaluator(new IdleEvaluator(0.2));
  thinker.arbitrate();
  return context;
}
