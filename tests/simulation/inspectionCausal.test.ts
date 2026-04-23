import { describe, expect, it } from 'vitest';
import {
  createInitialCampaign,
  createInitialEconomy,
  createInitialMacro,
  createInitialOperations,
  createInitialTower,
} from '@/simulation/initialState';
import { createInspectionForCell } from '@/simulation/inspection';
import { placeBuild } from '@/simulation/placement';
import { resetIdsForTests } from '@/simulation/random';

function buildFixture() {
  resetIdsForTests();
  let tower = createInitialTower();
  let economy = createInitialEconomy();
  for (const [tool, start, end] of [
    ['lobby', { gx: 0, gy: 0 }, { gx: 8, gy: 0 }],
    ['floor', { gx: 0, gy: 1 }, { gx: 8, gy: 1 }],
    ['cafe', { gx: 0, gy: 1 }, { gx: 2, gy: 1 }],
    ['hotel', { gx: 3, gy: 1 }, { gx: 4, gy: 1 }],
  ] as const) {
    const result = placeBuild(tower, economy, tool, { start, end }, 0);
    if (!result.ok) throw new Error(result.message);
    tower = result.tower;
    economy = result.economy;
  }
  return {
    tower,
    economy,
    campaign: createInitialCampaign(),
    macro: createInitialMacro(),
    operations: createInitialOperations(),
  };
}

describe('inspection causal "because..." lines (T10)', () => {
  it('room inspection leads with a because-line tied to sim state', () => {
    const { tower, economy, campaign, macro, operations } = buildFixture();
    const inspection = createInspectionForCell(tower, economy, campaign, macro, operations, {
      gx: 0,
      gy: 1,
    });
    expect(inspection.kind).toBe('room');
    expect(inspection.details[0].toLowerCase()).toContain('because');
  });

  it('empty-cell inspection above street leads with a because-line', () => {
    const { tower, economy, campaign, macro, operations } = buildFixture();
    const inspection = createInspectionForCell(tower, economy, campaign, macro, operations, {
      gx: 6,
      gy: 5,
    });
    expect(inspection.kind).toBe('empty');
    expect(inspection.details[0].toLowerCase()).toContain('because');
  });

  it('street-level empty cell leads with a because-line about street interface', () => {
    const { tower, economy, campaign, macro, operations } = buildFixture();
    const inspection = createInspectionForCell(tower, economy, campaign, macro, operations, {
      gx: 20,
      gy: 0,
    });
    expect(inspection.kind).toBe('empty');
    expect(inspection.details[0].toLowerCase()).toContain('because');
  });

  it('room under heavy dirt surfaces a dirt-specific because-line', () => {
    const { tower, economy, campaign, macro, operations } = buildFixture();
    const cafeRoom = tower.rooms.find((room) => room.type === 'cafe');
    if (cafeRoom) cafeRoom.dirt = 78;
    const inspection = createInspectionForCell(tower, economy, campaign, macro, operations, {
      gx: cafeRoom?.x ?? 0,
      gy: cafeRoom?.y ?? 1,
    });
    expect(inspection.details[0].toLowerCase()).toContain('because dirt');
  });
});
