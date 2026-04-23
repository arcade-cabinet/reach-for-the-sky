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

describe('inspection model', () => {
  it('explains rooms through macro, meso, and micro-relevant signals', () => {
    let tower = createInitialTower();
    let economy = { ...createInitialEconomy(), funds: 500_000 };
    for (const [tool, start, end] of [
      ['lobby', { gx: 0, gy: 0 }, { gx: 3, gy: 0 }],
      ['floor', { gx: 0, gy: 1 }, { gx: 3, gy: 1 }],
      ['office', { gx: 0, gy: 1 }, { gx: 1, gy: 1 }],
    ] as const) {
      const result = placeBuild(tower, economy, tool, { start, end }, 0);
      tower = result.tower;
      economy = result.economy;
    }

    const target = createInspectionForCell(
      tower,
      { ...economy, transitPressure: 78 },
      { ...createInitialCampaign(), towerIdentity: 'business' },
      { ...createInitialMacro(), publicTrust: 67 },
      createInitialOperations(),
      { gx: 0, gy: 1 },
    );

    expect(target.kind).toBe('room');
    expect(target.title).toBe('Office');
    expect(target.details.join(' ')).toContain('Tower identity: business');
    expect(target.warnings).toContain(
      'Current transit pressure will shape how people remember this space.',
    );
  });

  it('explains empty bays as buildable air-rights context', () => {
    const target = createInspectionForCell(
      createInitialTower(),
      createInitialEconomy(),
      createInitialCampaign(),
      createInitialMacro(),
      createInitialOperations(),
      { gx: 4, gy: 5 },
    );

    expect(target.kind).toBe('empty');
    expect(target.title).toBe('Open Bay');
    expect(target.warnings[0]).toContain('complete floor support');
  });

  it('explains agent personality and queue sensitivity during inspection', () => {
    const tower = createInitialTower();
    tower.agents.push({
      id: 'status-visitor',
      type: 'visitor',
      x: 0,
      y: 0,
      floor: 0,
      targetX: 4,
      targetFloor: 2,
      targetId: 'venue',
      state: 'waiting',
      color: '#B9A7A0',
      seed: 0.9,
      personality: 'status',
      intent: 'visit',
      waitTicks: 96,
      routeStatus: 'planned',
    });

    const target = createInspectionForCell(
      tower,
      { ...createInitialEconomy(), transitPressure: 82 },
      createInitialCampaign(),
      createInitialMacro(),
      createInitialOperations(),
      { gx: 0, gy: 0 },
    );

    expect(target.kind).toBe('agent');
    expect(target.details.join(' ')).toContain('status-seeking');
    expect(target.warnings).toContain(
      'Status-sensitive visitors amplify visible delays into reputation risk.',
    );
  });
});
