import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialEconomy, createInitialTower } from '@/simulation/initialState';
import { placeBuild } from '@/simulation/placement';
import { resetIdsForTests } from '@/simulation/random';
import {
  createInitialVisitMemory,
  describeVisitorBehavior,
  evaluateCohortFriction,
  generateVisitCohort,
  rememberCohortExperience,
  VISITOR_ARCHETYPES,
  type VisitCohort,
} from '@/simulation/visitors';

beforeEach(() => resetIdsForTests());

function buildVenueTower() {
  let tower = createInitialTower();
  let economy = createInitialEconomy();
  for (const [tool, start, end] of [
    ['lobby', { gx: 0, gy: 0 }, { gx: 8, gy: 0 }],
    ['floor', { gx: 0, gy: 1 }, { gx: 8, gy: 1 }],
    ['cafe', { gx: 0, gy: 1 }, { gx: 2, gy: 1 }],
    ['hotel', { gx: 3, gy: 1 }, { gx: 4, gy: 1 }],
  ] as const) {
    const result = placeBuild(tower, economy, tool, { start, end }, 0);
    if (!result.ok) throw new Error(result.message);
    tower = result.tower;
    economy = result.economy;
  }
  return tower;
}

describe('visitor cohort archetypes', () => {
  it('generates deterministic visit cohorts from tower context and seed', () => {
    const run = () => {
      resetIdsForTests();
      return generateVisitCohort(42, buildVenueTower());
    };

    expect(run()).toEqual(run());
  });

  it('biases generated visits from fame, trust, pressure, and tower identity', () => {
    const tower = buildVenueTower();
    const countArchetypes = (context: Parameters<typeof generateVisitCohort>[3], ids: string[]) =>
      Array.from(
        { length: 90 },
        (_, index) =>
          generateVisitCohort(0x9e37_79b9 + index * 104_729, tower, {}, context).archetypeId,
      ).filter((id) => ids.includes(id)).length;

    const baselinePrestige = countArchetypes({}, ['movie-star', 'foreign-prince', 'press-swarm']);
    const highFamePrestige = countArchetypes(
      { fame: 95, publicTrust: 82, towerIdentity: 'hospitality' },
      ['movie-star', 'foreign-prince', 'press-swarm'],
    );
    const baselineScrutiny = countArchetypes({}, ['city-inspectors', 'press-swarm']);
    const pressureScrutiny = countArchetypes(
      {
        economy: {
          ...createInitialEconomy(),
          cleanliness: 48,
          servicePressure: 78,
          tenantSatisfaction: 36,
          transitPressure: 88,
        },
        publicTrust: 34,
        regulationPressure: 72,
        scandalRisk: 78,
        weatherRisk: 66,
      },
      ['city-inspectors', 'press-swarm'],
    );

    expect(highFamePrestige).toBeGreaterThan(baselinePrestige);
    expect(pressureScrutiny).toBeGreaterThan(baselineScrutiny);
  });

  it('models flock friction without hard-coded VIP checklists', () => {
    const cohort = generateVisitCohort(140, buildVenueTower());
    const calm = evaluateCohortFriction(cohort, {
      ...createInitialEconomy(),
      cleanliness: 100,
      transitPressure: 0,
      servicePressure: 0,
    });
    const strained = evaluateCohortFriction(cohort, {
      ...createInitialEconomy(),
      cleanliness: 35,
      transitPressure: 90,
      servicePressure: 70,
    });

    expect(strained.score).toBeGreaterThan(calm.score);
    expect(strained.reasons.length).toBeGreaterThan(0);
  });

  it('lets operations pressure shape cohort memory reasons', () => {
    const archetype = VISITOR_ARCHETYPES['movie-star'];
    const cohort: VisitCohort = {
      id: 'movie-star-test',
      archetypeId: archetype.id,
      label: archetype.label,
      size: 8,
      traits: archetype.traits,
      goals: archetype.goals,
      volatility: archetype.volatility,
      status: 'inside',
      createdDay: 2,
      createdHour: 12,
      arrivalHour: 13,
      dwellHours: 2,
      targetRoomId: null,
      representativeCount: 1,
      spawnedAgents: 1,
      spendCollected: true,
      memory: createInitialVisitMemory(),
    };

    const friction = evaluateCohortFriction(
      cohort,
      { ...createInitialEconomy(), cleanliness: 100, transitPressure: 0, servicePressure: 0 },
      {
        noiseControl: 15,
        privacyComfort: 10,
        safetyReadiness: 20,
        weatherRisk: 95,
      },
    );
    const remembered = rememberCohortExperience(
      cohort,
      { ...createInitialEconomy(), cleanliness: 100, transitPressure: 0, servicePressure: 0 },
      { day: 2, hour: 15 },
      {
        noiseControl: 15,
        privacyComfort: 10,
        safetyReadiness: 20,
        weatherRisk: 95,
      },
    );

    expect(friction.reasons).toEqual(
      expect.arrayContaining(['noise', 'privacy', 'safety', 'weather']),
    );
    expect(remembered.memory.pressureReasons).toEqual(
      expect.arrayContaining(['noise', 'privacy', 'safety', 'weather']),
    );
    expect(remembered.memory.impressions.join(' ')).toContain('Privacy');
  });

  it('can make stamp collectors angry when quiet order collapses', () => {
    const archetype = VISITOR_ARCHETYPES['stamp-collectors'];
    const cohort: VisitCohort = {
      id: 'stamp-test',
      archetypeId: archetype.id,
      label: archetype.label,
      size: 42,
      traits: archetype.traits,
      goals: archetype.goals,
      volatility: archetype.volatility,
      status: 'inquiry',
      createdDay: 1,
      createdHour: 9,
      arrivalHour: 10,
      dwellHours: 2,
      targetRoomId: null,
      representativeCount: 4,
      spawnedAgents: 0,
      spendCollected: false,
      memory: createInitialVisitMemory(),
    };

    const friction = evaluateCohortFriction(cohort, {
      ...createInitialEconomy(),
      cleanliness: 0,
      transitPressure: 100,
      servicePressure: 100,
    });

    expect(friction.mood).toBe('angry');
    expect(friction.reasons).toEqual(expect.arrayContaining(['queues', 'cleanliness', 'noise']));
  });

  it('derives behavior profiles from cohort traits instead of fixed milestone scripts', () => {
    const prince = describeVisitorBehavior(VISITOR_ARCHETYPES['foreign-prince']);
    const teachers = describeVisitorBehavior(VISITOR_ARCHETYPES['school-teachers']);
    const collectors = describeVisitorBehavior(VISITOR_ARCHETYPES['stamp-collectors']);

    expect(prince.temperament).toBe('status-sensitive');
    expect(prince.dealbreakers).toEqual(
      expect.arrayContaining(['uncontrolled crowds', 'unsafe or unimpressive venues']),
    );
    expect(teachers.summary).toContain('Forgiving people');
    expect(teachers.values).toEqual(expect.arrayContaining(['organized gathering space']));
    expect(collectors.temperament).toBe('quiet-order');
    expect(collectors.dealbreakers).toContain('noise bleeding into quiet rooms');
  });

  it('turns cohort friction into durable visit memory', () => {
    const cohort = rememberCohortExperience(
      generateVisitCohort(510, buildVenueTower()),
      {
        ...createInitialEconomy(),
        cleanliness: 20,
        transitPressure: 95,
        servicePressure: 90,
      },
      {
        day: 3,
        hour: 14,
      },
    );

    expect(cohort.memory.sentiment).toBeLessThan(75);
    expect(cohort.memory.outcome).not.toBe('pending');
    expect(cohort.memory.impressions.length).toBeGreaterThan(0);
    expect(cohort.memory.pressureReasons.length).toBeGreaterThan(0);
  });
});
