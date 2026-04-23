import { describe, expect, it } from 'vitest';
import { createDiagnosticsBundle, diagnosticsFilename } from '@/diagnostics/diagnosticsBundle';
import {
  createInitialCampaign,
  createInitialClock,
  createInitialEconomy,
  createInitialMacro,
  createInitialOperations,
  createInitialTower,
  createInitialView,
} from '@/simulation/initialState';
import type { SimulationSnapshot } from '@/simulation/types';

function snapshotFixture(): SimulationSnapshot {
  return {
    version: 1,
    savedAt: '2026-04-22T00:00:00.000Z',
    tower: createInitialTower(),
    economy: createInitialEconomy(),
    clock: createInitialClock(),
    view: createInitialView(),
    campaign: createInitialCampaign(),
    macro: createInitialMacro(),
    operations: createInitialOperations(),
  };
}

describe('diagnostics bundle', () => {
  it('packages local release, runtime, renderer, and save context', () => {
    const snapshot = snapshotFixture();
    snapshot.clock.day = 9;
    snapshot.campaign.act = 3;
    snapshot.economy.funds = 123_456;

    const bundle = createDiagnosticsBundle({
      snapshot,
      saveSlots: [],
      corruptSaves: [
        {
          slotId: 'campaign-a',
          error: 'Unsupported save version: 99',
          savedAt: '2026-04-22T00:00:00.000Z',
          detectedAt: '2026-04-23T00:00:00.000Z',
        },
      ],
      recentEvents: [],
      rendererStats: {
        frames: 12,
        normalBaseRebuilds: 1,
        normalBaseHits: 11,
        lensBaseDraws: 0,
        dynamicOverlayFrames: 12,
      },
      preferencesReady: true,
      url: 'https://example.test/reach-for-the-sky/',
      userAgent: 'vitest',
    });

    expect(bundle.release.version).toBe('1.0.0');
    expect(bundle.summary).toMatchObject({ day: 9, act: 3, funds: 123_456 });
    expect(bundle.corruptSaves[0]?.slotId).toBe('campaign-a');
    expect(bundle.rendererStats?.normalBaseHits).toBe(11);
    expect(bundle.runtime).toMatchObject({ preferencesReady: true, userAgent: 'vitest' });
    expect(diagnosticsFilename(bundle)).toContain('reach-for-the-sky-diagnostics-1.0.0-');
  });
});
