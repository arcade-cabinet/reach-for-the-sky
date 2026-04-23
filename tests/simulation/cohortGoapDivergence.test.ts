import { describe, expect, it } from 'vitest';
import { AUTHORED_VISITOR_ARCHETYPES } from '@/content/cohorts';
import { createInitialEconomy } from '@/simulation/initialState';
import { planVisitorHosting } from '@/simulation/visitorPlanning';
import { VISITOR_ARCHETYPES, type VisitCohort } from '@/simulation/visitors';

function cohortOf(archetypeId: keyof typeof VISITOR_ARCHETYPES): VisitCohort {
  const archetype = VISITOR_ARCHETYPES[archetypeId];
  return {
    id: `cohort-${archetypeId}`,
    archetypeId: archetype.id,
    label: archetype.label,
    size: archetype.minSize,
    traits: { ...archetype.traits },
    goals: [...archetype.goals],
    volatility: archetype.volatility,
    status: 'inquiry',
    createdDay: 1,
    createdHour: 10,
    arrivalHour: 12,
    dwellHours: 3,
    targetRoomId: null,
    representativeCount: 0,
    spawnedAgents: 0,
    spendCollected: false,
    memory: {
      sentiment: 60,
      frictionScore: 0,
      outcome: 'pending',
      impressions: [],
      pressureReasons: [],
      updatedDay: 1,
      updatedHour: 10,
    },
  };
}

describe('cohort GOAP utility (T02)', () => {
  it('ships the authored archetype set from data files, not TS literals', () => {
    expect(Object.keys(VISITOR_ARCHETYPES).sort()).toEqual(
      Object.keys(AUTHORED_VISITOR_ARCHETYPES).sort(),
    );
    expect(Object.keys(VISITOR_ARCHETYPES).length).toBeGreaterThanOrEqual(10);
    for (const id of Object.keys(VISITOR_ARCHETYPES) as Array<keyof typeof VISITOR_ARCHETYPES>) {
      expect(VISITOR_ARCHETYPES[id]).toBe(AUTHORED_VISITOR_ARCHETYPES[id]);
    }
  });

  it('picks different top priorities for the same archetype in different tower contexts', () => {
    const cohort = cohortOf('movie-star');
    const baseEconomy = createInitialEconomy();

    const cleanQuietTower = {
      ...baseEconomy,
      cleanliness: 95,
      servicePressure: 12,
      transitPressure: 10,
    };
    const dirtyCrowdedTower = {
      ...baseEconomy,
      cleanliness: 18,
      servicePressure: 82,
      transitPressure: 88,
    };

    const calm = planVisitorHosting(cohort, cleanQuietTower, {
      noiseControl: 92,
      privacyComfort: 92,
    });
    const pressured = planVisitorHosting(cohort, dirtyCrowdedTower, {
      noiseControl: 25,
      privacyComfort: 25,
    });

    expect(calm.primary.id).not.toEqual(pressured.primary.id);
  });

  it('picks different top priorities for two different archetypes in the same tower context', () => {
    const economy = { ...createInitialEconomy(), cleanliness: 55, servicePressure: 55 };
    const context = { noiseControl: 55, privacyComfort: 55 };

    const prince = planVisitorHosting(cohortOf('foreign-prince'), economy, context);
    const monks = planVisitorHosting(cohortOf('buddhist-monks'), economy, context);
    const labor = planVisitorHosting(cohortOf('labor-delegation'), economy, context);

    const primaries = new Set([prince.primary.id, monks.primary.id, labor.primary.id]);
    expect(primaries.size).toBeGreaterThan(1);
  });
});
