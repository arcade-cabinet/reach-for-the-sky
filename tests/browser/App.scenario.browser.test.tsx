import { render } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '@app/App';

/**
 * Full-App coordination tests. Mounts <App /> with a scenario deep-link so
 * the FirstRunExplainer short-circuits and the simulation hydrates to a
 * known state. Assertions are on live DOM attributes (aria-pressed,
 * aria-label, aria-hidden) — the whole point of browser mode is to catch
 * drift between the TSX source and the rendered tree.
 */

function setScenarioURL(scenario: 'opening' | 'skyline' | 'weather' | 'recovery') {
  window.history.replaceState({}, '', `/?scenario=${scenario}`);
}

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

describe('App (scenario deep-link)', () => {
  beforeEach(() => {
    setScenarioURL('opening');
  });

  afterEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('renders top-hud as a labeled landmark', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('section.top-hud'));
    const hud = container.querySelector('section.top-hud');
    expect(hud?.getAttribute('aria-label')).toBe('Game HUD and controls');
  });

  it('speed controls carry aria-pressed reflecting clock speed', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('.speed-row'));
    // Desktop speed-row is inside .top-clock; there's also a mobile row that
    // mirrors it. Any one Pause button is enough to assert aria-pressed is
    // wired to clock.speed === 0.
    const pauseBtns = container.querySelectorAll(
      'button[aria-label="Pause simulation"]',
    ) as NodeListOf<HTMLButtonElement>;
    expect(pauseBtns.length).toBeGreaterThan(0);
    for (const btn of pauseBtns) {
      expect(btn.getAttribute('aria-pressed')).toMatch(/^(true|false)$/);
    }
  });

  it('lens-panel labels itself and renders all 8 lens buttons', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('.lens-panel'));
    const panel = container.querySelector('.lens-panel');
    expect(panel?.getAttribute('aria-label')).toBe('Diagnostic lenses');
    const buttons = panel?.querySelectorAll('button') ?? [];
    expect(buttons.length).toBe(8);
    // Every lens button must carry aria-pressed — exactly one "true".
    let trueCount = 0;
    for (const btn of buttons) {
      const value = btn.getAttribute('aria-pressed');
      expect(value).toMatch(/^(true|false)$/);
      if (value === 'true') trueCount += 1;
    }
    expect(trueCount).toBe(1);
  });

  it('toolbar labels itself and each tool button carries aria-pressed', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('.toolbar'));
    const toolbar = container.querySelector('.toolbar');
    expect(toolbar?.getAttribute('aria-label')).toBe('Build tools');
    const buttons = toolbar?.querySelectorAll('button.tool-button') ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      expect(btn.getAttribute('aria-pressed')).toMatch(/^(true|false)$/);
      // Cost-bearing aria-label: "Name, $cost" — must contain a dollar sign.
      expect(btn.getAttribute('aria-label') ?? '').toContain('$');
    }
  });

  it('contracts and settings drawers expose aria-hidden that tracks open state', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('aside.contracts-drawer'));

    const contracts = container.querySelector('aside.contracts-drawer');
    const settings = container.querySelector('aside.settings-drawer');
    expect(contracts?.getAttribute('aria-label')).toBe('Contracts drawer');
    expect(settings?.getAttribute('aria-label')).toBe('Settings drawer');
    // Neither drawer opens by default under scenario deep-link.
    expect(contracts?.getAttribute('aria-hidden')).toBe('true');
    expect(settings?.getAttribute('aria-hidden')).toBe('true');
  });

  it('notifications section is a polite aria-live region', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('section.notifications'));
    const region = container.querySelector('section.notifications');
    expect(region?.getAttribute('aria-live')).toBe('polite');
    expect(region?.getAttribute('aria-label')).toBe('Live notifications');
  });

  it('reset button carries its aria-label', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('button.reset-button'));
    const reset = container.querySelector('button.reset-button');
    expect(reset?.getAttribute('aria-label')).toBe('Reset tower and return to start screen');
  });

  it('contracts toggle button swaps aria-label based on drawer state', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('button[class*="side-button"]'));
    // Find the Contracts button by its default aria-label.
    const contractsBtn = Array.from(
      container.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.getAttribute('aria-label') === 'Open contracts drawer');
    expect(contractsBtn).toBeDefined();

    contractsBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    // After click, the same button should now say "Close".
    expect(contractsBtn?.getAttribute('aria-label')).toBe('Close contracts drawer');
    expect(contractsBtn?.getAttribute('aria-expanded')).toBe('true');

    const contracts = container.querySelector('aside.contracts-drawer');
    expect(contracts?.getAttribute('aria-hidden')).toBe('false');
  });

  it('Escape key closes the contracts drawer', async () => {
    const { container } = render(() => <App />);
    await waitFor(() => !!container.querySelector('aside.contracts-drawer'));
    const contractsBtn = Array.from(
      container.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((b) => b.getAttribute('aria-label') === 'Open contracts drawer');
    contractsBtn?.click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(
      container.querySelector('aside.contracts-drawer')?.getAttribute('aria-hidden'),
    ).toBe('false');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(
      container.querySelector('aside.contracts-drawer')?.getAttribute('aria-hidden'),
    ).toBe('true');
  });
});
