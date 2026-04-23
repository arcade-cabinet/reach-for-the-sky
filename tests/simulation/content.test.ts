import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAMPAIGN_ACT_REGISTRY,
  isScenarioId,
  PRODUCTION_BUDGETS,
  PRODUCTION_RELEASE,
  ROOM_UNLOCK_REGISTRY,
  SCENARIO_CARDS,
} from '@/simulation/content';
import { BUILDINGS, type BuildingId } from '@/simulation/types';

// Read package.json dynamically so release-please's version bump stays the
// source of truth. Pinning the expected version to a string here would make
// every release PR red until a maintainer edited this test by hand.
const packageJson = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8'),
) as { version: string };

describe('production content registry', () => {
  it('declares the production release and pacing budgets', () => {
    expect(PRODUCTION_RELEASE).toMatchObject({
      version: packageJson.version,
      releaseChannel: 'production',
      saveSchemaVersion: 1,
    });
    expect(PRODUCTION_RELEASE.targets).toEqual(['web', 'android']);
    expect(PRODUCTION_BUDGETS.campaignHours).toEqual([3, 6]);
    expect(PRODUCTION_BUDGETS.maxSavedEvents).toBeGreaterThanOrEqual(2_000);
  });

  it('keeps the five-act journey explicit and ordered', () => {
    expect(CAMPAIGN_ACT_REGISTRY.map((act) => act.act)).toEqual([1, 2, 3, 4, 5]);
    expect(CAMPAIGN_ACT_REGISTRY.at(0)?.title).toBe('Empty Lot');
    expect(CAMPAIGN_ACT_REGISTRY.at(-1)?.title).toBe('Reach For The Sky');
  });

  it('drives all menu shortcuts from committed preview content', () => {
    expect(SCENARIO_CARDS.map((scenario) => scenario.id)).toEqual([
      'opening',
      'skyline',
      'weather',
      'recovery',
    ]);
    expect(
      SCENARIO_CARDS.every((scenario) => scenario.preview.startsWith('assets/previews/')),
    ).toBe(true);
    expect(isScenarioId('skyline')).toBe(true);
    expect(isScenarioId('unknown')).toBe(false);
  });

  it('covers every production building with an unlock role', () => {
    const unlockedRooms = new Set(ROOM_UNLOCK_REGISTRY.map((entry) => entry.room));
    for (const room of Object.keys(BUILDINGS) as BuildingId[]) {
      if (room === 'stairs') continue;
      expect(unlockedRooms.has(room)).toBe(true);
    }
  });
});
