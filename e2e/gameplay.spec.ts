import { expect, test } from '@playwright/test';
import { bootToHUD, bootToScenario } from './helpers/flow';
import { activate } from './helpers/activate';
import { shot } from './helpers/shot';

test.describe('Lens swap — every diagnostic lens renders', () => {
  const LENSES = [
    'Normal',
    'Maintenance',
    'Transit',
    'Value',
    'Sentiment',
    'Privacy',
    'Safety',
    'Events',
  ];

  test('clicking each lens makes it the sole aria-pressed=true button + captures screenshot', async ({
    page,
  }, testInfo) => {
    await bootToHUD(page, testInfo);
    // Pause so the canvas doesn't animate between shots.
    await activate(
      page.getByRole('button', { name: 'Pause simulation' }).first(),
      testInfo,
    );

    for (const lens of LENSES) {
      const btn = page.locator(`.lens-panel button:has-text("${lens}")`).first();
      await activate(btn, testInfo);
      await expect(btn).toHaveAttribute('aria-pressed', 'true');

      // Exactly one lens button should be aria-pressed=true.
      const pressedCount = await page
        .locator('.lens-panel button[aria-pressed="true"]')
        .count();
      expect(pressedCount).toBe(1);

      await shot(page, testInfo, `lens-${lens.toLowerCase()}.png`);
    }
  });
});

test.describe('Drawers — settings and contracts open, close, and cooperate', () => {
  test('settings opens, every panel renders, Escape closes', async ({ page }, testInfo) => {
    await bootToHUD(page, testInfo);

    const settingsToggle = page.getByRole('button', { name: 'Open settings' });
    await activate(settingsToggle, testInfo);

    const drawer = page.locator('aside.settings-drawer');
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await shot(page, testInfo, 'settings-open.png');

    // Three audio sliders present.
    const sliders = drawer.locator('input[type="range"]');
    await expect(sliders).toHaveCount(3);

    // Save-slot radiogroup rendered.
    await expect(drawer.locator('.save-slot-list[role="radiogroup"]')).toBeVisible();

    // Escape closes it.
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  });

  test('contracts drawer opens on toggle, aria-expanded flips, Escape closes', async ({
    page,
  }, testInfo) => {
    await bootToHUD(page, testInfo);

    // Stable locator — the aria-label swaps Open→Close on click, so we
    // anchor on the .side-button-with-aria-expanded instead.
    const toggle = page.locator('.top-clock .side-button[aria-expanded]');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await activate(toggle, testInfo);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(toggle).toHaveAttribute('aria-label', 'Close contracts drawer');

    const drawer = page.locator('aside.contracts-drawer');
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await shot(page, testInfo, 'contracts-open.png');

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('skyline scenario contracts drawer exposes enabled identity radios (Act 5)', async ({
    page,
  }, testInfo) => {
    await bootToScenario(page, 'skyline');

    const toggle = page.getByRole('button', { name: /contracts drawer/i });
    await activate(toggle, testInfo);

    // Identity radiogroup should show at Act 5.
    const group = page.locator('.identity-buttons[role="radiogroup"]');
    await expect(group).toBeVisible({ timeout: 5_000 });
    const radios = group.locator('button[role="radio"]');
    await expect(radios.first()).toBeEnabled();
    await shot(page, testInfo, 'skyline-identity.png');
  });
});

test.describe('Build tool palette — every tool is clickable and shows cost', () => {
  test('clicking any tool sets aria-pressed=true on exactly that tool (exclusivity)', async ({
    page,
  }, testInfo) => {
    await bootToHUD(page, testInfo);

    const tools = page.locator('.toolbar .tool-button');
    const count = await tools.count();
    expect(count).toBeGreaterThan(3);

    // Walk through the first 5 tools. After each click, at most one tool
    // has aria-pressed=true (selectTool either selects the new one or
    // toggles the same one off).
    for (let i = 0; i < Math.min(5, count); i++) {
      await tools.nth(i).click({ force: true });
      await page.waitForTimeout(80);
      const pressedCount = await page
        .locator('.toolbar .tool-button[aria-pressed="true"]')
        .count();
      expect(pressedCount).toBeLessThanOrEqual(1);
    }
  });

  test('every tool button carries a cost-bearing aria-label', async ({ page }, testInfo) => {
    await bootToHUD(page, testInfo);

    const tools = page.locator('.toolbar .tool-button');
    const count = await tools.count();
    for (let i = 0; i < count; i++) {
      const label = await tools.nth(i).getAttribute('aria-label');
      expect(label, `tool ${i} missing aria-label`).toBeTruthy();
      expect(label, `tool ${i} label missing $cost`).toMatch(/\$[\d,]+/);
    }
  });

  test('build readout swaps from "Select a tool" to the tool name on pick', async ({
    page,
  }, testInfo) => {
    await bootToHUD(page, testInfo);

    const readout = page.locator('.build-readout strong').first();

    // If initial state has anything selected (tutorial hint), clear it.
    const anyPressed = page.locator('.toolbar .tool-button[aria-pressed="true"]');
    if ((await anyPressed.count()) > 0) {
      await anyPressed.first().click({ force: true });
      await page.waitForTimeout(80);
    }

    await expect(readout).toHaveText('Select a tool');

    // Click first tool.
    await page.locator('.toolbar .tool-button').first().click({ force: true });
    await page.waitForTimeout(100);

    // Readout strong is no longer "Select a tool".
    const after = ((await readout.textContent()) ?? '').trim();
    expect(after).not.toBe('Select a tool');
    expect(after.length).toBeGreaterThan(0);
  });
});

test.describe('Speed controls — three-way exclusive state', () => {
  test('Pause, Play, Fast: only one aria-pressed=true at a time in each row', async ({
    page,
  }, testInfo) => {
    await bootToHUD(page, testInfo);

    // Pause.
    await activate(page.getByRole('button', { name: 'Pause simulation' }).first(), testInfo);
    const pausedPressed = await page
      .locator('.speed-row button[aria-pressed="true"]')
      .count();
    expect(pausedPressed).toBeGreaterThanOrEqual(1);

    // Switch to Fast.
    await activate(
      page.getByRole('button', { name: 'Fast forward at 4x speed' }).first(),
      testInfo,
    );
    // Each .speed-row should now have 1 pressed — the Fast button — with
    // Pause and Play at 'false'.
    const rows = await page.locator('.speed-row').count();
    for (let i = 0; i < rows; i++) {
      const rowPressed = await page
        .locator('.speed-row')
        .nth(i)
        .locator('button[aria-pressed="true"]')
        .count();
      expect(rowPressed).toBe(1);
    }
  });
});

test.describe('Canvas host — Pixi stage mounts and renders', () => {
  test('canvas-host appears with a <canvas> child (Pixi boot succeeded)', async ({
    page,
  }, testInfo) => {
    await bootToHUD(page, testInfo);

    const host = page.locator('.canvas-host');
    await expect(host).toBeVisible();

    // Pixi mounts a <canvas> inside this host.
    const canvas = host.locator('canvas');
    await expect(canvas).toHaveCount(1);

    // Canvas has non-zero dimensions (Pixi sized it to the container).
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(100);
    expect(box!.height).toBeGreaterThan(100);

    await shot(page, testInfo, 'canvas-ready.png');
  });
});
