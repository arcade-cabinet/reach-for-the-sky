import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { PREF_KEYS, preferences } from '@/persistence/preferences';

const TOTAL_STEPS = 3;

const STEPS = [
  {
    title: 'A living tower',
    body: 'Everything in this building is driven by people running their own algorithms. Every tenant, visitor, cohort has distinct goals, traits, and reactions. The tower is emergent, not scripted.',
  },
  {
    title: 'Read the cutaway',
    body: 'The 2D cutaway is the main surface. Use the lenses (bottom row) to switch between maintenance, transit, privacy, safety, and event views. Agents you see are real simulated people, not decoration.',
  },
  {
    title: 'Declare who the tower is',
    body: 'As your tower forms a pattern, declare an identity in the contracts drawer. Business, hospitality, civic, luxury — each choice reshapes who the city sends and what they demand.',
  },
];

export function FirstRunExplainer() {
  const [visible, setVisible] = createSignal(false);
  const [step, setStep] = createSignal(0);
  let cardRef: HTMLDivElement | undefined;
  let primaryRef: HTMLButtonElement | undefined;
  let previouslyFocused: HTMLElement | null = null;

  const advance = () => {
    if (step() < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    finish();
  };

  const finish = () => {
    setVisible(false);
    void preferences.set(PREF_KEYS.firstRunSeen, '1');
  };

  const focusables = (): HTMLElement[] => {
    if (!cardRef) return [];
    return Array.from(
      cardRef.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute('disabled'));
  };

  const handleKey = (event: KeyboardEvent) => {
    if (!visible()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      finish();
      return;
    }
    if (event.key === 'Tab') {
      // Trap focus inside the modal so keyboard users can't tab into the
      // HUD controls behind the overlay.
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !cardRef?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !cardRef?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight') {
      event.preventDefault();
      advance();
      return;
    }
    if (event.key === 'ArrowLeft' && step() > 0) {
      event.preventDefault();
      setStep((s) => s - 1);
    }
  };

  onMount(() => {
    void (async () => {
      // Skip in three bypass cases — the modal would block automation or
      // misfire for players who jumped in via a deep-linked scenario:
      //   1. `?scenario=...` deep-link — play starts via side-loaded state
      //   2. `?skip-intro=1` explicit opt-out
      //   3. `navigator.webdriver === true` — Chrome DevTools Protocol /
      //      Playwright / Selenium all set this, so the browser-smoke
      //      verifiers auto-bypass without needing their own URL handling.
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const automated = navigator.webdriver === true;
        if (params.has('scenario') || params.get('skip-intro') === '1' || automated) {
          void preferences.set(PREF_KEYS.firstRunSeen, '1');
          return;
        }
      }
      const current = await preferences.get(PREF_KEYS.firstRunSeen);
      if (current !== '1') setVisible(true);
    })();
  });

  createEffect(() => {
    if (!visible()) {
      // Restore focus to whatever had it when the modal opened.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
        previouslyFocused = null;
      }
      return;
    }
    previouslyFocused = document.activeElement as HTMLElement | null;
    window.addEventListener('keydown', handleKey);
    // Focus the primary action so Enter lands somewhere useful immediately.
    queueMicrotask(() => primaryRef?.focus());
    onCleanup(() => window.removeEventListener('keydown', handleKey));
  });

  return (
    <Show when={visible()}>
      <div
        class="first-run-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-run-title"
      >
        <div class="first-run-card" ref={cardRef}>
          <div class="first-run-progress" aria-hidden="true">
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <span classList={{ active: index === step(), done: index < step() }} />
            ))}
          </div>
          <h2 id="first-run-title">{STEPS[step()].title}</h2>
          <p>{STEPS[step()].body}</p>
          <div class="first-run-actions">
            <button
              type="button"
              class="first-run-skip"
              onClick={finish}
              aria-label="Skip the first-run explainer"
            >
              Skip
            </button>
            <button type="button" class="primary" onClick={advance} ref={primaryRef}>
              {step() === TOTAL_STEPS - 1 ? 'Start building' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
