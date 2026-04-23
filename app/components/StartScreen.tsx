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
        <span class="atmosphere-orbit orbit-a" />
        <span class="atmosphere-orbit orbit-b" />
        <span class="atmosphere-scanline" />
        <span class="atmosphere-tower tower-a" />
        <span class="atmosphere-tower tower-b" />
        <span class="atmosphere-tower tower-c" />
      </div>
      <div class="start-card">
        <div class="start-hero-copy">
          <p class="start-kicker">Emergent living-tower simulator</p>
          <h1>
            <span>Reach</span>
            <span>For The</span>
            <span>Sky</span>
          </h1>
          <p class="start-deck">
            Build a tower people actually have to live with. Architecture, tenants, crowds,
            inspectors, weather, money, and public memory collide until the building earns a role in
            the city.
          </p>
          <ul class="start-pill-row" aria-label="Core simulation pillars">
            <li>Architecture</li>
            <li>People</li>
            <li>Reputation</li>
            <li>City Pressure</li>
          </ul>
          <ul class="start-promise-line" aria-label="Simulation scale promises">
            <li>Macro: district pressure</li>
            <li>Meso: tower operations</li>
            <li>Micro: people with memory</li>
          </ul>
          <div class="start-actions">
            <button type="button" class="primary" onClick={() => void props.onStart()}>
              Break Ground
            </button>
            <button type="button" onClick={() => void props.onContinue()}>
              Continue Tower
            </button>
          </div>
          <p class="start-footnote">
            No rote VIP checklist. Public visits emerge from identity, pressure, venue mix, and how
            people remember the place.
          </p>
          {props.startNotice && <p class="start-notice">{props.startNotice}</p>}
        </div>

        <aside class="start-showcase" aria-label="Campaign promise">
          <div class="start-preview-frame">
            <img
              src={props.assetUrl('assets/previews/skyline-victory-desktop.png')}
              alt="A completed skyline tower with the contracts drawer open"
            />
            <div class="start-preview-glow" />
            <div class="start-live-badge">
              <span>Now serving</span>
              <strong>{props.platformLabel}</strong>
            </div>
          </div>
          <div class="start-stat-grid">
            <article>
              <span>Progression</span>
              <strong>Emergent</strong>
            </article>
            <article>
              <span>First Loop</span>
              <strong>10 Min</strong>
            </article>
            <article>
              <span>Endgame</span>
              <strong>Sandbox</strong>
            </article>
          </div>
          <ul class="start-journey-map" aria-label="What emerges from play">
            <li>Every tenant is a free-thinking algorithm</li>
            <li>Crowds move as flocks, not formations</li>
            <li>Identity drifts as the city reacts</li>
            <li>Late-game arcs are earned, not unlocked</li>
            <li>No star ladder, no obvious path</li>
          </ul>
        </aside>

        <section class="start-manifesto" aria-label="What the game asks from the player">
          <article>
            <span>Build</span>
            <strong>Author the tower's public role</strong>
            <p>Choose tenant mix, service capacity, venues, prestige, and access.</p>
          </article>
          <article>
            <span>Diagnose</span>
            <strong>Read pressure before it becomes scandal</strong>
            <p>Use reports, lenses, inspections, memories, and contract signals.</p>
          </article>
          <article>
            <span>Respond</span>
            <strong>Turn failures into civic leverage</strong>
            <p>Recover from bad visits, weather fronts, queues, and reputation shocks.</p>
          </article>
        </section>

        <fieldset class="scenario-grid">
          <legend>Playable city moments</legend>
          {props.scenarios.map((scenario) => (
            <button type="button" onClick={() => void props.onScenario(scenario.id)}>
              <img src={props.assetUrl(scenario.preview)} alt="" />
              <span>
                <em>City moment</em>
                <strong>{scenario.title}</strong>
                <small>{scenario.description}</small>
              </span>
            </button>
          ))}
        </fieldset>
        {props.saveSlots.length > 0 && (
          <div class="start-save-list">
            <div class="eyebrow">Saved Towers</div>
            {props.saveSlots.slice(0, 4).map((slot) => (
              <button
                type="button"
                classList={{ active: props.selectedSaveSlot === slot.slotId }}
                onClick={() => props.onSelectSaveSlot(slot.slotId)}
              >
                <strong>{props.slotLabel(slot.slotId)}</strong>
                <span>{props.formatSlotSummary(slot)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
