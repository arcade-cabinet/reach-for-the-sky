import { describe, expect, it } from 'vitest';
import { createContractObjectiveAction } from '@/simulation/contractActions';
import {
  createInitialEconomy,
  createInitialMacro,
  createInitialOperations,
  createInitialTower,
} from '@/simulation/initialState';
import type { ContractObjective } from '@/simulation/types';

function objective(overrides: Partial<ContractObjective>): ContractObjective {
  return {
    id: 'objective',
    label: 'Objective',
    metric: 'operations-grade',
    target: 65,
    value: 30,
    direction: 'at-least',
    complete: false,
    ...overrides,
  };
}

describe('contract objective actions', () => {
  it('maps noise-control repair work to privacy lens and a sky garden build', () => {
    const tower = createInitialTower();
    tower.rooms.push({
      id: 'loud-cafe',
      type: 'cafe',
      x: 4,
      y: 2,
      width: 3,
      height: 1,
      dirt: 12,
      seed: 4,
    });

    const action = createContractObjectiveAction(
      objective({ label: '68 noise control', metric: 'noise-control', target: 68, value: 21 }),
      tower,
      createInitialEconomy(),
      createInitialMacro(),
      { ...createInitialOperations(), noiseControl: 21, privacyComfort: 40 },
    );

    expect(action).toMatchObject({
      lensMode: 'privacy',
      headline: 'Buffer noisy public space',
      focusCell: { gx: 4, gy: 2 },
      toolId: 'skyGarden',
      toolLabel: 'Sky Garden',
    });
    expect(action.diagnostic).toContain('68 noise control');
  });

  it('maps missing room-count objectives to the required build tool', () => {
    const action = createContractObjectiveAction(
      objective({
        label: 'Quiet public buffer',
        metric: 'room-count',
        roomType: 'skyGarden',
        target: 1,
        value: 0,
      }),
      createInitialTower(),
      createInitialEconomy(),
      createInitialMacro(),
      createInitialOperations(),
    );

    expect(action).toMatchObject({
      lensMode: 'privacy',
      headline: 'Build Sky Garden',
      toolId: 'skyGarden',
      toolLabel: 'Sky Garden',
      focusCell: null,
    });
  });
});
