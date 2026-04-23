import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..');

const PLAYER_FACING_SOURCES = [
  'app/App.tsx',
  'app/components/StartScreen.tsx',
  'app/components/GameCanvas.tsx',
  'app/styles/global.css',
];

const LADDER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /Act \d/, label: 'literal "Act N" ladder label' },
  { pattern: /\bstars\b/i, label: 'star-ladder token (kept internal only)' },
  { pattern: /actFocus/, label: 'actFocus player-facing surface' },
];

describe('campaign progression framing (T01 guard)', () => {
  for (const file of PLAYER_FACING_SOURCES) {
    it(`${file} must not surface a SimTower-style act/star ladder`, () => {
      const source = readFileSync(join(REPO_ROOT, file), 'utf8');
      for (const { pattern, label } of LADDER_PATTERNS) {
        expect(
          pattern.test(source),
          `${file} contains ${label} — progression must be emergent, not laddered. See docs/DESIGN.md Progression Philosophy.`,
        ).toBe(false);
      }
    });
  }
});
