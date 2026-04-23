import { beforeEach, describe, expect, it } from 'vitest';
import {
  personalityFromSeed,
  personalityFromVisitTraits,
  selectAgentIntent,
} from '@/simulation/ai/personality';
import { createInitialEconomy, createInitialTower } from '@/simulation/initialState';
import { placeBuild } from '@/simulation/placement';
import { resetIdsForTests } from '@/simulation/random';
import type { Agent, EconomyState, TowerState } from '@/simulation/types';
import {
  createInitialVisitMemory,
  VISITOR_ARCHETYPES,
  type VisitCohort,
} from '@/simulation/visitors';

beforeEach(() => resetIdsForTests());

function buildCafeFixture(): { tower: TowerState; economy: EconomyState } {
  let tower = createInitialTower();
  let economy = createInitialEconomy();
  for (const [tool, start, end] of [
    ['lobby', { gx: 0, gy: 0 }, { gx: 5, gy: 0 }],
    ['floor', { gx: 0, gy: 1 }, { gx: 5, gy: 1 }],
    ['cafe', { gx: 0, gy: 1 }, { gx: 2, gy: 1 }],
    ['office', { gx: 3, gy: 1 }, { gx: 4, gy: 1 }],
  ] as const) {
    const result = placeBuild(tower, economy, tool, { start, end }, 0);
    if (!result.ok) throw new Error(result.message);
    tower = result.tower;
    economy = result.economy;
  }
  return { tower, economy };
}

function buildVisitorVenueFixture(): { tower: TowerState; economy: EconomyState } {
  let tower = createInitialTower();
  let economy = { ...createInitialEconomy(), funds: 500_000 };
  for (const [tool, start, end] of [
    ['lobby', { gx: 0, gy: 0 }, { gx: 8, gy: 0 }],
    ['floor', { gx: 0, gy: 1 }, { gx: 8, gy: 1 }],
    ['elevator', { gx: 0, gy: 0 }, { gx: 0, gy: 1 }],
    ['office', { gx: 1, gy: 1 }, { gx: 2, gy: 1 }],
    ['gallery', { gx: 3, gy: 1 }, { gx: 5, gy: 1 }],
    ['cafe', { gx: 6, gy: 1 }, { gx: 8, gy: 1 }],
  ] as const) {
    const result = placeBuild(tower, economy, tool, { start, end }, 0);
    if (!result.ok) throw new Error(result.message);
    tower = result.tower;
    economy = result.economy;
  }
  return { tower, economy };
}

function worker(personality: Agent['personality']): Agent {
  return {
    id: `${personality}-worker`,
    type: 'worker',
    x: 3,
    y: 1,
    floor: 1,
    targetX: 3,
    targetFloor: 1,
    targetId: 'office',
    state: 'working',
    color: '#CFD6D8',
    seed: 0.5,
    personality,
    intent: 'work',
    waitTicks: 0,
  };
}

function visitor(personality: Agent['personality']): Agent {
  return {
    id: `${personality}-visitor`,
    type: 'visitor',
    x: 0,
    y: 0,
    floor: 0,
    targetX: 1,
    targetFloor: 1,
    targetId: 'office',
    state: 'walking',
    color: '#B9A7A0',
    seed: 0.5,
    personality,
    intent: 'visit',
    waitTicks: 0,
    cohortId: 'cohort',
  };
}

function cohortFor(archetypeId: keyof typeof VISITOR_ARCHETYPES): VisitCohort {
  const archetype = VISITOR_ARCHETYPES[archetypeId];
  return {
    id: 'cohort',
    archetypeId: archetype.id,
    label: archetype.label,
    size: 24,
    traits: archetype.traits,
    goals: archetype.goals,
    volatility: archetype.volatility,
    status: 'arriving',
    createdDay: 1,
    createdHour: 9,
    arrivalHour: 10,
    dwellHours: 2,
    targetRoomId: null,
    representativeCount: 1,
    spawnedAgents: 1,
    spendCollected: false,
    memory: createInitialVisitMemory(),
  };
}

describe('agent personalities', () => {
  it('assigns deterministic personality profiles from agent type and seed', () => {
    expect(personalityFromSeed('worker', 0.1)).toBe('punctual');
    expect(personalityFromSeed('worker', 0.4)).toBe('social');
    expect(personalityFromSeed('worker', 0.7)).toBe('comfort');
    expect(personalityFromSeed('worker', 0.9)).toBe('impatient');
    expect(personalityFromSeed('janitor', 0.9)).toBe('diligent');
  });

  it('maps visitor cohort traits into representative personalities', () => {
    expect(personalityFromVisitTraits(VISITOR_ARCHETYPES['foreign-prince'].traits, 0.2)).toBe(
      'status',
    );
    expect(personalityFromVisitTraits(VISITOR_ARCHETYPES['school-teachers'].traits, 0.2)).toBe(
      'civic',
    );
    expect(personalityFromVisitTraits(VISITOR_ARCHETYPES['stamp-collectors'].traits, 0.2)).toBe(
      'quiet',
    );
    expect(personalityFromVisitTraits(VISITOR_ARCHETYPES['press-swarm'].traits, 0.9)).toBe(
      'impatient',
    );
  });

  it('uses Yuka goal evaluators so personalities choose different lunch goals', () => {
    const { tower, economy } = buildCafeFixture();

    const social = selectAgentIntent(
      worker('social'),
      tower,
      { ...economy, transitPressure: 0 },
      12,
    );
    const punctual = selectAgentIntent(
      worker('punctual'),
      tower,
      { ...economy, transitPressure: 100 },
      12,
    );

    expect(social.intent).toBe('eat');
    expect(social.targetRoom?.type).toBe('cafe');
    expect(punctual.intent).toBe('work');
  });

  it('sends diligent janitors toward dirty service targets', () => {
    const { tower, economy } = buildCafeFixture();
    const dirtyCafe = tower.rooms.find((room) => room.type === 'cafe');
    if (!dirtyCafe) throw new Error('expected cafe');
    dirtyCafe.dirt = 90;
    const janitor: Agent = {
      id: 'diligent-janitor',
      type: 'janitor',
      x: 0,
      y: 1,
      floor: 1,
      targetX: 0,
      targetFloor: 1,
      targetId: 'maint',
      state: 'idle',
      color: '#78A87F',
      seed: 0.8,
      personality: 'diligent',
      intent: 'idle',
      waitTicks: 0,
    };

    const decision = selectAgentIntent(janitor, tower, economy, 9);

    expect(decision.intent).toBe('clean');
    expect(decision.targetRoom?.id).toBe(dirtyCafe.id);
  });

  it('uses visitor goal evaluators so cohort traits change venue choice', () => {
    const { tower, economy } = buildVisitorVenueFixture();

    const quietDecision = selectAgentIntent(
      visitor('quiet'),
      tower,
      economy,
      10,
      cohortFor('stamp-collectors'),
    );
    const foodDecision = selectAgentIntent(
      visitor('social'),
      tower,
      economy,
      10,
      cohortFor('movie-star'),
    );

    expect(quietDecision.intent).toBe('visit');
    expect(quietDecision.targetRoom?.type).toBe('gallery');
    expect(foodDecision.intent).toBe('visit');
    expect(foodDecision.targetRoom?.type).toBe('cafe');
  });
});
