import { describe, expect, it } from 'vitest';
import { AUTHORED_VISITOR_ARCHETYPES } from '@/content/cohorts';
import { createInitialEconomy } from '@/simulation/initialState';
import { planVisitorHosting } from '@/simulation/visitorPlanning';
import {
  VISITOR_ARCHETYPES,
  type VisitCohort,
  type VisitorArchetypeId,
} from '@/simulation/visitors';

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

const EXPECTED_ARCHETYPE_IDS: VisitorArchetypeId[] = [
  'movie-star',
  'politician',
  'foreign-prince',
  'buddhist-monks',
  'school-teachers',
  'stamp-collectors',
  'labor-delegation',
  'trade-buyers',
  'city-inspectors',
  'press-swarm',
  'film-festival-jury',
  'tech-investors',
  'civic-delegation',
];

describe('cohort GOAP utility (T02)', () => {
  it('ships the exact authored archetype set from data files', () => {
    expect(Object.keys(AUTHORED_VISITOR_ARCHETYPES).sort()).toEqual(
      [...EXPECTED_ARCHETYPE_IDS].sort(),
    );
    expect(Object.keys(VISITOR_ARCHETYPES).sort()).toEqual([...EXPECTED_ARCHETYPE_IDS].sort());
  });

  it('each authored archetype declares a non-empty goal set and a valid trait vector', () => {
    for (const id of EXPECTED_ARCHETYPE_IDS) {
      const archetype = AUTHORED_VISITOR_ARCHETYPES[id];
      expect(archetype, `missing archetype ${id}`).toBeDefined();
      expect(archetype.id).toBe(id);
      expect(archetype.goals.length).toBeGreaterThan(0);
      expect(archetype.minSize).toBeGreaterThan(0);
      expect(archetype.maxSize).toBeGreaterThanOrEqual(archetype.minSize);
      for (const [key, value] of Object.entries(archetype.traits)) {
        expect(value, `${id}.traits.${key} out of [0,1]`).toBeGreaterThanOrEqual(0);
        expect(value, `${id}.traits.${key} out of [0,1]`).toBeLessThanOrEqual(1);
      }
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
