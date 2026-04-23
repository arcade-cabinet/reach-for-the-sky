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

  const advance = () => {
    if (step() < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    finish();
  };

  const finish = () => {
    setVisible(false);
    void preferences.set(PREF_KEYS.tutorialStep, 'completed');
  };

  const handleKey = (event: KeyboardEvent) => {
    if (!visible()) return;
    if (event.key === 'Escape') finish();
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowRight') {
      event.preventDefault();
      advance();
    }
    if (event.key === 'ArrowLeft' && step() > 0) {
      event.preventDefault();
      setStep((s) => s - 1);
    }
  };

  onMount(() => {
    void (async () => {
      const current = await preferences.get(PREF_KEYS.tutorialStep);
      if (current !== 'completed') setVisible(true);
    })();
  });

  createEffect(() => {
    if (!visible()) return;
    window.addEventListener('keydown', handleKey);
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
        <div class="first-run-card">
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
            <button type="button" class="primary" onClick={advance}>
              {step() === TOTAL_STEPS - 1 ? 'Start building' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}
