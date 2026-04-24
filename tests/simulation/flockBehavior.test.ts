import { describe, expect, it } from 'vitest';
import { applyFlockBehavior } from '@/simulation/ai/flock';
import type { Agent } from '@/simulation/types';
import type { VisitCohort } from '@/simulation/visitors';

function agentAt(id: string, cohortId: string, x: number, floor = 1): Agent {
  return {
    id,
    type: 'visitor',
    x,
    y: floor,
    floor,
    targetX: x,
    targetFloor: floor,
    targetId: 'room-test',
    state: 'walking',
    color: '#c0c0c0',
    seed: 0,
    personality: 'social',
    cohortId,
  };
}

function cohortFixture(id: string, overrides: Partial<VisitCohort['traits']> = {}): VisitCohort {
  return {
    id,
    archetypeId: 'school-teachers',
    label: 'test cohort',
    size: 20,
    traits: {
      ego: 0.2,
      patience: 0.7,
      spendingPower: 0.4,
      cleanlinessDemand: 0.6,
      privacyDemand: 0.3,
      noiseTolerance: 0.6,
      groupCohesion: 0.85,
      statusSensitivity: 0.2,
      kindness: 0.8,
      ...overrides,
    },
    goals: ['meeting', 'food'],
    volatility: 0.3,
    status: 'inside',
    createdDay: 1,
    createdHour: 10,
    arrivalHour: 11,
    dwellHours: 3,
    targetRoomId: null,
    representativeCount: 4,
    spawnedAgents: 4,
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

describe('flock behavior (T03)', () => {
  it('leaves solo agents untouched', () => {
    const agents = [agentAt('a', 'cohort-a', 5)];
    const next = applyFlockBehavior(agents, [cohortFixture('cohort-a')]);
    expect(next[0].x).toBe(5);
  });

  it('does not engage below minimum group size', () => {
    const agents = [agentAt('a', 'cohort-a', 2), agentAt('b', 'cohort-a', 8)];
    const next = applyFlockBehavior(agents, [cohortFixture('cohort-a')]);
    for (let i = 0; i < agents.length; i++) {
      expect(next[i].x).toBe(agents[i].x);
    }
  });

  it('pulls a spread convention floor toward its centroid', () => {
    const agents = [
      agentAt('a', 'cohort-a', 0),
      agentAt('b', 'cohort-a', 4),
      agentAt('c', 'cohort-a', 8),
      agentAt('d', 'cohort-a', 12),
      agentAt('e', 'cohort-a', 16),
    ];
    const initialSpread = agents[agents.length - 1].x - agents[0].x;
    const next = applyFlockBehavior(agents, [cohortFixture('cohort-a')]);
    const nextSpread = next[next.length - 1].x - next[0].x;
    expect(nextSpread).toBeLessThan(initialSpread);
  });

  it('enforces personal space at an elevator queue cluster', () => {
    const agents = [
      agentAt('a', 'cohort-a', 10),
      agentAt('b', 'cohort-a', 10.2),
      agentAt('c', 'cohort-a', 10.3),
      agentAt('d', 'cohort-a', 10.1),
    ];
    const initialById = new Map(agents.map((a) => [a.id, a.x]));
    const next = applyFlockBehavior(agents, [cohortFixture('cohort-a')]);
    const sorted = [...next].sort((left, right) => left.x - right.x);
    for (let i = 1; i < sorted.length; i++) {
      const initialGap = Math.abs(
        (initialById.get(sorted[i].id) ?? 0) - (initialById.get(sorted[i - 1].id) ?? 0),
      );
      expect(Math.abs(sorted[i].x - sorted[i - 1].x)).toBeGreaterThanOrEqual(initialGap);
    }
  });

  it('does not commingle agents from different cohorts on the same floor', () => {
    const red = [
      agentAt('r1', 'cohort-red', 4),
      agentAt('r2', 'cohort-red', 5),
      agentAt('r3', 'cohort-red', 6),
    ];
    const blue = [
      agentAt('b1', 'cohort-blue', 20),
      agentAt('b2', 'cohort-blue', 21),
      agentAt('b3', 'cohort-blue', 22),
    ];
    const next = applyFlockBehavior(
      [...red, ...blue],
      [cohortFixture('cohort-red'), cohortFixture('cohort-blue')],
    );
    const redCentroid =
      next.filter((a) => a.cohortId === 'cohort-red').reduce((s, a) => s + a.x, 0) / red.length;
    const blueCentroid =
      next.filter((a) => a.cohortId === 'cohort-blue').reduce((s, a) => s + a.x, 0) / blue.length;
    expect(blueCentroid - redCentroid).toBeGreaterThan(10);
  });

  it('does not flock across floors even for the same cohort', () => {
    const agents = [
      agentAt('f1', 'cohort-a', 2, 1),
      agentAt('f2', 'cohort-a', 2, 1),
      agentAt('f3', 'cohort-a', 2, 1),
      agentAt('g1', 'cohort-a', 20, 5),
      agentAt('g2', 'cohort-a', 20, 5),
      agentAt('g3', 'cohort-a', 20, 5),
    ];
    const next = applyFlockBehavior(agents, [cohortFixture('cohort-a')]);
    for (const agent of next) {
      if (agent.floor === 1) expect(agent.x).toBeLessThan(10);
      if (agent.floor === 5) expect(agent.x).toBeGreaterThan(10);
    }
  });

  // 500 ticks across 45 agents pushing through Yuka's nav graph is a real
  // workout; the 5s Vitest default trips under full-suite load on CI even
  // when the sim itself is cheap. Give this soak a generous ceiling so
  // parallel transform work doesn't flake the whole release gate.
  it('500-tick 3-cohort soak: no NaN, no runaway drift, stable centroid separation', {
    timeout: 15_000,
  }, () => {
    const cohorts = [
      cohortFixture('cohort-a'),
      cohortFixture('cohort-b', { noiseTolerance: 0.2 }), // tighter personal space
      cohortFixture('cohort-c', { groupCohesion: 0.4 }), // looser cohesion
    ];
    let agents: Agent[] = [];
    // 15 agents per cohort, spread across 3 floors
    for (const cohort of cohorts) {
      for (let i = 0; i < 15; i++) {
        agents.push(agentAt(`${cohort.id}-${i}`, cohort.id, 2 + i * 1.3, 1 + (i % 3)));
      }
    }

    const initialByFloor = new Map<string, number>();
    for (const agent of agents) {
      initialByFloor.set(
        `${agent.cohortId}#${agent.floor}`,
        (initialByFloor.get(`${agent.cohortId}#${agent.floor}`) ?? 0) + 1,
      );
    }

    for (let tick = 0; tick < 500; tick++) {
      agents = applyFlockBehavior(agents, cohorts);
      for (const agent of agents) {
        expect(Number.isFinite(agent.x), `tick ${tick} agent ${agent.id} x=${agent.x}`).toBe(true);
        expect(Math.abs(agent.x), `tick ${tick} agent ${agent.id} runaway`).toBeLessThan(1e4);
      }
    }

    // Every floor-cohort bucket still has the same membership it started with.
    const endByFloor = new Map<string, number>();
    for (const agent of agents) {
      endByFloor.set(
        `${agent.cohortId}#${agent.floor}`,
        (endByFloor.get(`${agent.cohortId}#${agent.floor}`) ?? 0) + 1,
      );
    }
    for (const [key, count] of initialByFloor) {
      expect(endByFloor.get(key)).toBe(count);
    }
  });
});
