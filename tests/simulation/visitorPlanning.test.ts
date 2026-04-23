import { describe, expect, it } from 'vitest';
import { createInitialEconomy } from '@/simulation/initialState';
import { planVisitorHosting } from '@/simulation/visitorPlanning';
import {
  createInitialVisitMemory,
  VISITOR_ARCHETYPES,
  type VisitCohort,
} from '@/simulation/visitors';

function cohortFor(archetypeId: keyof typeof VISITOR_ARCHETYPES): VisitCohort {
  const archetype = VISITOR_ARCHETYPES[archetypeId];
  return {
    id: `cohort-${archetype.id}`,
    archetypeId: archetype.id,
    label: archetype.label,
    size: archetype.minSize,
    traits: archetype.traits,
    goals: [...archetype.goals],
    volatility: archetype.volatility,
    status: 'inquiry',
    createdDay: 1,
    createdHour: 9,
    arrivalHour: 10,
    dwellHours: 2,
    targetRoomId: null,
    representativeCount: 1,
    spawnedAgents: 0,
    spendCollected: false,
    memory: createInitialVisitMemory(),
  };
}

describe('visitor hosting planning', () => {
  it('uses Yuka evaluators to prioritize privacy for status-sensitive visits', () => {
    const plan = planVisitorHosting(
      cohortFor('foreign-prince'),
      { ...createInitialEconomy(), cleanliness: 95, transitPressure: 85, servicePressure: 10 },
      { privacyComfort: 10, safetyReadiness: 25, noiseControl: 80, weatherRisk: 10 },
    );

    expect(plan.primary).toMatchObject({
      id: 'protect-privacy',
      lensMode: 'privacy',
      toolId: 'security',
      urgency: 'critical',
    });
    expect(plan.priorities.map((priority) => priority.id)).toEqual(
      expect.arrayContaining(['expand-transit', 'prove-safety']),
    );
  });

  it('prioritizes noise buffers for quiet cohesive cohorts', () => {
    const plan = planVisitorHosting(
      cohortFor('stamp-collectors'),
      { ...createInitialEconomy(), cleanliness: 94, transitPressure: 30, servicePressure: 5 },
      { privacyComfort: 80, safetyReadiness: 82, noiseControl: 10, weatherRisk: 0 },
    );

    expect(plan.primary).toMatchObject({
      id: 'buffer-noise',
      lensMode: 'privacy',
      toolId: 'skyGarden',
      urgency: 'critical',
    });
    expect(plan.summary).toContain('quiet-order');
  });

  it('keeps calm groups on the current pattern when live blockers are low', () => {
    const plan = planVisitorHosting(
      cohortFor('school-teachers'),
      { ...createInitialEconomy(), cleanliness: 100, transitPressure: 5, servicePressure: 0 },
      { privacyComfort: 96, safetyReadiness: 96, noiseControl: 96, weatherRisk: 0 },
    );

    expect(plan.primary).toMatchObject({
      id: 'preserve-current-plan',
      lensMode: 'sentiment',
      urgency: 'low',
    });
    expect(plan.priorities).toHaveLength(1);
  });
});
