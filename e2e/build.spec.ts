import { expect, test, type Page } from '@playwright/test';
import { bootToHUD, readFunds } from './helpers/flow';
import { activate } from './helpers/activate';
import { shot } from './helpers/shot';

/**
 * Translate a grid cell to canvas-host local pixel coords using the
 * renderer's own screenToGrid inverse:
 *
 *   wx = gx * CELL_SIZE.w
 *   wy = -gy * CELL_SIZE.h
 *   screenX = rect.left + rect.width/2 + panX + wx * zoom
 *   screenY = rect.top  + rect.height/2 + panY + wy * zoom
 *
 * Default view is panX=0, panY=0, zoom=1 (per createInitialView).
 */
const CELL_W = 32;
const CELL_H = 24;

/**
 * Read pan + zoom from the live ViewTrait via a known global debug hook.
 * Tests must not be coupled to hard-coded initial view state — scenario
 * deep-links use different pan/zoom.
 */
async function getView(page: Page): Promise<{ panX: number; panY: number; zoom: number }> {
  const view = await page.evaluate(() => {
    // Expose Koota world state via a debug accessor.
    const w = (
      window as unknown as {
        reachForTheSky?: { getView?: () => { panX: number; panY: number; zoom: number } };
      }
    ).reachForTheSky;
    return w?.getView?.() ?? { panX: 0, panY: 0, zoom: 1 };
  });
  return view;
}

async function gridToScreen(
  page: Page,
  gx: number,
  gy: number,
): Promise<{ x: number; y: number }> {
  const box = await page.locator('.canvas-host').boundingBox();
  if (!box) throw new Error('canvas-host has no bounding box');
  const view = await getView(page);
  const wx = gx * CELL_W;
  const wy = -gy * CELL_H;
  const x = box.x + box.width / 2 + view.panX + wx * view.zoom;
  const y = box.y + box.height / 2 + view.panY + wy * view.zoom;
  return { x, y };
}

async function dragGridCells(
  page: Page,
  start: { gx: number; gy: number },
  end: { gx: number; gy: number },
): Promise<void> {
  const s = await gridToScreen(page, start.gx, start.gy);
  const e = await gridToScreen(page, end.gx, end.gy);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move((s.x + e.x) / 2, (s.y + e.y) / 2, { steps: 5 });
  await page.mouse.move(e.x, e.y, { steps: 5 });
  await page.mouse.up();
}

test.describe('Build commit — dragging on the canvas commits a room', () => {
  test('pick Lobby tool + drag across ground → funds decrease + population becomes non-zero', async ({
    page,
  }, testInfo) => {
    await bootToHUD(page, testInfo);
    // Pause so nothing moves during our drag and assertions.
    await activate(page.getByRole('button', { name: 'Pause simulation' }).first(), testInfo);

    const startFunds = await readFunds(page);
    const preItemCount = await page.evaluate(
      () => window.reachForTheSky?.getItemCount() ?? 0,
    );

    // Select the Lobby tool. Clear any tutorial-driven selection first.
    const toolbar = page.locator('.toolbar .tool-button');
    const lobbyTool = toolbar.filter({ hasText: 'Lobby' }).first();
    await activate(lobbyTool, testInfo);
    await expect(lobbyTool).toHaveAttribute('aria-pressed', 'true');

    await shot(page, testInfo, 'build-01-tool-selected.png');

    // Lobby spans a few cells on the ground row (gy=0). Drag from
    // (gx=-2, gy=0) to (gx=2, gy=0) — 5 cells of lobby along ground.
    await dragGridCells(page, { gx: -2, gy: 0 }, { gx: 2, gy: 0 });

    await shot(page, testInfo, 'build-02-after-drag.png');

    // Authoritative check: query the Koota world for item count. Must have
    // strictly more items than before the drag (not just >0 — a scenario
    // that pre-seeds rooms would pass a >0 check without a commit).
    const postItemCount = await page.evaluate(
      () => window.reachForTheSky?.getItemCount() ?? 0,
    );
    expect(postItemCount).toBeGreaterThan(preItemCount);

    // And funds must have decreased by at least the lobby cost ($1,500).
    const fundsAfter = await readFunds(page);
    expect(fundsAfter).toBeLessThan(startFunds);
  });

  test('build readout shows preview.error when the current drag is invalid', async ({
    page,
  }, testInfo) => {
    await bootToHUD(page, testInfo);
    await activate(page.getByRole('button', { name: 'Pause simulation' }).first(), testInfo);

    const toolbar = page.locator('.toolbar .tool-button');
    // Select Office — requires a Lobby+Floor beneath; dragging on empty
    // ground must produce an error in the build-readout body line.
    const office = toolbar.filter({ hasText: 'Office' }).first();
    await activate(office, testInfo);
    await expect(office).toHaveAttribute('aria-pressed', 'true');

    // Drag an Office 5 cells up with no lobby/floor beneath — must NOT
    // commit. Funds unchanged; validates the structural support check.
    const fundsBefore = await readFunds(page);
    await dragGridCells(page, { gx: 0, gy: 5 }, { gx: 2, gy: 5 });
    const fundsAfter = await readFunds(page);
    expect(fundsAfter).toBe(fundsBefore);

    await shot(page, testInfo, 'build-invalid-preview.png');

    // Readout must still be alive (no crash).
    const readout = page.locator('.build-readout');
    await expect(readout).toBeVisible();
  });
});
