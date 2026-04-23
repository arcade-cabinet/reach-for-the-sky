import { beforeEach, describe, expect, it } from 'vitest';
import { planAgentRoute } from '@/simulation/ai/navigation';
import { createInitialEconomy, createInitialTower } from '@/simulation/initialState';
import { placeBuild } from '@/simulation/placement';
import { resetIdsForTests } from '@/simulation/random';
import type { BuildingId, EconomyState, TowerState } from '@/simulation/types';

beforeEach(() => resetIdsForTests());

function applyBuilds(
  builds: readonly [BuildingId, { gx: number; gy: number }, { gx: number; gy: number }][],
): {
  tower: TowerState;
  economy: EconomyState;
} {
  let tower = createInitialTower();
  let economy = createInitialEconomy();
  for (const [tool, start, end] of builds) {
    const result = placeBuild(tower, economy, tool, { start, end }, 0);
    if (!result.ok) throw new Error(result.message);
    tower = result.tower;
    economy = result.economy;
  }
  return { tower, economy };
}

describe('Yuka tower navigation', () => {
  it('finds a route through an elevator core to upper-floor rooms', () => {
    const { tower } = applyBuilds([
      ['lobby', { gx: 0, gy: 0 }, { gx: 2, gy: 0 }],
      ['floor', { gx: 0, gy: 1 }, { gx: 2, gy: 1 }],
      ['elevator', { gx: 0, gy: 0 }, { gx: 0, gy: 1 }],
      ['office', { gx: 1, gy: 1 }, { gx: 2, gy: 1 }],
    ] as const);

    const route = planAgentRoute(tower, { x: 0, floor: 0 }, { x: 1, floor: 1 });

    expect(route.reachable).toBe(true);
    expect(route.nodeCount).toBeGreaterThan(0);
    expect(route.edgeCount).toBeGreaterThan(0);
    expect(route.waypoints.some((waypoint) => waypoint.kind === 'shaft')).toBe(true);
    expect(route.waypoints.at(-1)).toMatchObject({ x: 1, floor: 1 });
  });

  it('routes back down through elevator cores toward the lobby', () => {
    const { tower } = applyBuilds([
      ['lobby', { gx: 0, gy: 0 }, { gx: 2, gy: 0 }],
      ['floor', { gx: 0, gy: 1 }, { gx: 2, gy: 1 }],
      ['elevator', { gx: 0, gy: 0 }, { gx: 0, gy: 1 }],
      ['office', { gx: 1, gy: 1 }, { gx: 2, gy: 1 }],
    ] as const);

    const route = planAgentRoute(tower, { x: 1, floor: 1 }, { x: 0, floor: 0 });

    expect(route.reachable).toBe(true);
    expect(route.waypoints.some((waypoint) => waypoint.kind === 'shaft')).toBe(true);
    expect(route.waypoints.at(-1)).toMatchObject({ x: 0, floor: 0 });
  });

  it('rejects upper-floor routes when no vertical transit exists', () => {
    const { tower } = applyBuilds([
      ['lobby', { gx: 0, gy: 0 }, { gx: 2, gy: 0 }],
      ['floor', { gx: 0, gy: 1 }, { gx: 2, gy: 1 }],
      ['office', { gx: 1, gy: 1 }, { gx: 2, gy: 1 }],
    ] as const);

    const route = planAgentRoute(tower, { x: 0, floor: 0 }, { x: 1, floor: 1 });

    expect(route.reachable).toBe(false);
    expect(route.waypoints).toHaveLength(0);
  });
});
