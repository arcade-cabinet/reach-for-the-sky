import { describe, expect, it } from 'vitest';
import { applyIdentityTraitDelta, IDENTITY_CONSEQUENCES } from '@/content/identity';
import { createInitialEconomy, createInitialTower } from '@/simulation/initialState';
import { placeBuild } from '@/simulation/placement';
import { resetIdsForTests } from '@/simulation/random';
import type { TowerIdentity } from '@/simulation/types';
import { generateVisitCohort, type VisitorArchetypeId } from '@/simulation/visitors';

const ALL_IDENTITIES: TowerIdentity[] = [
  'unformed',
  'business',
  'residential',
  'hospitality',
  'civic',
  'luxury',
  'mixed-use',
];

function buildVenueTower() {
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
  return tower;
}

function archetypeHistogram(identity: TowerIdentity, samples = 300) {
  resetIdsForTests();
  const tower = buildVenueTower();
  const counts = new Map<VisitorArchetypeId, number>();
  for (let i = 0; i < samples; i++) {
    const cohort = generateVisitCohort(
      0x9e37_79b9 + i * 104_729,
      tower,
      {},
      { towerIdentity: identity, fame: 70, publicTrust: 60 },
    );
    counts.set(cohort.archetypeId, (counts.get(cohort.archetypeId) ?? 0) + 1);
  }
  return counts;
}

describe('identity consequences (T04)', () => {
  it('authored consequence table covers every TowerIdentity', () => {
    for (const identity of ALL_IDENTITIES) {
      expect(IDENTITY_CONSEQUENCES[identity], `missing ${identity}`).toBeDefined();
      expect(IDENTITY_CONSEQUENCES[identity].identity).toBe(identity);
    }
  });

  it('trait deltas keep all trait components within [0, 1]', () => {
    const traits = {
      ego: 0.5,
      patience: 0.5,
      spendingPower: 0.5,
      cleanlinessDemand: 0.5,
      privacyDemand: 0.5,
      noiseTolerance: 0.5,
      groupCohesion: 0.5,
      statusSensitivity: 0.5,
      kindness: 0.5,
    };
    for (const identity of ALL_IDENTITIES) {
      const shifted = applyIdentityTraitDelta(traits, identity);
      for (const value of Object.values(shifted)) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });

  it('luxury cohorts are meaningfully more status-sensitive than civic cohorts', () => {
    const baseline = {
      ego: 0.5,
      patience: 0.5,
      spendingPower: 0.5,
      cleanlinessDemand: 0.5,
      privacyDemand: 0.5,
      noiseTolerance: 0.5,
      groupCohesion: 0.5,
      statusSensitivity: 0.5,
      kindness: 0.5,
    };
    const luxury = applyIdentityTraitDelta(baseline, 'luxury');
    const civic = applyIdentityTraitDelta(baseline, 'civic');
    expect(luxury.statusSensitivity).toBeGreaterThan(civic.statusSensitivity);
    expect(civic.kindness).toBeGreaterThan(luxury.kindness);
  });

  it('flipping identity mid-run shifts the cohort archetype distribution within 300 samples', () => {
    const luxuryDistribution = archetypeHistogram('luxury');
    const civicDistribution = archetypeHistogram('civic');

    const luxuryMovieStar = luxuryDistribution.get('movie-star') ?? 0;
    const civicMovieStar = civicDistribution.get('movie-star') ?? 0;
    expect(luxuryMovieStar, 'luxury should attract more movie-stars').toBeGreaterThan(
      civicMovieStar + 10,
    );

    const luxuryTeachers = luxuryDistribution.get('school-teachers') ?? 0;
    const civicTeachers = civicDistribution.get('school-teachers') ?? 0;
    expect(civicTeachers, 'civic should attract more school-teachers').toBeGreaterThan(
      luxuryTeachers + 10,
    );
  });

  it('hospitality cohorts carry higher spending-power trait than business cohorts on average', () => {
    const sample = (identity: TowerIdentity) => {
      resetIdsForTests();
      const tower = buildVenueTower();
      let sum = 0;
      for (let i = 0; i < 80; i++) {
        sum += generateVisitCohort(
          0x5a5a + i * 9973,
          tower,
          {},
          { towerIdentity: identity, fame: 60, publicTrust: 60 },
        ).traits.spendingPower;
      }
      return sum / 80;
    };
    expect(sample('hospitality')).toBeGreaterThan(sample('business'));
  });
});
