import type { SaveSlotSummary } from '@logic/persistence/saveRepository';
import type { ScenarioCardContent, ScenarioId } from '@logic/simulation/content';

interface StartScreenProps {
  assetUrl: (path: string) => string;
  formatSlotSummary: (summary: SaveSlotSummary | undefined) => string;
  onContinue: () => Promise<void> | void;
  onScenario: (scenario: ScenarioId) => Promise<void> | void;
  onSelectSaveSlot: (slotId: string) => void;
  onStart: () => Promise<void> | void;
  platformLabel: string;
  saveSlots: SaveSlotSummary[];
  scenarios: readonly ScenarioCardContent[];
  selectedSaveSlot: string;
  slotLabel: (slotId: string) => string;
  startNotice: string | null;
}

export function StartScreen(props: StartScreenProps) {
  return (
    <section class="start-screen">
      <div class="start-atmosphere" aria-hidden="true">
        <span class="start-atmosphere-glow" />
      </div>

      <section class="start-hero">
        <p class="start-kicker">Emergent living-tower simulator</p>
        <h1 class="start-title">
          <span>Reach</span>
          <span>For The</span>
          <span>Sky</span>
        </h1>
        <p class="start-deck">
          Build a tower people have to live with. Architecture, tenants, crowds, inspectors,
          weather, money, and public memory collide until the building earns a role in the city.
        </p>
        <div class="start-actions">
          <button type="button" class="primary" onClick={() => void props.onStart()}>
            Break Ground
          </button>
          <button type="button" class="secondary" onClick={() => void props.onContinue()}>
            Continue Tower
          </button>
        </div>
        {props.startNotice && (
          <p class="start-notice" role="status" aria-live="polite">
            {props.startNotice}
          </p>
        )}
        <div class="start-platform-tag">
          <span>Now playing on</span>
          <strong>{props.platformLabel}</strong>
        </div>
      </section>

      <section class="start-below" aria-label="More about this tower">
        {props.saveSlots.length > 0 && (
          <div class="start-saves">
            <div class="start-section-eyebrow">Saved towers</div>
            <div class="start-save-row" role="radiogroup" aria-label="Saved towers">
              {props.saveSlots.slice(0, 4).map((slot) => (
                // biome-ignore lint/a11y/useSemanticElements: rich button content (label + summary) cannot be expressed as <input type="radio">; WAI-ARIA APG permits role="radio" on buttons in toolbar-style groupings
                <button
                  type="button"
                  role="radio"
                  classList={{ active: props.selectedSaveSlot === slot.slotId }}
                  aria-checked={props.selectedSaveSlot === slot.slotId}
                  onClick={() => props.onSelectSaveSlot(slot.slotId)}
                >
                  <strong>{props.slotLabel(slot.slotId)}</strong>
                  <span>{props.formatSlotSummary(slot)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div class="start-scenarios">
          <div class="start-section-eyebrow">Jump into a city moment</div>
          <div class="start-scenario-row">
            {props.scenarios.map((scenario) => (
              <button
                type="button"
                class="start-scenario-card"
                onClick={() => void props.onScenario(scenario.id)}
              >
                <img src={props.assetUrl(scenario.preview)} alt="" loading="lazy" />
                <div>
                  <strong>{scenario.title}</strong>
                  <small>{scenario.description}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}
