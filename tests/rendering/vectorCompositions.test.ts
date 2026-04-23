import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createRoomComposition } from '@/rendering/roomCompositions';
import {
  type AgentVectorKey,
  type ElementVectorKey,
  type EnvironmentVectorKey,
  type UiVectorKey,
  VECTOR_SOURCES,
} from '@/rendering/vectorAssets';
import type { BuildingId, TowerRoom } from '@/simulation/types';

const ROOM_TYPES = [
  'floor',
  'lobby',
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
] as const;
const STRUCTURAL_KEYS = ['facade-rib', 'floor-slab'] satisfies ElementVectorKey[];
const AGENT_KEYS = [
  'agent-worker',
  'agent-guest',
  'agent-janitor',
  'agent-visitor',
  'agent-waiting-ring',
] satisfies AgentVectorKey[];
const UI_KEYS = [
  'ghost-valid',
  'ghost-invalid',
  'lens-maintenance',
  'lens-transit',
  'lens-value',
  'lens-sentiment',
  'lens-privacy',
  'lens-safety',
  'lens-event',
] satisfies UiVectorKey[];
const ENVIRONMENT_KEYS = [
  'cloud-bank',
  'skyline-tower',
  'air-rights-marker',
] satisfies EnvironmentVectorKey[];
const DESIGN_WIDTH = 96;
const DESIGN_HEIGHT = 32;

function makeRoom(type: (typeof ROOM_TYPES)[number], seed = 0.47): TowerRoom {
  return {
    id: `${type}-test`,
    type,
    x: 0,
    y: type === 'lobby' ? 0 : 1,
    width: type === 'cafe' ? 3 : 2,
    height: 1,
    dirt: 0,
    seed,
  };
}

describe('vector asset library', () => {
  it('registers only existing SVG assets', () => {
    for (const [key, source] of Object.entries(VECTOR_SOURCES)) {
      const assetPath = resolve(process.cwd(), 'public', source);
      expect(existsSync(assetPath), `${key} is missing ${source}`).toBe(true);
      expect(readFileSync(assetPath, 'utf8'), `${key} should be SVG`).toContain('<svg');
    }
  });

  it('includes authored SVGs for high-readability dynamic actors', () => {
    for (const key of AGENT_KEYS) {
      expect(VECTOR_SOURCES[key]).toMatch(/^assets\/vectors\/agents\//);
    }
  });

  it('uses authored SVGs for interaction affordances instead of debug rectangles', () => {
    for (const key of UI_KEYS) {
      expect(VECTOR_SOURCES[key]).toMatch(/^assets\/vectors\/ui\//);
    }
  });

  it('keeps background atmosphere in the authored vector system', () => {
    for (const key of ENVIRONMENT_KEYS) {
      expect(VECTOR_SOURCES[key]).toMatch(/^assets\/vectors\/environment\//);
    }
  });
});

describe('room vector compositions', () => {
  it('uses authored element vectors inside the room design bounds', () => {
    for (const type of ROOM_TYPES satisfies readonly BuildingId[]) {
      for (const state of [
        { lit: true, night: false },
        { lit: false, night: true },
      ]) {
        const placements = createRoomComposition(makeRoom(type), state);
        expect(placements.length, `${type} should use composed vector elements`).toBeGreaterThan(0);
        const placementKeys = new Set(placements.map((placement) => placement.key));
        for (const key of STRUCTURAL_KEYS) {
          expect(placementKeys.has(key), `${type} should preserve structural ${key}`).toBe(true);
        }

        for (const placement of placements) {
          expect(VECTOR_SOURCES[placement.key]).toMatch(/^assets\/vectors\/elements\//);
          expect(placement.x, `${type}:${placement.key} x`).toBeGreaterThanOrEqual(0);
          expect(placement.y, `${type}:${placement.key} y`).toBeGreaterThanOrEqual(0);
          expect(placement.width, `${type}:${placement.key} width`).toBeGreaterThan(0);
          expect(placement.height, `${type}:${placement.key} height`).toBeGreaterThan(0);
          expect(
            placement.x + placement.width,
            `${type}:${placement.key} width overflow`,
          ).toBeLessThanOrEqual(DESIGN_WIDTH);
          expect(
            placement.y + placement.height,
            `${type}:${placement.key} height overflow`,
          ).toBeLessThanOrEqual(DESIGN_HEIGHT);
        }
      }
    }
  });
});
