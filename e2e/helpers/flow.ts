import { expect, type Page, type TestInfo } from '@playwright/test';
import { activate } from './activate';

/**
 * Go from the raw start screen to a live HUD. Uses ?skip-intro=1 so the
 * FirstRunExplainer is bypassed — that overlay is covered by its own
 * browser-mode tests, and running through it here would pad every spec
 * with 3 tap-through steps.
 */
export async function bootToHUD(page: Page, testInfo: TestInfo): Promise<void> {
  await page.goto('/?skip-intro=1');
  const breakGround = page.getByRole('button', { name: 'Break Ground' });
  await activate(breakGround, testInfo);
  await expect(
    page.locator('section.top-hud[aria-label="Game HUD and controls"]'),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Direct-boot into a named scenario via deep-link. The scenario hydrator
 * bypasses save-load and the first-run explainer.
 */
export async function bootToScenario(
  page: Page,
  scenario: 'opening' | 'skyline' | 'weather' | 'recovery',
): Promise<void> {
  await page.goto(`/?scenario=${scenario}`);
  await expect(
    page.locator('section.top-hud[aria-label="Game HUD and controls"]'),
  ).toBeVisible({ timeout: 15_000 });
}

/**
 * Parse a formatted money string like "$4.53k" or "$120,400" to a number.
 */
function parseMoney(text: string): number {
  const trimmed = text.replace(/[,$\s]/g, '');
  if (trimmed.endsWith('k')) return Math.round(parseFloat(trimmed) * 1_000);
  if (trimmed.endsWith('m')) return Math.round(parseFloat(trimmed) * 1_000_000);
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

export async function readFunds(page: Page): Promise<number> {
  // First article inside .top-metrics is Funds. Prefer the full-precision
  // title attribute over the compact display ("$4.53k").
  const fundsStrong = page.locator('.top-metrics article').first().locator('strong');
  await expect(fundsStrong).toBeVisible();
  const titleAttr = await fundsStrong.getAttribute('title');
  if (titleAttr && titleAttr.length > 0) return parseMoney(titleAttr);
  const text = (await fundsStrong.textContent()) ?? '';
  return parseMoney(text);
}

export async function readDay(page: Page): Promise<number> {
  const dayEyebrow = page.locator('.top-clock .eyebrow').first();
  await expect(dayEyebrow).toBeVisible();
  const text = (await dayEyebrow.textContent()) ?? '';
  const match = /\d+/.exec(text);
  return match ? Number(match[0]) : Number.NaN;
}

/**
 * In-game timecode (e.g. "16:52"). Reported as a string so callers can
 * assert on change without caring about hour math.
 */
export async function readTimecode(page: Page): Promise<string> {
  const tc = page.locator('.top-clock .timecode').first();
  await expect(tc).toBeVisible();
  return ((await tc.textContent()) ?? '').trim();
}
