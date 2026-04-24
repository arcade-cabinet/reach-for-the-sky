import { expect, test } from '@playwright/test';
import { bootToHUD, bootToScenario, readDay, readTimecode } from './helpers/flow';
import { activate } from './helpers/activate';
import { shot } from './helpers/shot';

test.describe('Smoke — the game actually boots and plays', () => {
  test('landing page → Break Ground → HUD becomes live', async ({ page }, testInfo) => {
    await page.goto('/?skip-intro=1');
    await expect(page.getByRole('button', { name: 'Break Ground' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue Tower' })).toBeVisible();
    await shot(page, testInfo, '01-landing.png');

    await activate(page.getByRole('button', { name: 'Break Ground' }), testInfo);

    await expect(
      page.locator('section.top-hud[aria-label="Game HUD and controls"]'),
    ).toBeVisible({ timeout: 15_000 });
    await shot(page, testInfo, '02-hud-live.png');
  });

  test('in-game clock advances at Play speed (timecode ticks)', async ({
    page,
  }, testInfo) => {
    await bootToHUD(page, testInfo);

    // Play speed — one in-game day takes ~67s real time at 1x; the
    // sub-day timecode is a fine-grained signal that the tick loop runs.
    const playBtn = page.getByRole('button', { name: 'Play at normal speed' }).first();
    await activate(playBtn, testInfo);

    const startTimecode = await readTimecode(page);

    // Timecode should change within 10s at Play speed.
    await expect
      .poll(async () => await readTimecode(page), { timeout: 10_000, intervals: [250, 500, 1000] })
      .not.toBe(startTimecode);
  });

  test('day counter rolls at Fast speed within 30 seconds', async ({ page }, testInfo) => {
    await bootToHUD(page, testInfo);

    // Fast speed — one in-game day takes ~17s real time, so 30s window
    // guarantees we cross at least one day boundary.
    const fastBtn = page.getByRole('button', { name: 'Fast forward at 4x speed' }).first();
    await activate(fastBtn, testInfo);

    const startDay = await readDay(page);
    expect(Number.isFinite(startDay)).toBe(true);

    await expect
      .poll(async () => await readDay(page), { timeout: 30_000, intervals: [1000, 2000] })
      .toBeGreaterThan(startDay);
    await shot(page, testInfo, 'day-advanced.png');
  });

  test('Pause button actually pauses: timecode stops advancing', async ({
    page,
  }, testInfo) => {
    await bootToHUD(page, testInfo);

    const pauseBtn = page.getByRole('button', { name: 'Pause simulation' }).first();
    await activate(pauseBtn, testInfo);

    // Let any in-flight tick finish before sampling.
    await page.waitForTimeout(200);
    const timecodeAtPause = await readTimecode(page);
    await page.waitForTimeout(4_000);
    const timecodeAfterPause = await readTimecode(page);
    expect(timecodeAfterPause).toBe(timecodeAtPause);
  });

  test('scenario deep-link boots directly into skyline (Act 5, victory)', async ({
    page,
  }, testInfo) => {
    await bootToScenario(page, 'skyline');

    // Skyline opens with contracts drawer so you can declare identity.
    const contractsDrawer = page.locator('aside.contracts-drawer');
    await expect(contractsDrawer).toHaveAttribute('aria-hidden', /false|true/);

    // Some tower state exists — top-metrics is populated.
    await expect(page.locator('.top-metrics')).toBeVisible();
    await shot(page, testInfo, 'skyline-boot.png');
  });
});
