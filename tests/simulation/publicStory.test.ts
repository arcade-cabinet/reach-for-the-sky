import { describe, expect, it } from 'vitest';
import {
  createInitialEconomy,
  createInitialMacro,
  createInitialOperations,
  createInitialTower,
} from '@/simulation/initialState';
import {
  createPublicStoryActionSummary,
  dominantPublicPressureReason,
} from '@/simulation/publicStory';
import type { VisitMemoryRecord } from '@/simulation/visitors';

function memory(pressureReasons: string[]): VisitMemoryRecord {
  return {
    id: 'memory-test',
    cohortId: 'cohort-test',
    archetypeId: 'press-swarm',
    label: 'Press swarm',
    size: 18,
    createdDay: 2,
    resolvedDay: 3,
    sentiment: 32,
    frictionScore: 58,
    outcome: 'complained',
    impressions: ['The public story hardened around the visible problem.'],
    pressureReasons,
    updatedDay: 3,
    updatedHour: 14,
  };
}

describe('public story action summary', () => {
  it('prioritizes the highest-stakes public pressure reason', () => {
    expect(dominantPublicPressureReason(['noise', 'queues', 'safety'])).toBe('queues');
    expect(dominantPublicPressureReason(['weather', 'privacy', 'service'])).toBe('privacy');
    expect(dominantPublicPressureReason([])).toBeNull();
  });

  it('maps queue stories to transit lens and the longest visible wait', () => {
    const tower = createInitialTower();
    tower.agents.push({
      id: 'waiter',
      type: 'visitor',
      x: 2,
      y: 0,
      floor: 4,
      targetX: 8,
      targetFloor: 7,
      targetId: 'venue',
      state: 'waiting',
      color: '#ffffff',
      seed: 0.5,
      personality: 'status',
      intent: 'visit',
      waitTicks: 144,
    });

    const action = createPublicStoryActionSummary(
      memory(['queues']),
      tower,
      { ...createInitialEconomy(), population: 54, transitPressure: 91 },
      createInitialMacro(),
      { ...createInitialOperations(), transitTopology: 18 },
    );

    expect(action).toMatchObject({
      dominantReason: 'queues',
      lensMode: 'transit',
      lensLabel: 'Transit',
      headline: 'Vertical core bottleneck',
      focusCell: { gx: 2, gy: 4 },
    });
    expect(action.metricValue).toContain('91% pressure');
    expect(action.diagnostic).toContain('144 ticks');
  });

  it('maps cleanliness stories to maintenance lens and the dirtiest room', () => {
    const tower = createInitialTower();
    tower.rooms.push({
      id: 'dirty-cafe',
      type: 'cafe',
      x: 6,
      y: 2,
      width: 3,
      height: 1,
      dirt: 87,
      seed: 12,
    });

    const action = createPublicStoryActionSummary(
      memory(['cleanliness']),
      tower,
      { ...createInitialEconomy(), cleanliness: 42 },
      createInitialMacro(),
      createInitialOperations(),
    );

    expect(action).toMatchObject({
      dominantReason: 'cleanliness',
      lensMode: 'maintenance',
      focusCell: { gx: 6, gy: 2 },
    });
    expect(action.metricValue).toContain('42% clean');
    expect(action.diagnostic).toContain('Cafe, floor 2');
  });
});
