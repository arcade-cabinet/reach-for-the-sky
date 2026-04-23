import { beforeEach, describe, expect, it } from 'vitest';
import { RECOVERY_ARCS } from '@/content/recovery';
import { createInitialEconomy, createInitialTower } from '@/simulation/initialState';
import { placeBuild } from '@/simulation/placement';
import { resetIdsForTests } from '@/simulation/random';
import { stepSimulation } from '@/simulation/tick';
import type { ClockState, EconomyState, TowerState } from '@/simulation/types';

beforeEach(() => resetIdsForTests());

function buildLateGameTower(): {
  tower: TowerState;
  economy: EconomyState;
  clock: ClockState;
} {
  let tower = createInitialTower();
  let economy = { ...createInitialEconomy(), funds: 500_000 };
  for (const [tool, start, end] of [
    ['lobby', { gx: 0, gy: 0 }, { gx: 8, gy: 0 }],
    ['floor', { gx: 0, gy: 1 }, { gx: 8, gy: 1 }],
    ['cafe', { gx: 0, gy: 1 }, { gx: 2, gy: 1 }],
    ['hotel', { gx: 3, gy: 1 }, { gx: 4, gy: 1 }],
    ['retail', { gx: 5, gy: 1 }, { gx: 6, gy: 1 }],
  ] as const) {
    const result = placeBuild(tower, economy, tool, { start, end }, 0);
    if (!result.ok) throw new Error(result.message);
    tower = result.tower;
    economy = result.economy;
  }
  const clock: ClockState = {
    speed: 1,
    tick: 0,
    day: 1,
    rngSeed: 0x5eed_4104,
  };
  return { tower, economy, clock };
}

describe('late-game sandbox soak + recovery arcs (T07)', () => {
  it('authored recovery-arc table covers ≥3 institutions, each with ≥2 phases', () => {
    const institutions = Object.keys(RECOVERY_ARCS);
    expect(institutions.length).toBeGreaterThanOrEqual(3);
    for (const arc of Object.values(RECOVERY_ARCS)) {
      expect(arc.arc.length, `${arc.institution} needs ≥2 authored phases`).toBeGreaterThanOrEqual(
        2,
      );
      expect(arc.arc[0].phase).toBe('soft-failure');
      const phases = arc.arc.map((step) => step.phase);
      expect(phases).toContain('recovery-contract');
      for (const step of arc.arc) {
        expect(step.headline.length).toBeGreaterThan(0);
        expect(step.successCondition.length).toBeGreaterThan(0);
      }
    }
  });

  it('10k-tick seed-locked sandbox soak: no NaN, no stall, no negative counters', () => {
    const { tower, economy, clock } = buildLateGameTower();
    let state = { tower, economy, clock };
    let lastTick = -1;
    let lastDay = -1;
    const TOTAL_TICKS = 10_000;

    for (let i = 0; i < TOTAL_TICKS; i++) {
      const result = stepSimulation(state.tower, state.economy, state.clock);
      state = { tower: result.tower, economy: result.economy, clock: result.clock };

      // Time must monotonically advance.
      const progressed =
        state.clock.day > lastDay || (state.clock.day === lastDay && state.clock.tick > lastTick);
      expect(
        progressed,
        `tick ${i}: simulation stalled at day=${state.clock.day} tick=${state.clock.tick}`,
      ).toBe(true);
      lastTick = state.clock.tick;
      lastDay = state.clock.day;

      // No NaN / infinity / negative floor-level counters.
      expect(Number.isFinite(state.economy.funds), `funds NaN at tick ${i}`).toBe(true);
      expect(Number.isFinite(state.economy.cleanliness), `cleanliness NaN at tick ${i}`).toBe(true);
      expect(state.economy.cleanliness, `cleanliness negative at tick ${i}`).toBeGreaterThanOrEqual(
        0,
      );
      expect(state.economy.servicePressure).toBeGreaterThanOrEqual(0);
      expect(state.economy.transitPressure).toBeGreaterThanOrEqual(0);
      expect(state.economy.tenantSatisfaction).toBeGreaterThanOrEqual(0);
      expect(state.tower.agents.length).toBeGreaterThanOrEqual(0);
    }

    // Should have advanced a meaningful number of in-game days across 10k ticks.
    expect(state.clock.day, 'soak should cross multiple days').toBeGreaterThan(3);
  }, 60_000);

  it('two deterministic runs from the same seed produce identical day/tick progression', () => {
    const runOnce = () => {
      resetIdsForTests();
      const { tower, economy, clock } = buildLateGameTower();
      let state = { tower, economy, clock };
      for (let i = 0; i < 500; i++) {
        const result = stepSimulation(state.tower, state.economy, state.clock);
        state = { tower: result.tower, economy: result.economy, clock: result.clock };
      }
      return { day: state.clock.day, tick: state.clock.tick };
    };
    expect(runOnce()).toEqual(runOnce());
  });
});
