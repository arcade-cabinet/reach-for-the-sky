import type { Agent } from '../types';
import type { VisitCohort } from '../visitors';

export interface FlockTuning {
  cohesion: number;
  separation: number;
  alignmentToQueue: number;
  minGroup: number;
  personalSpace: number;
  cohesionClamp: number;
}

const DEFAULT_TUNING: FlockTuning = {
  cohesion: 0.06,
  separation: 0.12,
  alignmentToQueue: 0.04,
  minGroup: 3,
  personalSpace: 1.1,
  cohesionClamp: 0.6,
};

interface GroupKey {
  cohortId: string;
  floor: number;
}

function keyOf(agent: Agent): GroupKey | null {
  if (!agent.cohortId || agent.state !== 'walking') return null;
  return { cohortId: agent.cohortId, floor: Math.round(agent.floor) };
}

function groupAgents(agents: Agent[]): Map<string, Agent[]> {
  const groups = new Map<string, Agent[]>();
  for (const agent of agents) {
    const key = keyOf(agent);
    if (!key) continue;
    const id = `${key.cohortId}#${key.floor}`;
    const bucket = groups.get(id) ?? [];
    bucket.push(agent);
    groups.set(id, bucket);
  }
  return groups;
}

function cohortGroupCohesion(cohort: VisitCohort | undefined): number {
  return cohort?.traits.groupCohesion ?? 0.6;
}

function cohortNoiseBias(cohort: VisitCohort | undefined): number {
  // Low noise tolerance → tighter personal space (the cohort self-orders).
  return cohort ? 1 - cohort.traits.noiseTolerance : 0;
}

export function applyFlockBehavior(
  agents: Agent[],
  cohorts: readonly VisitCohort[],
  tuning: FlockTuning = DEFAULT_TUNING,
): Agent[] {
  if (agents.length === 0) return agents;
  const groups = groupAgents(agents);
  if (groups.size === 0) return agents;

  const cohortLookup = new Map(cohorts.map((cohort) => [cohort.id, cohort]));
  const displacement = new Map<string, number>();

  for (const bucket of groups.values()) {
    if (bucket.length < tuning.minGroup) continue;
    const cohort = cohortLookup.get(bucket[0].cohortId ?? '');
    const cohesionWeight = tuning.cohesion * cohortGroupCohesion(cohort);
    const separationWeight = tuning.separation * (1 + cohortNoiseBias(cohort) * 0.75);
    const personalSpace = tuning.personalSpace * (1 + cohortNoiseBias(cohort) * 0.5);

    let centroid = 0;
    for (const agent of bucket) centroid += agent.x;
    centroid /= bucket.length;

    for (const agent of bucket) {
      let dx = 0;

      // Cohesion: pull toward centroid, clamped so it never overrides routing.
      const toCentroid = centroid - agent.x;
      dx +=
        Math.max(-tuning.cohesionClamp, Math.min(tuning.cohesionClamp, toCentroid)) *
        cohesionWeight;

      // Separation: push off nearby same-cohort members on the same floor.
      for (const other of bucket) {
        if (other.id === agent.id) continue;
        const gap = agent.x - other.x;
        const distance = Math.abs(gap);
        if (distance > 0 && distance < personalSpace) {
          const push = (personalSpace - distance) / personalSpace;
          dx += Math.sign(gap) * push * separationWeight;
        }
      }

      displacement.set(agent.id, dx);
    }
  }

  if (displacement.size === 0) return agents;
  return agents.map((agent) => {
    const dx = displacement.get(agent.id);
    if (dx === undefined || dx === 0) return agent;
    return { ...agent, x: agent.x + dx };
  });
}

export const __flockTuningForTests = DEFAULT_TUNING;
