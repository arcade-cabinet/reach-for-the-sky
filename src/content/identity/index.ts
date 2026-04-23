import type { TowerIdentity } from '../../simulation/types';
import type { VisitorArchetypeId, VisitorTraitVector } from '../../simulation/visitors';
import business from './business.json';
import civic from './civic.json';
import hospitality from './hospitality.json';
import luxury from './luxury.json';
import mixedUse from './mixed-use.json';
import residential from './residential.json';
import unformed from './unformed.json';

export interface IdentityConsequence {
  identity: TowerIdentity;
  archetypeBias: Partial<Record<VisitorArchetypeId, number>>;
  traitDelta: Partial<VisitorTraitVector>;
}

type RawIdentityConsequence = {
  identity: string;
  archetypeBias: Record<string, number>;
  traitDelta: Record<string, number>;
};

function narrow(data: RawIdentityConsequence, expected: TowerIdentity): IdentityConsequence {
  if (data.identity !== expected) {
    throw new Error(
      `authored identity mismatch: file declares "${data.identity}" but was registered as "${expected}"`,
    );
  }
  return data as IdentityConsequence;
}

const AUTHORED_CONSEQUENCES: readonly IdentityConsequence[] = [
  narrow(unformed, 'unformed'),
  narrow(business, 'business'),
  narrow(residential, 'residential'),
  narrow(hospitality, 'hospitality'),
  narrow(civic, 'civic'),
  narrow(luxury, 'luxury'),
  narrow(mixedUse, 'mixed-use'),
];

function buildTable(): Record<TowerIdentity, IdentityConsequence> {
  const table = {} as Record<TowerIdentity, IdentityConsequence>;
  for (const entry of AUTHORED_CONSEQUENCES) {
    if (table[entry.identity]) {
      throw new Error(`duplicate identity "${entry.identity}" in src/content/identity/*.json`);
    }
    table[entry.identity] = entry;
  }
  return table;
}

export const IDENTITY_CONSEQUENCES: Record<TowerIdentity, IdentityConsequence> = buildTable();

export function applyIdentityTraitDelta(
  traits: VisitorTraitVector,
  identity: TowerIdentity,
): VisitorTraitVector {
  const delta = IDENTITY_CONSEQUENCES[identity]?.traitDelta;
  if (!delta) return traits;
  const result = { ...traits };
  for (const [key, amount] of Object.entries(delta) as Array<[keyof VisitorTraitVector, number]>) {
    result[key] = Math.max(0, Math.min(1, result[key] + amount));
  }
  return result;
}
