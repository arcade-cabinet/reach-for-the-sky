import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseSnapshot, tryParseSnapshot } from '@/persistence/saveRepository';

// T14 — save-compat smoke. A player who saved during v1.0.1 must be able to
// reopen their tower on any post-v1.0.1 build. The canonical guarantee is
// that `parseSnapshot` accepts the v1.0.1 payload shape without throwing and
// produces a fully-populated SimulationSnapshot (no undefined substates).
//
// The fixture is a hand-authored JSON snapshot whose fields match the v1.0.1
// SimulationSnapshot interface exactly — captured from the v1.0.1 tag
// (a4d598f) by inspecting the initial-state factories + TowerState/Economy/
// Campaign/Macro/Operations schemas and filling them with realistic mid-game
// values (12 game days, 3 rooms, business identity, two completed visits).

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'fixtures/v1.0.1-snapshot.json',
);
const rawFixture = readFileSync(fixturePath, 'utf8');

describe('save-compat: v1.0.1 baseline', () => {
  it('parseSnapshot accepts the v1.0.1 payload without throwing', () => {
    expect(() => parseSnapshot(rawFixture)).not.toThrow();
  });

  it('tryParseSnapshot returns ok:true', () => {
    const result = tryParseSnapshot(rawFixture);
    expect(result.ok).toBe(true);
  });

  it('restores the player-visible surface (funds, day, rooms, identity)', () => {
    const snapshot = parseSnapshot(rawFixture);
    expect(snapshot.economy.funds).toBe(48_500);
    expect(snapshot.clock.day).toBe(12);
    expect(snapshot.tower.rooms.map((room) => room.type)).toEqual(['lobby', 'office', 'hotel']);
    expect(snapshot.campaign.towerIdentity).toBe('business');
    expect(snapshot.campaign.mode).toBe('campaign');
    expect(snapshot.campaign.victory).toBe('none');
  });

  it('populates substates that post-v1.0.1 code may have extended', () => {
    const snapshot = parseSnapshot(rawFixture);
    // Every substate must be a populated object. Undefined here would mean
    // a normalizer regressed and a future code path will NPE on load.
    expect(snapshot.campaign).toBeDefined();
    expect(snapshot.macro).toBeDefined();
    expect(snapshot.operations).toBeDefined();
    expect(snapshot.tower.visits).toEqual([]);
    expect(snapshot.tower.visitMemories).toEqual([]);
    // RNG seed default applied even if old save lacked it — verify fallback.
    expect(typeof snapshot.clock.rngSeed).toBe('number');
  });

  it('rejects a snapshot with an incompatible version tag', () => {
    const bumped = JSON.stringify({ ...JSON.parse(rawFixture), version: 999 });
    expect(() => parseSnapshot(bumped)).toThrow(/Unsupported save version/);
  });
});
