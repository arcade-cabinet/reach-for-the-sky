import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), '..');
const DIST_ASSETS = join(REPO_ROOT, 'dist', 'assets');
const DEV_MARKER = 'agent-debug-overlay';

function distExists(): boolean {
  try {
    return statSync(DIST_ASSETS).isDirectory();
  } catch {
    return false;
  }
}

describe('dev overlay tree-shake guard (T05)', () => {
  it('agent-debug-overlay marker is absent from every shipped JS chunk', () => {
    if (!distExists()) {
      // Build hasn't run in this workspace yet; skip rather than fail. CI
      // always runs `pnpm build` before `pnpm test` so the real check fires
      // there. Local runs without a prior build just don't exercise this.
      return;
    }
    const jsFiles = readdirSync(DIST_ASSETS).filter((file) => file.endsWith('.js'));
    expect(jsFiles.length).toBeGreaterThan(0);
    for (const file of jsFiles) {
      const contents = readFileSync(join(DIST_ASSETS, file), 'utf8');
      expect(
        contents.includes(DEV_MARKER),
        `${file} contains "${DEV_MARKER}" — dev overlay leaked into production bundle. See docs/plans/release-1.0-batch.prq.md T05.`,
      ).toBe(false);
    }
  });
});
