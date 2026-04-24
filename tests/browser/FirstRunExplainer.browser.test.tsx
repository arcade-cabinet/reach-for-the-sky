import { render } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FirstRunExplainer } from '@app/components/FirstRunExplainer';
import { PREF_KEYS, preferences } from '@/persistence/preferences';

// The explainer auto-bypasses under navigator.webdriver (designed for CDP
// automation). Playwright sets webdriver=true by default, so every test in
// this file either accepts that behavior or overrides it before mount.
function overrideWebdriver(value: boolean) {
  Object.defineProperty(navigator, 'webdriver', {
    configurable: true,
    get: () => value,
  });
}

async function resetFirstRunSeen() {
  // preferences is Capacitor Preferences (in-memory in the browser test env
  // before any Capacitor plugin installs). Remove the flag so the modal has
  // a chance to show on the next mount.
  await preferences.remove(PREF_KEYS.firstRunSeen);
}

describe('FirstRunExplainer (browser)', () => {
  beforeEach(async () => {
    // Each test starts from a clean preferences slate so firstRunSeen lookups
    // don't leak between tests.
    await resetFirstRunSeen();
    // Also clear URL params a prior test may have set.
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    overrideWebdriver(true);
  });

  it('stays hidden under automation (webdriver=true)', async () => {
    overrideWebdriver(true);
    const { container } = render(() => <FirstRunExplainer />);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(container.querySelector('.first-run-overlay')).toBeNull();
  });

  it('stays hidden when ?scenario deep-link is present', async () => {
    overrideWebdriver(false);
    window.history.replaceState({}, '', '/?scenario=opening');
    const { container } = render(() => <FirstRunExplainer />);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(container.querySelector('.first-run-overlay')).toBeNull();
  });

  it('stays hidden when ?skip-intro=1 is present', async () => {
    overrideWebdriver(false);
    window.history.replaceState({}, '', '/?skip-intro=1');
    const { container } = render(() => <FirstRunExplainer />);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(container.querySelector('.first-run-overlay')).toBeNull();
  });

  it('shows the modal for a fresh player and advances through steps', async () => {
    overrideWebdriver(false);
    const { container, findByText } = render(() => <FirstRunExplainer />);

    const firstTitle = await findByText('A living tower');
    expect(firstTitle).toBeDefined();

    // First step: primary action is "Next" (not the final step's "Start building").
    const primary = container.querySelector(
      '.first-run-card button.primary',
    ) as HTMLButtonElement;
    expect(primary.textContent).toContain('Next');

    primary.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('#first-run-title')?.textContent).toBe('Read the cutaway');

    primary.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('#first-run-title')?.textContent).toBe(
      'Declare who the tower is',
    );

    // Final step: primary action becomes "Start building" and advancing finishes.
    expect(primary.textContent).toContain('Start building');
    primary.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('.first-run-overlay')).toBeNull();
  });

  it('Escape key closes the modal immediately', async () => {
    overrideWebdriver(false);
    const { container } = render(() => <FirstRunExplainer />);
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(container.querySelector('.first-run-overlay')).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('.first-run-overlay')).toBeNull();
  });

  it('Skip button closes the modal', async () => {
    overrideWebdriver(false);
    const { container } = render(() => <FirstRunExplainer />);
    await new Promise((resolve) => setTimeout(resolve, 40));

    const skip = container.querySelector('.first-run-skip') as HTMLButtonElement;
    expect(skip).not.toBeNull();
    skip.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('.first-run-overlay')).toBeNull();
  });

  it('dialog carries role=dialog and aria-modal=true', async () => {
    overrideWebdriver(false);
    const { container } = render(() => <FirstRunExplainer />);
    await new Promise((resolve) => setTimeout(resolve, 40));

    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe('first-run-title');
  });
});
