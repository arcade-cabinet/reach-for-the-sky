import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@app/App';

afterEach(cleanup);

async function waitFor(
  predicate: () => boolean,
  { timeout = 4000, interval = 50 }: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error('waitFor timed out');
}

function openSettings(container: HTMLElement): HTMLButtonElement {
  const settingsBtn = Array.from(
    container.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
  ).find((b) => b.getAttribute('aria-label') === 'Open settings');
  if (!settingsBtn) throw new Error('Settings button not found');
  settingsBtn.click();
  return settingsBtn;
}

describe('Settings drawer (full App, scenario deep-link)', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/?scenario=opening');
  });
  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('opens on button click and updates the toggle aria-label to Close', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('aside.settings-drawer'));

    const btn = openSettings(container);
    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(btn.getAttribute('aria-label')).toBe('Close settings');
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(
      container.querySelector('aside.settings-drawer')?.getAttribute('aria-hidden'),
    ).toBe('false');
  });

  it('every settings-toggles button carries aria-pressed', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('aside.settings-drawer'));
    openSettings(container);
    await new Promise((resolve) => setTimeout(resolve, 40));

    const toggles = container.querySelectorAll(
      'aside.settings-drawer .settings-toggles button',
    ) as NodeListOf<HTMLButtonElement>;
    expect(toggles.length).toBeGreaterThan(0);
    for (const t of toggles) {
      expect(t.getAttribute('aria-pressed')).toMatch(/^(true|false)$/);
    }
  });

  it('audio range sliders carry aria-valuetext formatted as "N percent"', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('aside.settings-drawer'));
    openSettings(container);
    await new Promise((resolve) => setTimeout(resolve, 40));

    const sliders = container.querySelectorAll(
      'aside.settings-drawer input[type="range"]',
    ) as NodeListOf<HTMLInputElement>;
    // At least one slider present; per-slider aria-valuetext is the real
    // contract (loop below). Decoupling from exact count lets us add or
    // remove a control without breaking this test.
    expect(sliders.length).toBeGreaterThanOrEqual(1);
    for (const slider of sliders) {
      const vt = slider.getAttribute('aria-valuetext');
      expect(vt).not.toBeNull();
      expect(vt).toMatch(/\d+ percent/);
    }
  });

  it('slider numeric readout updates when value changes', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('aside.settings-drawer'));
    openSettings(container);
    await new Promise((resolve) => setTimeout(resolve, 40));

    const slider = container.querySelector(
      'aside.settings-drawer input[type="range"]',
    ) as HTMLInputElement;
    const readoutBefore = slider
      .closest('label')
      ?.querySelector('.range-value')?.textContent?.trim();

    // Simulate a user drag: set value + dispatch 'input' the same way Solid listens.
    slider.value = '0.25';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 40));

    const readoutAfter = slider
      .closest('label')
      ?.querySelector('.range-value')?.textContent?.trim();
    expect(readoutAfter).not.toBe(readoutBefore);
    expect(readoutAfter).toBe('25%');
    // aria-valuetext also re-rendered to the same percent.
    expect(slider.getAttribute('aria-valuetext')).toBe('25 percent');
  });

  it('save-slot panel is a radiogroup with aria-checked semantics', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('aside.settings-drawer'));
    openSettings(container);
    await new Promise((resolve) => setTimeout(resolve, 40));

    const list = container.querySelector('aside.settings-drawer .save-slot-list');
    expect(list?.getAttribute('role')).toBe('radiogroup');
    expect(list?.getAttribute('aria-label')).toBe('Save slot');

    const radios = list?.querySelectorAll('button[role="radio"]') ?? [];
    expect(radios.length).toBeGreaterThan(0);
    let checkedCount = 0;
    for (const r of radios) {
      const checked = r.getAttribute('aria-checked');
      expect(checked).toMatch(/^(true|false)$/);
      if (checked === 'true') checkedCount += 1;
    }
    expect(checkedCount).toBe(1);
  });
});
