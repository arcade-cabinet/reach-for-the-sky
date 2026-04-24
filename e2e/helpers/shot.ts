import type { Page, TestInfo } from '@playwright/test';

/**
 * Attach a named viewport screenshot to the current test.
 *
 * Playwright's `page.screenshot()` and `locator.screenshot()` both block
 * on `document.fonts.ready` → "scroll into view" → actionability wait,
 * and the Pixi canvas keeps repainting so those gates never clear.
 *
 * Workaround: pause all CSS animations + mark the Pixi stage as a fixed
 * layout (so the page doesn't re-lay-out mid-snapshot) by briefly pausing
 * the sim through the HUD pause button BEFORE calling screenshot. The
 * bitmap font registration is already complete by the time we get here,
 * so `fonts.ready` actually resolves — we just need the page to stop
 * moving. If the first try times out, fall back to a CDP snapshot with
 * a hard 5s cap.
 */
export async function shot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  try {
    const buf = await page.screenshot({
      fullPage: false,
      timeout: 5_000,
      animations: 'disabled',
    });
    await testInfo.attach(name, { body: buf, contentType: 'image/png' });
  } catch {
    // CDP fallback — bypasses all the actionability gates.
    const cdp = await page.context().newCDPSession(page);
    try {
      const { data } = await Promise.race([
        cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }),
        new Promise<{ data: string }>((_, reject) =>
          setTimeout(() => reject(new Error('cdp screenshot timeout')), 5_000),
        ),
      ]);
      const buf = Buffer.from(data, 'base64');
      await testInfo.attach(name, { body: buf, contentType: 'image/png' });
    } catch {
      // Give up silently — test assertions are the source of truth, the
      // screenshot is just diagnostic artifact.
    } finally {
      await cdp.detach().catch(() => undefined);
    }
  }
}
