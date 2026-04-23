import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialEconomy, createInitialTower } from '@/simulation/initialState';
import {
  calculateCommittedPopulation,
  calculateDailyRevenue,
  calculateOperationalMetrics,
  calculateTransitPressure,
  createBuildPreview,
  placeBuild,
} from '@/simulation/placement';
import { resetIdsForTests } from '@/simulation/random';
import { createOpeningContractSnapshot } from '@/simulation/scenario';

beforeEach(() => resetIdsForTests());

describe('tower placement', () => {
  it('builds lobbies on the ground and rejects floating lobbies', () => {
    const tower = createInitialTower();
    const economy = createInitialEconomy();

    expect(
      createBuildPreview(tower, economy, 'lobby', {
        start: { gx: 0, gy: 0 },
        end: { gx: 2, gy: 1 },
      }).valid,
    ).toBe(true);
    expect(
      createBuildPreview(tower, economy, 'lobby', {
        start: { gx: 0, gy: 2 },
        end: { gx: 1, gy: 2 },
      }).error,
    ).toMatch(/ground/i);
  });

  it('requires a complete floor before placing rooms', () => {
    const tower = createInitialTower();
    const economy = createInitialEconomy();

    const noFloor = createBuildPreview(tower, economy, 'office', {
      start: { gx: 0, gy: 1 },
      end: { gx: 1, gy: 1 },
    });
    expect(noFloor.valid).toBe(false);
    expect(noFloor.error).toMatch(/floor/i);

    const floorResult = placeBuild(
      tower,
      economy,
      'floor',
      { start: { gx: 0, gy: 1 }, end: { gx: 1, gy: 1 } },
      1,
    );
    const office = createBuildPreview(floorResult.tower, floorResult.economy, 'office', {
      start: { gx: 0, gy: 1 },
      end: { gx: 1, gy: 1 },
    });

    expect(office.valid).toBe(true);
    expect(office.cost).toBe(12_000);
  });

  it('requires transit shafts to pass through infrastructure', () => {
    const tower = createInitialTower();
    const economy = createInitialEconomy();
    const lobby = placeBuild(
      tower,
      economy,
      'lobby',
      { start: { gx: 0, gy: 0 }, end: { gx: 0, gy: 0 } },
      0,
    );
    const floor = placeBuild(
      lobby.tower,
      lobby.economy,
      'floor',
      { start: { gx: 0, gy: 1 }, end: { gx: 0, gy: 1 } },
      1,
    );

    const valid = placeBuild(
      floor.tower,
      floor.economy,
      'elevator',
      { start: { gx: 0, gy: 0 }, end: { gx: 0, gy: 1 } },
      3,
    );
    expect(valid.ok).toBe(true);
    expect(valid.tower.elevators).toHaveLength(1);
    expect(valid.tower.elevators[0]).toMatchObject({ min: 0, max: 1 });

    const invalid = createBuildPreview(floor.tower, floor.economy, 'elevator', {
      start: { gx: 4, gy: 0 },
      end: { gx: 4, gy: 1 },
    });
    expect(invalid.valid).toBe(false);
  });

  it('uses committed tower capacity for progression population', () => {
    let tower = createInitialTower();
    let economy = createInitialEconomy();
    for (const [tool, start, end] of [
      ['lobby', { gx: 0, gy: 0 }, { gx: 1, gy: 0 }],
      ['floor', { gx: 0, gy: 1 }, { gx: 3, gy: 1 }],
      ['office', { gx: 0, gy: 1 }, { gx: 1, gy: 1 }],
      ['condo', { gx: 2, gy: 1 }, { gx: 3, gy: 1 }],
    ] as const) {
      const result = placeBuild(tower, economy, tool, { start, end }, 0);
      tower = result.tower;
      economy = result.economy;
    }

    expect(calculateCommittedPopulation(tower.rooms)).toBe(9);
    expect(economy.population).toBe(9);
    expect(economy.activeAgents).toBe(0);
  });

  it('turns unresolved operating pressure into rent efficiency loss', () => {
    let tower = createInitialTower();
    let economy = createInitialEconomy();
    for (const [tool, start, end] of [
      ['lobby', { gx: 0, gy: 0 }, { gx: 1, gy: 0 }],
      ['floor', { gx: 0, gy: 1 }, { gx: 1, gy: 1 }],
      ['office', { gx: 0, gy: 1 }, { gx: 1, gy: 1 }],
    ] as const) {
      const result = placeBuild(tower, economy, tool, { start, end }, 0);
      tower = result.tower;
      economy = result.economy;
    }

    const metrics = calculateOperationalMetrics(tower);

    expect(metrics.transitPressure).toBe(100);
    expect(metrics.tenantSatisfaction).toBeLessThan(100);
    expect(metrics.rentEfficiency).toBeLessThan(100);
    expect(calculateDailyRevenue(tower.rooms, metrics.rentEfficiency)).toBeLessThan(
      calculateDailyRevenue(tower.rooms),
    );
    expect(economy.rentEfficiency).toBe(metrics.rentEfficiency);
  });

  it('weights blocked agents and long waits into transit pressure', () => {
    let tower = createInitialTower();
    let economy = createInitialEconomy();
    for (const [tool, start, end] of [
      ['lobby', { gx: 0, gy: 0 }, { gx: 3, gy: 0 }],
      ['floor', { gx: 0, gy: 1 }, { gx: 3, gy: 1 }],
      ['elevator', { gx: 0, gy: 0 }, { gx: 0, gy: 1 }],
      ['office', { gx: 1, gy: 1 }, { gx: 2, gy: 1 }],
    ] as const) {
      const result = placeBuild(tower, economy, tool, { start, end }, 0);
      tower = result.tower;
      economy = result.economy;
    }

    const baseAgent = {
      id: 'waiting-worker',
      type: 'worker' as const,
      x: 0,
      y: 0,
      floor: 0,
      targetX: 1,
      targetFloor: 1,
      targetId: 'office',
      state: 'waiting' as const,
      color: '#CFD6D8',
      seed: 0.2,
      personality: 'impatient' as const,
      intent: 'work' as const,
      elevatorId: tower.elevators[0]?.id,
    };
    const shortWait = calculateTransitPressure(
      { ...tower, agents: [{ ...baseAgent, waitTicks: 0 }] },
      economy.population,
    );
    const longWait = calculateTransitPressure(
      { ...tower, agents: [{ ...baseAgent, waitTicks: 120 }] },
      economy.population,
    );
    const blocked = calculateTransitPressure(
      { ...tower, agents: [{ ...baseAgent, waitTicks: 120, routeStatus: 'blocked' }] },
      economy.population,
    );

    expect(longWait).toBeGreaterThan(shortWait);
    expect(blocked).toBeGreaterThan(longWait);
  });

  it('assigns deterministic room visual seeds for repeatable captures', () => {
    const buildSeeds = () => {
      resetIdsForTests();
      let tower = createInitialTower();
      let economy = createInitialEconomy();
      for (const [tool, start, end] of [
        ['lobby', { gx: -1, gy: 0 }, { gx: 1, gy: 0 }],
        ['floor', { gx: -1, gy: 1 }, { gx: 2, gy: 1 }],
        ['office', { gx: -1, gy: 1 }, { gx: 0, gy: 1 }],
        ['condo', { gx: 1, gy: 1 }, { gx: 2, gy: 1 }],
      ] as const) {
        const result = placeBuild(tower, economy, tool, { start, end }, 0);
        tower = result.tower;
        economy = result.economy;
      }
      return tower.rooms.map((room) => [room.type, room.x, room.y, room.seed]);
    };

    expect(buildSeeds()).toEqual(buildSeeds());
  });

  it('builds the deterministic opening contract scenario', () => {
    const scenario = createOpeningContractSnapshot();

    expect(scenario.tower.rooms.some((room) => room.type === 'lobby')).toBe(true);
    expect(scenario.tower.elevators).toHaveLength(1);
    expect(scenario.economy.population).toBeGreaterThanOrEqual(25);
    expect(scenario.economy.dailyRevenue).toBeGreaterThan(0);
    expect(scenario.view.tutorialStep).toBe(4);
  });
});
