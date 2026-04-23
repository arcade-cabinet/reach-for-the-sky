import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..');

const PLAYER_FACING_SOURCES = [
  'app/App.tsx',
  'app/components/StartScreen.tsx',
  'app/components/GameCanvas.tsx',
  'app/styles/global.css',
  'src/simulation/campaign.ts',
  'src/simulation/publicStory.ts',
  'src/simulation/scenario.ts',
];

const LADDER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /Act \d/, label: 'literal "Act N" ladder label' },
  {
    pattern: /Act\s*\$\{[^}]+\}/,
    label: 'template-literal Act-interpolation ladder label emitted at runtime',
  },
  { pattern: /\d\s+Acts\b/, label: '"N Acts" ladder summary' },
  { pattern: /class="stars"|class='stars'|\.stars\b/, label: 'star-ladder CSS/class token' },
  { pattern: /\bactFocus\b/, label: 'actFocus player-facing surface' },
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
