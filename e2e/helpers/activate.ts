import type { Locator, TestInfo } from '@playwright/test';

/**
 * Tap a target in a way that survives narrow phone viewports and
 * mid-transition overlays. The HUD drawers slide with CSS transforms, which
 * play havoc with Playwright's actionability checks — force:true bypasses
 * the "element covered by an ancestor" false-positives we hit on Pixi-host
 * overlays that are present but visually empty.
 */
export async function activate(
  target: Locator,
  _testInfo: TestInfo,
): Promise<void> {
  await target.waitFor({ state: 'visible' });
  await target.scrollIntoViewIfNeeded().catch(() => undefined);
  await target.click({ force: true });
}
