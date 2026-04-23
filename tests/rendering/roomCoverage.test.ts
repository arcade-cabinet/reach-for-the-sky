import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { VECTOR_SOURCES } from '@/rendering/vectorAssets';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..', '..');
const PUBLIC_DIR = join(REPO_ROOT, 'public');

// Every BuildingId that represents an authorable room family must have a
// registered SVG composite. Infra ids (lobby/floor) and transit (elevator,
// stairs) are excluded — they render via other passes or have no room body.
const REQUIRED_ROOM_FAMILIES: string[] = [
  'lobby',
  'floor',
  'office',
  'condo',
  'cafe',
  'hotel',
  'maint',
  'utilities',
  'restroom',
  'security',
  'mechanical',
  'eventHall',
  'retail',
  'skyGarden',
  'observation',
  'conference',
  'clinic',
  'gallery',
  'luxurySuite',
  'weatherCore',
];

// Map from simulation BuildingId (camelCase) to the registered RoomVectorKey
// (kebab-case). Keys are the canonical composite covering that family.
const FAMILY_TO_COMPOSITE: Record<string, string[]> = {
  lobby: ['lobby'],
  floor: ['floor'],
  office: ['office-lit', 'office-dim'],
  condo: ['condo-day', 'condo-night'],
  cafe: ['cafe'],
  hotel: ['hotel-day', 'hotel-night'],
  maint: ['maintenance'],
  utilities: ['utilities'],
  restroom: ['restroom'],
  security: ['security'],
  mechanical: ['utilities'],
  eventHall: ['event-hall'],
  retail: ['retail'],
  skyGarden: ['sky-garden'],
  observation: ['observation'],
  conference: ['conference'],
  clinic: ['clinic'],
  gallery: ['gallery'],
  luxurySuite: ['luxury-suite'],
  weatherCore: ['weather-core'],
};

describe('room-family SVG coverage (T08)', () => {
  it('every room-family BuildingId maps to at least one registered composite', () => {
    for (const family of REQUIRED_ROOM_FAMILIES) {
      const composites = FAMILY_TO_COMPOSITE[family];
      expect(composites, `family ${family} has no composite mapping`).toBeDefined();
      expect(composites.length, `family ${family} has empty composite mapping`).toBeGreaterThan(0);
      for (const composite of composites) {
        expect(
          (VECTOR_SOURCES as Record<string, string>)[composite],
          `composite ${composite} for family ${family} not in VECTOR_SOURCES`,
        ).toBeDefined();
      }
    }
  });

  it('every registered room composite resolves to an actual SVG file on disk', () => {
    const composites = Array.from(new Set(Object.values(FAMILY_TO_COMPOSITE).flat()));
    for (const composite of composites) {
      const source = (VECTOR_SOURCES as Record<string, string>)[composite];
      const path = join(PUBLIC_DIR, source);
      expect(existsSync(path), `${composite} SVG file missing at ${source}`).toBe(true);
      const contents = readFileSync(path, 'utf8');
      expect(contents).toContain('<svg');
      expect(
        contents.length,
        `${composite} SVG suspiciously small — likely placeholder`,
      ).toBeGreaterThan(200);
    }
  });

  it('new T08 composites include layered authoring, not a single rect', () => {
    const newlyAuthored = [
      'utilities',
      'restroom',
      'security',
      'conference',
      'event-hall',
      'retail',
      'sky-garden',
      'observation',
      'clinic',
      'gallery',
      'luxury-suite',
      'weather-core',
    ];
    for (const composite of newlyAuthored) {
      const source = (VECTOR_SOURCES as Record<string, string>)[composite];
      const contents = readFileSync(join(PUBLIC_DIR, source), 'utf8');
      // Require multiple authored layers — at least 3 path/rect/circle/ellipse
      // elements beyond the viewBox placeholder. Prevents placeholder slop
      // passing the file-exists check alone.
      const paintedElements = contents.match(/<(path|rect|circle|ellipse)\b/g) ?? [];
      expect(
        paintedElements.length,
        `${composite} has only ${paintedElements.length} painted elements`,
      ).toBeGreaterThanOrEqual(4);
    }
  });
});
