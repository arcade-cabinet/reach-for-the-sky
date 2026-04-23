import { describe, expect, it } from 'vitest';
import {
  createNormalTowerBaseSignature,
  NormalTowerBaseTracker,
} from '@/rendering/renderSignatures';
import {
  createInitialClock,
  createInitialEconomy,
  createInitialTower,
} from '@/simulation/initialState';
import { placeBuild } from '@/simulation/placement';
import { type ClockState, DAY_TICKS, type TowerState } from '@/simulation/types';

function buildFixture(): TowerState {
  let tower = createInitialTower(88);
  let economy = createInitialEconomy();
  for (const [tool, start, end] of [
    ['lobby', { gx: 0, gy: 0 }, { gx: 3, gy: 0 }],
    ['floor', { gx: 0, gy: 1 }, { gx: 3, gy: 1 }],
    ['office', { gx: 0, gy: 1 }, { gx: 1, gy: 1 }],
    ['elevator', { gx: 2, gy: 0 }, { gx: 2, gy: 1 }],
  ] as const) {
    const result = placeBuild(tower, economy, tool, { start, end }, 0);
    tower = result.tower;
    economy = result.economy;
  }
  return tower;
}

describe('render signatures', () => {
  it('ignores dirt because dirt is drawn as a dynamic overlay', () => {
    const tower = buildFixture();
    const clock = createInitialClock();
    const before = createNormalTowerBaseSignature(tower, clock);
    const dirtyTower = {
      ...tower,
      rooms: tower.rooms.map((room) => (room.type === 'office' ? { ...room, dirt: 90 } : room)),
    };

    expect(createNormalTowerBaseSignature(dirtyTower, clock)).toBe(before);
  });

  it('changes when structure changes', () => {
    const tower = buildFixture();
    const clock = createInitialClock();
    const before = createNormalTowerBaseSignature(tower, clock);
    const expanded = {
      ...tower,
      rooms: [
        ...tower.rooms,
        {
          id: 'floor-extra',
          type: 'floor' as const,
          x: 4,
          y: 1,
          width: 1,
          height: 1,
          dirt: 0,
          seed: 0.2,
        },
      ],
    };

    expect(createNormalTowerBaseSignature(expanded, clock)).not.toBe(before);
  });

  it('changes on lighting hour boundaries and occupied room changes', () => {
    const tower = buildFixture();
    const office = tower.rooms.find((room) => room.type === 'office');
    if (!office) throw new Error('expected fixture office');
    const morning: ClockState = { ...createInitialClock(), tick: Math.floor((DAY_TICKS * 8) / 24) };
    const night: ClockState = { ...createInitialClock(), tick: Math.floor((DAY_TICKS * 22) / 24) };
    const morningSignature = createNormalTowerBaseSignature(tower, morning);
    const occupiedTower = {
      ...tower,
      agents: [
        {
          id: 'agent-working',
          type: 'worker' as const,
          x: office.x,
          y: office.y,
          floor: office.y,
          targetX: office.x,
          targetFloor: office.y,
          targetId: office.id,
          state: 'working' as const,
          color: '#CFD6D8',
          seed: 0.4,
          personality: 'punctual' as const,
          intent: 'work' as const,
        },
      ],
    };

    expect(createNormalTowerBaseSignature(tower, night)).not.toBe(morningSignature);
    expect(createNormalTowerBaseSignature(occupiedTower, morning)).not.toBe(morningSignature);
  });

  it('tracks normal-mode base hits and resets after lens modes', () => {
    const tower = buildFixture();
    const clock = createInitialClock();
    const tracker = new NormalTowerBaseTracker();

    expect(tracker.evaluate(tower, clock, 'normal')).toMatchObject({ decision: 'rebuild' });
    expect(tracker.evaluate(tower, clock, 'normal')).toMatchObject({ decision: 'hit' });

    const dirtyTower = {
      ...tower,
      rooms: tower.rooms.map((room) => ({ ...room, dirt: room.dirt + 25 })),
    };
    expect(tracker.evaluate(dirtyTower, clock, 'normal')).toMatchObject({ decision: 'hit' });

    expect(tracker.evaluate(dirtyTower, clock, 'maintenance')).toMatchObject({
      decision: 'disabled',
      signature: null,
    });
    expect(tracker.evaluate(dirtyTower, clock, 'normal')).toMatchObject({ decision: 'rebuild' });
  });
});
