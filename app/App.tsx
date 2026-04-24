import { AgentDebugOverlay } from '@app/components/AgentDebugOverlay';
import { FirstRunExplainer } from '@app/components/FirstRunExplainer';
import { GameCanvas } from '@app/components/GameCanvas';
import { StartScreen } from '@app/components/StartScreen';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { SkyAudioEngine } from '@/audio';
import { createDiagnosticsBundle, diagnosticsFilename } from '@/diagnostics/diagnosticsBundle';
import {
  getPreferenceJson,
  installCapacitorPreferences,
  PREF_KEYS,
  setPreferenceJson,
} from '@/persistence/preferences';
import {
  type CorruptSaveRecord,
  DEFAULT_SAVE_SLOT,
  deleteCorruptSave,
  deleteSnapshot,
  listCorruptSaves,
  listSaveSlots,
  listSimulationEvents,
  loadSnapshot,
  recordSimulationEvent,
  recordSimulationEvents,
  type SaveSlotSummary,
  type SimulationEventContext,
  type SimulationEventRecord,
  saveSnapshot,
  selectDurableSimulationEvents,
} from '@/persistence/saveRepository';
import { resolveNativeBackAction } from '@/platform/nativeBack';
import {
  isScenarioId,
  PRODUCTION_BUDGETS,
  PRODUCTION_RELEASE,
  SCENARIO_CARDS,
  type ScenarioId,
} from '@/simulation/content';
import { createContractObjectiveAction } from '@/simulation/contractActions';
import { createBuildPreview } from '@/simulation/placement';
import {
  createPublicStoryActionSummary,
  dominantPublicPressureReason,
  publicStoryImpact,
  publicStoryTone,
} from '@/simulation/publicStory';
import {
  createOpeningContractSnapshot,
  createRecoveryDrillSnapshot,
  createSkylineCharterSnapshot,
  createWeatherStressSnapshot,
} from '@/simulation/scenario';
import { formatHour, getHour } from '@/simulation/time';
import {
  BUILDINGS,
  type BuildingId,
  type ContractObjective,
  type LensMode,
  type SimulationSnapshot,
  TICK_RATE,
} from '@/simulation/types';
import { planVisitorHosting, type VisitorHostingPlan } from '@/simulation/visitorPlanning';
import {
  describeVisitorBehavior,
  evaluateCohortFriction,
  VISITOR_ARCHETYPES,
  type VisitorBehaviorProfile,
} from '@/simulation/visitors';
import {
  clearInspection,
  commitBuild,
  createSnapshot,
  declareTowerIdentity,
  forecastPublicVisitInvite,
  hydrateSnapshot,
  inspectGridCell,
  inspectPublicStoryFocus,
  invitePublicVisit,
  resetGame,
  selectTool,
  setAccessibilitySettings,
  setAudioSettings,
  setCamera,
  setLensMode,
  setSpeed,
  setTutorialStep,
  setUiSettings,
  startGame,
  summarizeActivePublicVisits,
  tickWorld,
} from '@/state/actions';
import { useTrait } from '@/state/solid';
import {
  BuildDragTrait,
  CampaignTrait,
  ClockTrait,
  EconomyTrait,
  InspectionTrait,
  MacroTrait,
  OperationsTrait,
  PhaseTrait,
  SettingsTrait,
  TowerTrait,
  ViewTrait,
} from '@/state/traits';
import { gameWorld } from '@/state/world';

const TOOL_ORDER: BuildingId[] = [
  'floor',
  'lobby',
  'elevator',
  'office',
  'condo',
  'cafe',
  'hotel',
  'maint',
  'utilities',
  'restroom',
  'security',
  'mechanical',
  'conference',
  'eventHall',
  'retail',
  'skyGarden',
  'observation',
  'clinic',
  'gallery',
  'luxurySuite',
  'weatherCore',
];

const TOOL_VECTOR_PREVIEWS: Partial<Record<BuildingId, string>> = {
  floor: 'assets/vectors/rooms/floor.svg',
  lobby: 'assets/vectors/rooms/lobby.svg',
  elevator: 'assets/vectors/cores/elevator-car.svg',
  office: 'assets/vectors/rooms/office-lit.svg',
  condo: 'assets/vectors/rooms/condo-day.svg',
  cafe: 'assets/vectors/rooms/cafe.svg',
  hotel: 'assets/vectors/rooms/hotel-day.svg',
  maint: 'assets/vectors/rooms/maintenance.svg',
  utilities: 'assets/vectors/elements/utility-pipes.svg',
  restroom: 'assets/vectors/elements/restroom-fixtures.svg',
  security: 'assets/vectors/elements/security-desk.svg',
  mechanical: 'assets/vectors/elements/utility-pipes.svg',
  conference: 'assets/vectors/elements/conference-table.svg',
  eventHall: 'assets/vectors/elements/event-stage.svg',
  retail: 'assets/vectors/elements/retail-shelves.svg',
  skyGarden: 'assets/vectors/elements/garden-canopy.svg',
  observation: 'assets/vectors/elements/observation-scope.svg',
  clinic: 'assets/vectors/elements/clinic-cross.svg',
  gallery: 'assets/vectors/elements/gallery-frame.svg',
  luxurySuite: 'assets/vectors/elements/luxury-sofa.svg',
  weatherCore: 'assets/vectors/elements/weather-array.svg',
};

function assetUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

function requireValue<T>(value: T | undefined, name: string): T {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

interface CameraPreference {
  panX: number;
  panY: number;
  zoom: number;
}

interface StoredPreferences {
  camera: unknown;
  lensMode: unknown;
  tutorialStep: unknown;
  proceduralVolume: unknown;
  sampleVolume: unknown;
  muted: unknown;
  highContrast: unknown;
  reducedMotion: unknown;
  displayScale: unknown;
  inputHints: unknown;
  diagnosticsVisible: unknown;
  safeAreaMode: unknown;
}

const LENS_MODES = new Set<LensMode>([
  'normal',
  'maintenance',
  'transit',
  'value',
  'sentiment',
  'privacy',
  'safety',
  'event',
]);

const IDENTITY_OPTIONS = [
  ['business', 'Business Hub'],
  ['residential', 'Vertical Village'],
  ['hospitality', 'Event Destination'],
  ['civic', 'Civic Tower'],
  ['luxury', 'Prestige Tower'],
  ['mixed-use', 'Mixed Ecosystem'],
] as const;

const SAVE_SLOT_OPTIONS = [
  { id: DEFAULT_SAVE_SLOT, label: 'Autosave', description: 'Quick continue' },
  { id: 'campaign-a', label: 'Campaign A', description: 'Primary run' },
  { id: 'campaign-b', label: 'Campaign B', description: 'Alternate build' },
  { id: 'sandbox', label: 'Sandbox', description: 'Post-victory city cycle' },
] as const;

function formatPlatformLabel(target: string): string {
  if (target === 'ios') return 'iOS';
  return target.charAt(0).toUpperCase() + target.slice(1);
}

const PRODUCTION_PLATFORM_LABEL = PRODUCTION_RELEASE.targets.map(formatPlatformLabel).join(' + ');

const AUTOSAVE_EVENTS = new Set([
  'build',
  'identity-declared',
  'daily-report',
  'visit-inquiry',
  'visit-arrival',
  'visit-spend',
  'visit-canceled',
  'visit-success',
  'visit-failure',
  'visit-neutral',
  'visit-departure',
  'contract-complete',
  'contract-failed',
  'milestone',
  'victory',
]);

function isCameraPreference(value: unknown): value is CameraPreference {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CameraPreference>;
  return (
    typeof candidate.panX === 'number' &&
    typeof candidate.panY === 'number' &&
    typeof candidate.zoom === 'number'
  );
}

function isLensMode(value: unknown): value is LensMode {
  return typeof value === 'string' && LENS_MODES.has(value as LensMode);
}

function isTutorialStep(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isUnitNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isDisplayScale(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0.85 && value <= 1.25;
}

function isSafeAreaMode(value: unknown): value is 'auto' | 'compact' {
  return value === 'auto' || value === 'compact';
}

function createScenarioSnapshot(scenario: ScenarioId): SimulationSnapshot {
  if (scenario === 'skyline') return createSkylineCharterSnapshot();
  if (scenario === 'weather') return createWeatherStressSnapshot();
  if (scenario === 'recovery') return createRecoveryDrillSnapshot();
  return createOpeningContractSnapshot();
}

function scenarioCamera(
  scenario: ScenarioId,
): Pick<SimulationSnapshot['view'], 'panX' | 'panY' | 'zoom'> {
  if (scenario === 'skyline' || scenario === 'weather') {
    return window.innerWidth < 760
      ? { panX: -120, panY: 176, zoom: 0.48 }
      : { panX: 0, panY: 252, zoom: 0.98 };
  }
  return window.innerWidth < 760
    ? { panX: -84, panY: 118, zoom: 0.82 }
    : { panX: 0, panY: 164, zoom: 1.85 };
}

function slotLabel(slotId: string): string {
  return SAVE_SLOT_OPTIONS.find((slot) => slot.id === slotId)?.label ?? slotId;
}

function formatSaveDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatMoney(value: number): string {
  const magnitude = Math.abs(Math.round(value)).toLocaleString();
  return value < 0 ? `-$${magnitude}` : `$${magnitude}`;
}

// Compact currency for the top-HUD funds cell, where the column is narrow
// (minmax(70px, 1fr)) and full $4,533,000 clips to "$4,533..." — unreadable.
// $4.5M reads at a glance and fits. Keeps sign handling for negatives.
function formatMoneyCompact(value: number): string {
  const abs = Math.abs(Math.round(value));
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(0)}k`;
  return `${sign}$${abs.toLocaleString()}`;
}

// Color-grade a 0-100 percentage metric for the top HUD. Goodness direction:
// 'up' means high is good (trust, sentiment — green high, red low), 'down'
// means high is bad (transit pressure — red high, green low). Returns a
// class name that the HUD CSS maps to the gold/cyan/red color tokens.
function metricTone(value: number, direction: 'up' | 'down'): string {
  const high = direction === 'up' ? value >= 70 : value <= 40;
  const low = direction === 'up' ? value < 40 : value > 70;
  if (high) return 'tone-good';
  if (low) return 'tone-bad';
  return 'tone-mid';
}

// Turn kebab-case / single-word enum values into title-case display labels
// for player-facing surfaces. 'mixed-use' → 'Mixed Use', 'steady' → 'Steady'.
// Journey / city-brief grids used to lean on text-transform: uppercase to
// mask the lowercase enums; removing that transform meant every value needed
// to travel through a humanizer at render time instead.
/**
 * Decide whether to go through with a destructive UI action (Reset,
 * Delete save, etc).
 *
 *   - If automated (webdriver), always proceed — verifiers must not deadlock.
 *   - Otherwise prompt with confirmFn and honor the answer.
 *
 * Exported so tests can cover all three branches (automated, confirmed,
 * cancelled) without instantiating the whole App component.
 */
export function shouldRunDestructive(options: {
  automated: boolean;
  confirmFn: (message: string) => boolean;
  message: string;
}): boolean {
  if (options.automated) return true;
  return options.confirmFn(options.message);
}

function humanizeEnum(value: string): string {
  return value
    .split(/[-_\s]+/)
    .map((word) => (word.length === 0 ? word : word[0].toUpperCase() + word.slice(1)))
    .join(' ');
}

function formatSlotSummary(summary: SaveSlotSummary | undefined): string {
  if (!summary) return 'Empty';
  const identity = summary.declaredIdentity ?? summary.identity;
  const phase = summary.victory === 'won' ? 'City cycle' : 'Building';
  return `${phase} · Day ${summary.day} · ${humanizeEnum(identity)}`;
}

function formatEventType(eventType: string): string {
  return humanizeEnum(eventType);
}

function formatEventContext(data: unknown): string {
  if (!data || typeof data !== 'object') return 'No context';
  const context = data as Partial<SimulationEventContext>;
  const parts = [
    typeof context.source === 'string' ? humanizeEnum(context.source) : null,
    typeof context.day === 'number' ? `Day ${context.day}` : null,
    typeof context.hour === 'number' ? `${context.hour.toString().padStart(2, '0')}:00` : null,
    typeof context.funds === 'number' ? formatMoney(context.funds) : null,
  ].filter(Boolean);
  return parts.join(' · ') || 'No context';
}

function formatPressureReason(reason: string): string {
  return humanizeEnum(reason);
}

function summarizePressureReasons(reasons: readonly string[]): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const reason of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function pressureReasonsOrClear(reasons: readonly string[]): string[] {
  return reasons.length > 0 ? [...reasons] : ['clear'];
}

function BehaviorProfile(props: { behavior: VisitorBehaviorProfile | null; label?: string }) {
  return (
    <Show when={props.behavior}>
      {(behavior) => (
        <div class="visit-personality">
          <span>{props.label ?? 'Personality'}</span>
          <strong>{humanizeEnum(behavior().temperament)}</strong>
          <p>{behavior().summary}</p>
          <div class="personality-chips">
            <span>Values: {behavior().values.join(', ')}</span>
            <span>Dealbreakers: {behavior().dealbreakers.join(', ')}</span>
          </div>
        </div>
      )}
    </Show>
  );
}

function HostingPlan(props: { plan: VisitorHostingPlan | null }) {
  return (
    <Show when={props.plan}>
      {(plan) => (
        <div class="visit-hosting-plan">
          <span>Hosting plan</span>
          <strong>{plan().primary.label}</strong>
          <p>{plan().summary}</p>
          <div class="hosting-priorities">
            {plan()
              .priorities.slice(0, 3)
              .map((priority) => (
                <span class={`hosting-priority ${priority.urgency}`}>
                  {priority.label} · {priority.score}
                </span>
              ))}
          </div>
        </div>
      )}
    </Show>
  );
}

function createSimulationEventContext(
  snapshot: SimulationSnapshot,
  source: string,
  extra: Partial<SimulationEventContext> = {},
): SimulationEventContext {
  return {
    source,
    day: snapshot.clock.day,
    tick: snapshot.clock.tick,
    hour: getHour(snapshot.clock.tick),
    funds: snapshot.economy.funds,
    population: snapshot.economy.population,
    act: snapshot.campaign.act,
    mode: snapshot.campaign.mode,
    victory: snapshot.campaign.victory,
    identity: snapshot.campaign.towerIdentity,
    declaredIdentity: snapshot.campaign.declaredIdentity,
    roomCount: snapshot.tower.rooms.length,
    activeContracts: snapshot.campaign.activeContracts.map((contract) => contract.id),
    successfulVisits: snapshot.campaign.successfulVisits,
    failedVisits: snapshot.campaign.failedVisits,
    ...extra,
  };
}

export function App() {
  const phase = useTrait(gameWorld, PhaseTrait);
  const tower = useTrait(gameWorld, TowerTrait);
  const economy = useTrait(gameWorld, EconomyTrait);
  const campaign = useTrait(gameWorld, CampaignTrait);
  const macro = useTrait(gameWorld, MacroTrait);
  const operations = useTrait(gameWorld, OperationsTrait);
  const clock = useTrait(gameWorld, ClockTrait);
  const view = useTrait(gameWorld, ViewTrait);
  const settings = useTrait(gameWorld, SettingsTrait);
  const drag = useTrait(gameWorld, BuildDragTrait);
  const inspection = useTrait(gameWorld, InspectionTrait);
  const [preferencesReady, setPreferencesReady] = createSignal(false);
  const [contractsOpen, setContractsOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [startNotice, setStartNotice] = createSignal<string | null>(null);
  const [saveNotice, setSaveNotice] = createSignal<string | null>(null);
  const [visitNotice, setVisitNotice] = createSignal<string | null>(null);
  const [selectedSaveSlot, setSelectedSaveSlot] = createSignal<string>(DEFAULT_SAVE_SLOT);
  const [saveSlots, setSaveSlots] = createSignal<SaveSlotSummary[]>([]);
  const [corruptSaves, setCorruptSaves] = createSignal<CorruptSaveRecord[]>([]);
  const [recentEvents, setRecentEvents] = createSignal<SimulationEventRecord[]>([]);
  const [expandedObjectiveKey, setExpandedObjectiveKey] = createSignal<string | null>(null);
  let audio: SkyAudioEngine | null = null;
  let persistenceQueue: Promise<unknown> = Promise.resolve();
  let nativeBackButtonHandle: PluginListenerHandle | null = null;
  let nativeBackButtonDisposed = false;

  const phaseState = createMemo(() => requireValue(phase(), 'phase'));
  const towerState = createMemo(() => requireValue(tower(), 'tower'));
  const economyState = createMemo(() => requireValue(economy(), 'economy'));
  const campaignState = createMemo(() => requireValue(campaign(), 'campaign'));
  const macroState = createMemo(() => requireValue(macro(), 'macro'));
  const operationsState = createMemo(() => requireValue(operations(), 'operations'));
  const clockState = createMemo(() => requireValue(clock(), 'clock'));
  const viewState = createMemo(() => requireValue(view(), 'view'));
  const settingsState = createMemo(() => requireValue(settings(), 'settings'));
  const dragState = createMemo(() => requireValue(drag(), 'drag'));
  const inspectionState = createMemo(() => requireValue(inspection(), 'inspection'));
  const selectedBuilding = createMemo(() => {
    const toolId = viewState().selectedTool;
    return toolId ? BUILDINGS[toolId] : null;
  });
  const latestReport = createMemo(() => campaignState().reports[0] ?? null);
  const publicMemories = createMemo(() => towerState().visitMemories.slice(0, 4));
  const primaryContract = createMemo(
    () =>
      campaignState().activeContracts.find((contract) => contract.kind === 'campaign') ??
      campaignState().activeContracts[0] ??
      null,
  );
  const selectedSlotSummary = createMemo(() =>
    saveSlots().find((slot) => slot.slotId === selectedSaveSlot()),
  );

  const preview = createMemo(() =>
    createBuildPreview(towerState(), economyState(), viewState().selectedTool, dragState().drag),
  );
  const visitDocket = createMemo(() =>
    towerState().visits.map((visit) => {
      const context = {
        eventReadiness: operationsState().eventReadiness,
        noiseControl: operationsState().noiseControl,
        privacyComfort: operationsState().privacyComfort,
        safetyReadiness: operationsState().safetyReadiness,
        weatherRisk: macroState().weatherRisk,
      };
      const friction = evaluateCohortFriction(visit, economyState(), context);
      return {
        ...visit,
        friction,
        target: visit.targetRoomId
          ? towerState().rooms.find((room) => room.id === visit.targetRoomId)
          : null,
        behavior: describeVisitorBehavior(visit),
        hostingPlan: planVisitorHosting(visit, economyState(), context, friction),
      };
    }),
  );
  const visitForecast = createMemo(() => {
    towerState();
    economyState();
    campaignState();
    macroState();
    operationsState();
    clockState();
    return forecastPublicVisitInvite();
  });
  const activeVisitReadiness = createMemo(() => {
    towerState();
    economyState();
    macroState();
    operationsState();
    return summarizeActivePublicVisits();
  });
  const publicPressure = createMemo(() =>
    summarizePressureReasons([
      ...visitDocket().flatMap((visit) => visit.friction.reasons),
      ...publicMemories().flatMap((memory) => memory.pressureReasons),
    ]).slice(0, 5),
  );
  const latestPublicStory = createMemo(() => {
    const memory = publicMemories()[0];
    if (!memory) return null;
    const dominantReason = dominantPublicPressureReason(memory.pressureReasons);
    const repairContract = dominantReason
      ? (campaignState().activeContracts.find(
          (contract) => contract.source === `memory-${dominantReason}`,
        ) ?? null)
      : null;
    return {
      memory,
      dominantReason,
      repairContract,
      tone: publicStoryTone(memory.outcome),
      impact: publicStoryImpact(memory.outcome),
      action: createPublicStoryActionSummary(
        memory,
        towerState(),
        economyState(),
        macroState(),
        operationsState(),
      ),
    };
  });
  const publicStoryInspectionContext = createMemo(() => {
    const context = inspectionState().selection?.context;
    return context?.source === 'public-story' ? context : null;
  });
  const ContractObjectiveAction = (props: { contractId: string; objective: ContractObjective }) => {
    const key = createMemo(
      () =>
        `${props.contractId}:${props.objective.id}:${props.objective.metric}:${
          props.objective.roomType ?? ''
        }`,
    );
    const expanded = createMemo(() => expandedObjectiveKey() === key());
    const action = createMemo(() =>
      createContractObjectiveAction(
        props.objective,
        towerState(),
        economyState(),
        macroState(),
        operationsState(),
      ),
    );
    const openLens = () => {
      setLensMode(action().lensMode);
      setContractsOpen(false);
    };
    const inspectFocus = () => {
      const focusCell = action().focusCell;
      if (!focusCell) return;
      setLensMode(action().lensMode);
      inspectGridCell(focusCell);
      setContractsOpen(false);
    };
    const selectBuildTool = () => {
      const toolId = action().toolId;
      if (!toolId) return;
      setLensMode('normal');
      selectTool(null);
      selectTool(toolId);
      setContractsOpen(false);
    };
    return (
      <article class="contract-objective-action" classList={{ open: expanded() }}>
        <button
          type="button"
          class="contract-objective-toggle"
          aria-expanded={expanded()}
          onClick={() => setExpandedObjectiveKey(expanded() ? null : key())}
        >
          {expanded() ? 'Hide Diagnostic' : 'Diagnose Objective'}
        </button>
        {expanded() && (
          <>
            <span>Objective diagnostic</span>
            <strong>{action().headline}</strong>
            <p>{action().diagnostic}</p>
            <small>{action().recommendation}</small>
            <div class="contract-objective-buttons">
              <button type="button" onClick={openLens}>
                Open {action().lensLabel} Lens
              </button>
              {action().toolId && (
                <button type="button" onClick={selectBuildTool}>
                  Build {action().toolLabel}
                </button>
              )}
              {action().focusCell && (
                <button type="button" onClick={inspectFocus}>
                  Inspect Focus
                </button>
              )}
            </div>
          </>
        )}
      </article>
    );
  };

  const ContractObjectiveItem = (props: { contractId: string; objective: ContractObjective }) => {
    const progressTone = () => {
      if (props.objective.complete) return 'tone-good';
      const pct =
        props.objective.target > 0 ? (props.objective.value / props.objective.target) * 100 : 0;
      if (pct >= 60) return 'tone-mid';
      return undefined;
    };
    return (
      <li classList={{ complete: props.objective.complete }}>
        <div class="contract-objective-line">
          <span>{props.objective.label}</span>
          <small class={progressTone()}>
            {props.objective.value}/{props.objective.target}
          </small>
        </div>
        {!props.objective.complete && (
          <ContractObjectiveAction contractId={props.contractId} objective={props.objective} />
        )}
      </li>
    );
  };

  const refreshSaveSlots = async () => {
    try {
      setSaveSlots(await listSaveSlots());
    } catch {
      setSaveSlots([]);
    }
  };

  const refreshCorruptSaves = async () => {
    try {
      setCorruptSaves(await listCorruptSaves());
    } catch {
      setCorruptSaves([]);
    }
  };

  const refreshSimulationHistory = async () => {
    try {
      setRecentEvents(await listSimulationEvents(8));
    } catch {
      setRecentEvents([]);
    }
  };

  const readStoredPreferences = async (): Promise<StoredPreferences> => {
    const [
      camera,
      lensMode,
      tutorialStep,
      proceduralVolume,
      sampleVolume,
      muted,
      highContrast,
      reducedMotion,
      displayScale,
      inputHints,
      diagnosticsVisible,
      safeAreaMode,
    ] = await Promise.all([
      getPreferenceJson<unknown>(PREF_KEYS.camera, null),
      getPreferenceJson<unknown>(PREF_KEYS.lensMode, 'normal'),
      getPreferenceJson<unknown>(PREF_KEYS.tutorialStep, 0),
      getPreferenceJson<unknown>(
        PREF_KEYS.proceduralVolume,
        settingsState().audio.proceduralVolume,
      ),
      getPreferenceJson<unknown>(PREF_KEYS.sampleVolume, settingsState().audio.sampleVolume),
      getPreferenceJson<unknown>(PREF_KEYS.muted, settingsState().audio.muted),
      getPreferenceJson<unknown>(
        PREF_KEYS.highContrast,
        settingsState().accessibility.highContrast,
      ),
      getPreferenceJson<unknown>(
        PREF_KEYS.reducedMotion,
        settingsState().accessibility.reducedMotion,
      ),
      getPreferenceJson<unknown>(PREF_KEYS.displayScale, settingsState().ui.displayScale),
      getPreferenceJson<unknown>(PREF_KEYS.inputHints, settingsState().ui.inputHints),
      getPreferenceJson<unknown>(
        PREF_KEYS.diagnosticsVisible,
        settingsState().ui.diagnosticsVisible,
      ),
      getPreferenceJson<unknown>(PREF_KEYS.safeAreaMode, settingsState().ui.safeAreaMode),
    ]);

    return {
      camera,
      lensMode,
      tutorialStep,
      proceduralVolume,
      sampleVolume,
      muted,
      highContrast,
      reducedMotion,
      displayScale,
      inputHints,
      diagnosticsVisible,
      safeAreaMode,
    };
  };

  const applyStoredPreferenceValues = ({
    camera,
    lensMode,
    tutorialStep,
    proceduralVolume,
    sampleVolume,
    muted,
    highContrast,
    reducedMotion,
    displayScale,
    inputHints,
    diagnosticsVisible,
    safeAreaMode,
  }: StoredPreferences) => {
    if (isCameraPreference(camera)) setCamera(camera.panX, camera.panY, camera.zoom);
    if (isLensMode(lensMode)) setLensMode(lensMode);
    if (isTutorialStep(tutorialStep)) setTutorialStep(Math.floor(tutorialStep));
    if (isUnitNumber(proceduralVolume)) setAudioSettings({ proceduralVolume });
    if (isUnitNumber(sampleVolume)) setAudioSettings({ sampleVolume });
    if (isBoolean(muted)) setAudioSettings({ muted });
    if (isBoolean(highContrast)) setAccessibilitySettings({ highContrast });
    if (isBoolean(reducedMotion)) setAccessibilitySettings({ reducedMotion });
    if (isDisplayScale(displayScale)) setUiSettings({ displayScale });
    if (isBoolean(inputHints)) setUiSettings({ inputHints });
    if (isBoolean(diagnosticsVisible)) setUiSettings({ diagnosticsVisible });
    if (isSafeAreaMode(safeAreaMode)) setUiSettings({ safeAreaMode });
  };

  const applyStoredPreferences = async () => {
    applyStoredPreferenceValues(await readStoredPreferences());
  };

  const queuePersistence = (work: () => Promise<void>) => {
    persistenceQueue = persistenceQueue
      .catch(() => undefined)
      .then(work)
      .catch(() => undefined);
  };

  const queueAutosave = (
    reason: string,
    extra: Partial<SimulationEventContext> & { events?: readonly string[] } = {},
  ) => {
    const snapshot = createSnapshot();
    const context = createSimulationEventContext(snapshot, 'autosave', {
      slotId: DEFAULT_SAVE_SLOT,
      ...extra,
    });
    queuePersistence(async () => {
      await saveSnapshot(snapshot, DEFAULT_SAVE_SLOT);
      await recordSimulationEvent('autosave', {
        ...context,
        reason,
        events: extra.events ?? [reason],
      });
      await refreshSaveSlots();
      if (settingsOpen()) {
        await refreshCorruptSaves();
        await refreshSimulationHistory();
      }
    });
  };

  const queueAutosaveForEvents = (events: readonly string[]) => {
    const autosaveEvents = events.filter((event) => AUTOSAVE_EVENTS.has(event));
    if (autosaveEvents.length === 0) return;
    queueAutosave(autosaveEvents.at(-1) ?? 'event', { events: autosaveEvents });
  };

  const queueSimulationHistory = (
    events: readonly string[],
    source: string,
    extra: Partial<SimulationEventContext> = {},
  ) => {
    const durableEvents = selectDurableSimulationEvents(events);
    if (durableEvents.length === 0) return;
    const context = createSimulationEventContext(createSnapshot(), source, extra);
    queuePersistence(async () => {
      await recordSimulationEvents(durableEvents, context);
      if (settingsOpen()) await refreshSimulationHistory();
    });
  };

  const installNativeBackButton = async () => {
    if (Capacitor.getPlatform() === 'web' || nativeBackButtonDisposed) return;
    try {
      const { App: CapacitorApp } = await import('@capacitor/app');
      const handle = await CapacitorApp.addListener('backButton', (event) => {
        switch (
          resolveNativeBackAction({
            settingsOpen: settingsOpen(),
            contractsOpen: contractsOpen(),
            playing: phaseState().phase === 'playing',
            canGoBack: event.canGoBack,
          })
        ) {
          case 'close-settings':
            setSettingsOpen(false);
            return;
          case 'close-contracts':
            setContractsOpen(false);
            return;
          case 'pause-to-settings':
            setSpeed(0);
            setSettingsOpen(true);
            setSaveNotice('Paused from Android back. Save, load, or close Settings to continue.');
            return;
          case 'browser-back':
            window.history.back();
            return;
          case 'minimize-app':
            void CapacitorApp.minimizeApp();
            return;
        }
      });
      if (nativeBackButtonDisposed) {
        void handle.remove();
        return;
      }
      nativeBackButtonHandle = handle;
    } catch {
      nativeBackButtonHandle = null;
    }
  };

  onMount(() => {
    void (async () => {
      await installCapacitorPreferences().catch(() => undefined);
      const scenario = new URLSearchParams(window.location.search).get('scenario');
      if (isScenarioId(scenario)) {
        const snapshot = createScenarioSnapshot(scenario);
        snapshot.view = { ...snapshot.view, ...scenarioCamera(scenario) };
        hydrateSnapshot(snapshot);
        setPreferencesReady(true);
        void refreshSaveSlots();
        void refreshCorruptSaves();
        return;
      }
      await applyStoredPreferences();
      setPreferencesReady(true);
      void refreshSaveSlots();
      void refreshCorruptSaves();
    })();

    audio = new SkyAudioEngine(settingsState().audio);
    void installNativeBackButton();
    const interval = window.setInterval(() => {
      if (phaseState().phase !== 'playing') return;
      const events = tickWorld();
      queueSimulationHistory(events, 'tick');
      queueAutosaveForEvents(events);
      if (events.includes('rent')) audio?.play('rent');
      if (events.includes('rent-leak')) audio?.play('warning');
      if (events.includes('cafe-sale')) audio?.play('elevator');
      if (events.includes('hotel-checkout')) audio?.play('build');
      if (events.includes('milestone')) audio?.play('milestone');
      if (events.includes('visit-arrival')) audio?.play('visit-arrival');
      if (events.includes('visit-departure')) audio?.play('visit-departure');
      if (events.includes('visit-spend')) audio?.play('rent');
      if (events.includes('visit-canceled')) audio?.play('warning');
      if (events.includes('contract-complete')) audio?.play('contract-complete');
      if (events.includes('contract-failed')) audio?.play('warning');
      if (events.includes('victory')) audio?.play('milestone');

      // Contextual ambient score tracks tower state every tick. Cheap — the
      // engine smooths the gain/detune ramps internally and no-ops pre-unlock.
      audio?.updateAmbient({
        transitPressure: economyState().transitPressure,
        agentCount: towerState().agents.length,
        publicTrust: macroState().publicTrust,
      });
    }, TICK_RATE);
    onCleanup(() => {
      nativeBackButtonDisposed = true;
      window.clearInterval(interval);
      void nativeBackButtonHandle?.remove();
    });
  });

  createEffect(() => {
    audio?.applySettings(settingsState().audio);
  });

  createEffect(() => {
    if (!preferencesReady()) return;
    const currentView = viewState();
    void setPreferenceJson(PREF_KEYS.lensMode, currentView.lensMode);
    void setPreferenceJson(PREF_KEYS.tutorialStep, currentView.tutorialStep);
    void setPreferenceJson(PREF_KEYS.camera, {
      panX: currentView.panX,
      panY: currentView.panY,
      zoom: currentView.zoom,
    });
    const currentSettings = settingsState();
    void setPreferenceJson(PREF_KEYS.proceduralVolume, currentSettings.audio.proceduralVolume);
    void setPreferenceJson(PREF_KEYS.sampleVolume, currentSettings.audio.sampleVolume);
    void setPreferenceJson(PREF_KEYS.muted, currentSettings.audio.muted);
    void setPreferenceJson(PREF_KEYS.highContrast, currentSettings.accessibility.highContrast);
    void setPreferenceJson(PREF_KEYS.reducedMotion, currentSettings.accessibility.reducedMotion);
    void setPreferenceJson(PREF_KEYS.displayScale, currentSettings.ui.displayScale);
    void setPreferenceJson(PREF_KEYS.inputHints, currentSettings.ui.inputHints);
    void setPreferenceJson(PREF_KEYS.diagnosticsVisible, currentSettings.ui.diagnosticsVisible);
    void setPreferenceJson(PREF_KEYS.safeAreaMode, currentSettings.ui.safeAreaMode);
  });

  createEffect(() => {
    if (!settingsOpen()) return;
    void refreshSaveSlots();
    void refreshCorruptSaves();
    void refreshSimulationHistory();
  });

  const handleStart = async () => {
    setStartNotice(null);
    setSaveNotice(null);
    const storedPreferences = preferencesReady() ? await readStoredPreferences() : null;
    startGame();
    if (storedPreferences) applyStoredPreferenceValues(storedPreferences);
    await audio?.unlock();
    audio?.play('milestone');
  };

  const handleContinue = async () => {
    setStartNotice(null);
    setSaveNotice(null);
    const slotId = selectedSlotSummary()?.slotId ?? saveSlots()[0]?.slotId ?? DEFAULT_SAVE_SLOT;
    const snapshot = await loadSnapshot(slotId);
    if (!snapshot) {
      setStartNotice('No saved tower was found. Break ground or open a city moment.');
      return;
    }
    setSelectedSaveSlot(slotId);
    hydrateSnapshot(snapshot);
    await audio?.unlock();
    audio?.play('milestone');
  };

  const handleScenario = async (scenario: ScenarioId) => {
    setStartNotice(null);
    setSaveNotice(null);
    const snapshot = createScenarioSnapshot(scenario);
    snapshot.view = { ...snapshot.view, ...scenarioCamera(scenario) };
    hydrateSnapshot(snapshot);
    await audio?.unlock();
    audio?.play(scenario === 'weather' || scenario === 'recovery' ? 'warning' : 'milestone');
  };

  const handleBuildCommitted = () => {
    const tool = viewState().selectedTool;
    const ok = commitBuild();
    if (ok) {
      audio?.play('build');
      queueSimulationHistory(['build'], 'build', { tool });
      queueAutosave('build', { tool });
    }
  };

  const handleInviteVisit = () => {
    const result = invitePublicVisit();
    setVisitNotice(result.message);
    if (!result.ok) {
      audio?.play('warning');
      return;
    }
    audio?.play('milestone');
    queueSimulationHistory(result.events, 'invite-public-visit');
    queueAutosaveForEvents(result.events);
  };

  const handleSave = async () => {
    const snapshot = createSnapshot();
    const slotId = selectedSaveSlot();
    await saveSnapshot(snapshot, slotId);
    await recordSimulationEvent('manual-save', {
      slotId,
      day: snapshot.clock.day,
      tick: snapshot.clock.tick,
    });
    await refreshSaveSlots();
    await refreshCorruptSaves();
    if (settingsOpen()) await refreshSimulationHistory();
    setSaveNotice(`${slotLabel(slotId)} saved on day ${snapshot.clock.day}.`);
  };

  const handleLoad = async (slotId = selectedSaveSlot()) => {
    const snapshot = await loadSnapshot(slotId);
    if (!snapshot) {
      await refreshCorruptSaves();
      setSaveNotice(`${slotLabel(slotId)} is empty or was quarantined after recovery.`);
      return;
    }
    setSelectedSaveSlot(slotId);
    hydrateSnapshot(snapshot);
    setSaveNotice(`${slotLabel(slotId)} loaded.`);
  };

  const handleDeleteSave = async () => {
    const slotId = selectedSaveSlot();
    if (!selectedSlotSummary()) {
      setSaveNotice(`${slotLabel(slotId)} is already empty.`);
      return;
    }
    const automated = typeof navigator !== 'undefined' && navigator.webdriver === true;
    const confirmFn = typeof window !== 'undefined' ? window.confirm.bind(window) : () => true;
    if (
      !shouldRunDestructive({
        automated,
        confirmFn,
        message: `Delete the ${slotLabel(slotId)} save? This permanently removes that tower snapshot.`,
      })
    ) {
      return;
    }
    await deleteSnapshot(slotId);
    await refreshSaveSlots();
    setSaveNotice(`${slotLabel(slotId)} deleted.`);
  };

  const handleDeleteCorruptSave = async (slotId: string) => {
    await deleteCorruptSave(slotId);
    await refreshCorruptSaves();
    setSaveNotice(`${slotLabel(slotId)} recovery backup deleted.`);
  };

  const handleExportDiagnostics = () => {
    const bundle = createDiagnosticsBundle({
      snapshot: createSnapshot(),
      saveSlots: saveSlots(),
      corruptSaves: corruptSaves(),
      recentEvents: recentEvents(),
      rendererStats: window.reachForTheSkyRenderer?.getStats?.() ?? null,
      preferencesReady: preferencesReady(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = diagnosticsFilename(bundle);
    link.click();
    URL.revokeObjectURL(href);
    setSaveNotice(`Diagnostics exported for v${bundle.release.version}.`);
  };

  return (
    <main
      class="app-shell"
      style={{ '--ui-scale': settingsState().ui.displayScale.toString() }}
      classList={{
        'high-contrast': settingsState().accessibility.highContrast,
        'reduced-motion': settingsState().accessibility.reducedMotion,
        'hide-input-hints': !settingsState().ui.inputHints,
        'safe-area-compact': settingsState().ui.safeAreaMode === 'compact',
      }}
    >
      <GameCanvas onBuildCommitted={handleBuildCommitted} />
      <AgentDebugOverlay tower={towerState} />
      <Show when={phaseState().phase === 'playing'}>
        <FirstRunExplainer />
      </Show>
      <section class="top-hud" aria-label="Game HUD and controls">
        <div class="top-clock">
          <button
            type="button"
            class="side-button"
            classList={{ active: contractsOpen() }}
            aria-expanded={contractsOpen()}
            aria-label={contractsOpen() ? 'Close contracts drawer' : 'Open contracts drawer'}
            onClick={() => {
              const nextOpen = !contractsOpen();
              setContractsOpen(nextOpen);
              if (nextOpen) audio?.play('drawer-open');
            }}
            title="Contracts: active goals, visits, and identity declaration"
          >
            <span>Contracts</span>
            <small>Goals & visits</small>
          </button>
          <div class="time-stack">
            <div class="eyebrow">Day {clockState().day}</div>
            <div class="timecode">{formatHour(clockState().tick)}</div>
          </div>
          <div class="speed-row">
            <button
              type="button"
              classList={{ active: clockState().speed === 0 }}
              onClick={() => setSpeed(0)}
              title="Pause simulation"
              aria-label="Pause simulation"
              aria-pressed={clockState().speed === 0}
            >
              Pause
            </button>
            <button
              type="button"
              classList={{ active: clockState().speed === 1 }}
              onClick={() => setSpeed(1)}
              title="Run simulation at normal speed"
              aria-label="Play at normal speed"
              aria-pressed={clockState().speed === 1}
            >
              Play
            </button>
            <button
              type="button"
              classList={{ active: clockState().speed === 4 }}
              onClick={() => setSpeed(4)}
              title="Run simulation at 4x speed"
              aria-label="Fast forward at 4x speed"
              aria-pressed={clockState().speed === 4}
            >
              Fast
            </button>
          </div>
        </div>
        <div class="top-metrics">
          <article>
            <span>Funds</span>
            <strong
              class={
                economyState().funds < 0
                  ? 'tone-bad'
                  : economyState().netRevenue < 0
                    ? 'tone-mid'
                    : 'tone-good'
              }
            >
              {formatMoneyCompact(economyState().funds)}
            </strong>
          </article>
          <article>
            <span>Pop</span>
            <strong>{economyState().population}</strong>
          </article>
          <article>
            <span>Trust</span>
            <strong class={metricTone(macroState().publicTrust, 'up')}>
              {macroState().publicTrust}%
            </strong>
          </article>
          <article>
            <span>Sentiment</span>
            <strong class={metricTone(economyState().tenantSatisfaction, 'up')}>
              {economyState().tenantSatisfaction}%
            </strong>
          </article>
          <article>
            <span>Transit</span>
            <strong class={metricTone(economyState().transitPressure, 'down')}>
              {economyState().transitPressure}%
            </strong>
          </article>
          <article>
            <span>Visits</span>
            <strong>{towerState().visits.length}</strong>
          </article>
          <article class="phase-article">
            <span>Phase</span>
            <strong>
              {campaignState().victory === 'won'
                ? 'City cycle'
                : (campaignState().actTitle ?? 'Unfolding')}
            </strong>
          </article>
        </div>
        <div class="top-actions">
          <button
            type="button"
            class="side-button settings-button"
            aria-label={settingsOpen() ? 'Close settings' : 'Open settings'}
            aria-expanded={settingsOpen()}
            onClick={() => {
              const nextOpen = !settingsOpen();
              setSettingsOpen(nextOpen);
              if (nextOpen) audio?.play('drawer-open');
            }}
            title="Settings: audio, display, accessibility, and saves"
          >
            <span>Settings</span>
            <small>Audio & saves</small>
          </button>
        </div>
      </section>

      {/* Mobile-only speed row. Rendered OUTSIDE .top-hud because .top-hud
          has zoom: var(--ui-scale) which creates a containing block for
          fixed-positioned descendants in Chrome — position:fixed inside
          would anchor to the top-hud, not the viewport. Placed at the app
          root so position:fixed with bottom:X reaches the viewport edge.
          Desktop hides this via a base display:none rule. */}
      {phaseState().phase === 'playing' && (
        <div class="mobile-speed-row">
          <button
            type="button"
            classList={{ active: clockState().speed === 0 }}
            onClick={() => setSpeed(0)}
            title="Pause simulation"
            aria-label="Pause simulation"
            aria-pressed={clockState().speed === 0}
          >
            Pause
          </button>
          <button
            type="button"
            classList={{ active: clockState().speed === 1 }}
            onClick={() => setSpeed(1)}
            title="Run simulation at normal speed"
            aria-label="Play at normal speed"
            aria-pressed={clockState().speed === 1}
          >
            Play
          </button>
          <button
            type="button"
            classList={{ active: clockState().speed === 4 }}
            onClick={() => setSpeed(4)}
            title="Run simulation at 4x speed"
            aria-label="Fast forward at 4x speed"
            aria-pressed={clockState().speed === 4}
          >
            Fast
          </button>
        </div>
      )}

      <button
        type="button"
        class="drawer-scrim"
        classList={{ open: settingsOpen() || contractsOpen() }}
        aria-label="Close side menu"
        onClick={() => {
          setSettingsOpen(false);
          setContractsOpen(false);
        }}
      />
      <aside
        class="contracts-drawer"
        classList={{ open: contractsOpen() }}
        aria-label="Contracts drawer"
        aria-hidden={!contractsOpen()}
      >
        <div class="drawer-head">
          <div>
            <div class="eyebrow">Briefing</div>
            <h2>Contracts</h2>
          </div>
          <button type="button" onClick={() => setContractsOpen(false)}>
            Close
          </button>
        </div>
        {phaseState().phase === 'playing' && (
          <>
            <section class="drawer-section">
              <div class="eyebrow">City brief</div>
              <div class="city-brief-grid">
                <span>District</span>
                <strong>{humanizeEnum(macroState().districtIdentity)}</strong>
                <span>Market</span>
                <strong>{humanizeEnum(macroState().marketCycle)}</strong>
                <span>Fame</span>
                <strong class={metricTone(macroState().fame, 'up')}>{macroState().fame}%</strong>
                <span>Skyline</span>
                <strong class={metricTone(macroState().skylineStatus, 'up')}>
                  {macroState().skylineStatus}%
                </strong>
                <span>Regulation</span>
                <strong class={metricTone(macroState().regulationPressure, 'down')}>
                  {macroState().regulationPressure}%
                </strong>
                <span>Weather</span>
                <strong class={metricTone(macroState().weatherRisk, 'down')}>
                  {macroState().weatherRisk}%
                </strong>
              </div>
            </section>
            {campaignState().victory === 'won' && (
              <section class="drawer-section victory-card">
                <div class="eyebrow">Victory State</div>
                <h3>Skyline Charter Secured</h3>
                <p>
                  The tower is now a recognized institution. Sandbox city pressure remains active
                  through events, inspections, contracts, and reports.
                </p>
              </section>
            )}
            <section class="drawer-section public-pressure-card">
              <div class="eyebrow">Public pressure</div>
              <div class="public-pressure-grid">
                <span>Active visits</span>
                <strong>{towerState().visits.length}</strong>
                <span>Known memories</span>
                <strong>{towerState().visitMemories.length}</strong>
                <span>Current mandate</span>
                <strong>
                  {primaryContract()?.source === 'sandbox' ? 'City cycle' : 'Campaign'}
                </strong>
              </div>
              <div class="pressure-tags public-pressure-reasons">
                {publicPressure().length > 0 ? (
                  publicPressure().map(([reason, count]) => (
                    <span class={`pressure-tag ${reason}`}>
                      {formatPressureReason(reason)}
                      <small>{count}</small>
                    </span>
                  ))
                ) : (
                  <span class="pressure-tag clear">No active pressure reasons</span>
                )}
              </div>
            </section>
            {latestPublicStory() && (
              <section
                class={`drawer-section public-story-card ${latestPublicStory()?.memory.outcome}`}
              >
                <div class="eyebrow">Latest public story</div>
                <div class="public-story-head">
                  <div>
                    <span>{humanizeEnum(latestPublicStory()?.tone ?? '')}</span>
                    <strong>{latestPublicStory()?.memory.label}</strong>
                  </div>
                  <small>Day {latestPublicStory()?.memory.resolvedDay}</small>
                </div>
                <p>{latestPublicStory()?.memory.impressions[0]}</p>
                <div class="public-story-grid">
                  <span>Impact</span>
                  <strong>{humanizeEnum(latestPublicStory()?.impact ?? '')}</strong>
                  <span>Sentiment</span>
                  <strong class={metricTone(latestPublicStory()?.memory.sentiment ?? 0, 'up')}>
                    {latestPublicStory()?.memory.sentiment}%
                  </strong>
                  <span>Dominant pressure</span>
                  <strong>
                    {latestPublicStory()?.dominantReason
                      ? formatPressureReason(latestPublicStory()?.dominantReason ?? '')
                      : 'Clear'}
                  </strong>
                </div>
                <article class="public-story-action">
                  <span>Bottleneck</span>
                  <strong>{latestPublicStory()?.action.headline}</strong>
                  <div class="public-story-action-grid">
                    <span>{latestPublicStory()?.action.metricLabel}</span>
                    <strong>{latestPublicStory()?.action.metricValue}</strong>
                    <span>Focus</span>
                    <strong>{latestPublicStory()?.action.focusLabel}</strong>
                  </div>
                  <p>{latestPublicStory()?.action.diagnostic}</p>
                  <small>{latestPublicStory()?.action.recommendation}</small>
                  <div class="public-story-actions">
                    <button
                      type="button"
                      onClick={() => {
                        const action = latestPublicStory()?.action;
                        if (!action) return;
                        setLensMode(action.lensMode);
                        setContractsOpen(false);
                      }}
                    >
                      Open {latestPublicStory()?.action.lensLabel} Lens
                    </button>
                    {latestPublicStory()?.action.focusCell && (
                      <button
                        type="button"
                        onClick={() => {
                          const action = latestPublicStory()?.action;
                          if (!action?.focusCell) return;
                          setLensMode(action.lensMode);
                          inspectPublicStoryFocus(action.focusCell, {
                            memoryLabel: latestPublicStory()?.memory.label ?? 'Public story',
                            pressureReason: action.dominantReason,
                            headline: action.headline,
                            metricLabel: action.metricLabel,
                            metricValue: action.metricValue,
                            diagnostic: action.diagnostic,
                            recommendation: action.recommendation,
                          });
                          setContractsOpen(false);
                        }}
                      >
                        Inspect Focus
                      </button>
                    )}
                  </div>
                </article>
                <div class="pressure-tags compact">
                  {pressureReasonsOrClear(latestPublicStory()?.memory.pressureReasons ?? []).map(
                    (reason) => (
                      <span class={`pressure-tag ${reason}`}>{formatPressureReason(reason)}</span>
                    ),
                  )}
                </div>
                {latestPublicStory()?.repairContract ? (
                  <article class="public-story-repair">
                    <span>Repair objective</span>
                    <strong>{latestPublicStory()?.repairContract?.title}</strong>
                    <small>
                      Score {latestPublicStory()?.repairContract?.score} ·{' '}
                      {latestPublicStory()?.repairContract?.objectives.length} objectives · Due day{' '}
                      {latestPublicStory()?.repairContract?.deadlineDay}
                    </small>
                  </article>
                ) : (
                  <small class="public-story-repair-note">
                    No repair objective is active. Keep the next public visit cleaner than this one.
                  </small>
                )}
              </section>
            )}
            <section class="drawer-section journey-section">
              <div class="eyebrow">Journey</div>
              <div class="journey-grid">
                <span>Mode</span>
                <strong>{campaignState().mode === 'campaign' ? 'Campaign' : 'Sandbox'}</strong>
                <span>Reputation</span>
                <strong class={metricTone(campaignState().reputation, 'up')}>
                  {campaignState().reputation}%
                </strong>
                <span>Influence</span>
                <strong class={metricTone(macroState().cityInfluence, 'up')}>
                  {macroState().cityInfluence}%
                </strong>
                <span>Visits won</span>
                <strong class="tone-good">{campaignState().successfulVisits}</strong>
                <span>Visits lost</span>
                <strong classList={{ 'tone-bad': campaignState().failedVisits > 0 }}>
                  {campaignState().failedVisits}
                </strong>
                <span>Focus</span>
                <strong>
                  {(() => {
                    const declared = campaignState().declaredIdentity;
                    if (!declared) return 'Undeclared';
                    return IDENTITY_OPTIONS.find(([id]) => id === declared)?.[1] ?? declared;
                  })()}
                </strong>
              </div>
              <div class="identity-choice">
                <div class="eyebrow">Declare Identity</div>
                <div class="identity-buttons">
                  {IDENTITY_OPTIONS.map(([identity, label]) => (
                    <button
                      type="button"
                      classList={{ active: campaignState().declaredIdentity === identity }}
                      disabled={campaignState().act < 3 && campaignState().victory !== 'won'}
                      onClick={() => {
                        if (declareTowerIdentity(identity)) {
                          audio?.play('milestone');
                          queueSimulationHistory(['identity-declared'], 'identity', {
                            declaredIdentity: identity,
                          });
                          queueAutosave('identity-declared', { declaredIdentity: identity });
                        }
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div class="tag-stack">
                {campaignState().permits.map((permit) => (
                  <span>{humanizeEnum(permit)}</span>
                ))}
              </div>
              <div class="tag-stack muted">
                {campaignState().unlockedSystems.map((system) => (
                  <span>{humanizeEnum(system)}</span>
                ))}
              </div>
            </section>
            <section class="drawer-section">
              <div class="eyebrow">Current phase</div>
              <h3>{campaignState().actTitle}</h3>
              {primaryContract() ? (
                <article class="contract-card campaign-contract">
                  <div class="contract-card-head">
                    <strong>{primaryContract()?.title}</strong>
                    <span class={`contract-pressure ${primaryContract()?.pressure ?? 'low'}`}>
                      Score {primaryContract()?.score ?? 0} ·{' '}
                      {primaryContract()?.deadlineDay
                        ? `Due day ${primaryContract()?.deadlineDay}`
                        : 'Open mandate'}
                    </span>
                  </div>
                  <p>{primaryContract()?.brief}</p>
                  <small class="contract-reward">
                    Reward ${primaryContract()?.rewardFunds.toLocaleString() ?? '0'}
                    {(primaryContract()?.rewardTrust ?? 0) > 0
                      ? ` · Trust +${primaryContract()?.rewardTrust}`
                      : ''}
                    {(primaryContract()?.penaltyTrust ?? 0) > 0
                      ? ` · Failure -${primaryContract()?.penaltyTrust} trust`
                      : ''}
                  </small>
                  <ul class="contract-list">
                    {primaryContract()?.objectives.map((objective) => (
                      <ContractObjectiveItem
                        contractId={primaryContract()?.id ?? 'primary'}
                        objective={objective}
                      />
                    ))}
                  </ul>
                </article>
              ) : (
                <p class="empty-docket">No campaign contract is active.</p>
              )}
              {campaignState()
                .activeContracts.filter((contract) => contract.kind !== 'campaign')
                .map((contract) => (
                  <article class={`contract-card ${contract.kind}`}>
                    <div class="contract-card-head">
                      <strong>{contract.title}</strong>
                      <span class={`contract-pressure ${contract.pressure}`}>
                        Score {contract.score} · Due day {contract.deadlineDay}
                      </span>
                    </div>
                    <p>{contract.brief}</p>
                    <small class="contract-reward">
                      Reward ${contract.rewardFunds.toLocaleString()}
                      {contract.rewardTrust > 0 ? ` · Trust +${contract.rewardTrust}` : ''}
                      {contract.penaltyTrust > 0
                        ? ` · Failure -${contract.penaltyTrust} trust`
                        : ''}
                    </small>
                    <ul class="contract-list compact">
                      {contract.objectives.map((objective) => (
                        <ContractObjectiveItem contractId={contract.id} objective={objective} />
                      ))}
                    </ul>
                  </article>
                ))}
            </section>
            <section class="drawer-section contract-history">
              <div class="eyebrow">History</div>
              <div class="history-counts">
                <span classList={{ 'tone-good': campaignState().completedContracts.length > 0 }}>
                  {campaignState().completedContracts.length} completed
                </span>
                <span classList={{ 'tone-bad': campaignState().failedContracts.length > 0 }}>
                  {campaignState().failedContracts.length} failed
                </span>
              </div>
              {campaignState()
                .completedContracts.slice(0, 4)
                .map((contract) => (
                  <article class="history-row completed">
                    <strong>{contract.title}</strong>
                    <span>
                      Day {contract.completedDay ?? contract.createdDay} · Score {contract.score}
                    </span>
                  </article>
                ))}
              {campaignState()
                .failedContracts.slice(0, 2)
                .map((contract) => (
                  <article class="history-row failed">
                    <strong>{contract.title}</strong>
                    <span>
                      Day {contract.failedDay ?? contract.createdDay} · Score {contract.score}
                    </span>
                  </article>
                ))}
            </section>
            <section class="drawer-section">
              <div class="eyebrow">Operations</div>
              <div class="operations-grid">
                <span>Grade</span>
                <strong class={metricTone(operationsState().operationalGrade, 'up')}>
                  {operationsState().operationalGrade}%
                </strong>
                <span>Service</span>
                <strong class={metricTone(operationsState().serviceCoverage, 'up')}>
                  {operationsState().serviceCoverage}%
                </strong>
                <span>Venue</span>
                <strong class={metricTone(operationsState().venueCredibility, 'up')}>
                  {operationsState().venueCredibility}%
                </strong>
                <span>Safety</span>
                <strong class={metricTone(operationsState().safetyReadiness, 'up')}>
                  {operationsState().safetyReadiness}%
                </strong>
                <span>Events</span>
                <strong class={metricTone(operationsState().eventReadiness, 'up')}>
                  {operationsState().eventReadiness}%
                </strong>
                <span>Privacy</span>
                <strong class={metricTone(operationsState().privacyComfort, 'up')}>
                  {operationsState().privacyComfort}%
                </strong>
                <span>Noise</span>
                <strong class={metricTone(operationsState().noiseControl, 'up')}>
                  {operationsState().noiseControl}%
                </strong>
                <span>Height Risk</span>
                <strong class={metricTone(operationsState().heightRisk, 'down')}>
                  {operationsState().heightRisk}%
                </strong>
              </div>
              {latestReport() && (
                <article class="daily-report-card">
                  <strong>{latestReport()?.title}</strong>
                  <span class="report-headline">
                    Trust{' '}
                    <span class={metricTone(latestReport()?.publicTrust ?? 0, 'up')}>
                      {latestReport()?.publicTrust}%
                    </span>{' '}
                    · Fame{' '}
                    <span class={metricTone(latestReport()?.fame ?? 0, 'up')}>
                      {latestReport()?.fame}%
                    </span>{' '}
                    · Rep{' '}
                    <span
                      class={
                        (latestReport()?.reputationDelta ?? 0) > 0
                          ? 'tone-good'
                          : (latestReport()?.reputationDelta ?? 0) < 0
                            ? 'tone-bad'
                            : 'tone-mid'
                      }
                    >
                      {(latestReport()?.reputationDelta ?? 0) >= 0 ? '+' : ''}
                      {latestReport()?.reputationDelta}
                    </span>
                  </span>
                  <div class="report-metrics">
                    <span>Revenue {formatMoney(latestReport()?.revenue ?? 0)}</span>
                    <span>Costs {formatMoney(latestReport()?.costs ?? 0)}</span>
                    <span>
                      Net{' '}
                      <span
                        class={
                          (latestReport()?.netRevenue ?? 0) > 0
                            ? 'tone-good'
                            : (latestReport()?.netRevenue ?? 0) < 0
                              ? 'tone-bad'
                              : 'tone-mid'
                        }
                      >
                        {formatMoney(latestReport()?.netRevenue ?? 0)}
                      </span>
                    </span>
                    <span>
                      Queues{' '}
                      <span class={metricTone(latestReport()?.queuePressure ?? 0, 'down')}>
                        {latestReport()?.queuePressure}%
                      </span>
                    </span>
                    <span>
                      Dirt{' '}
                      <span class={metricTone(latestReport()?.dirtBurden ?? 0, 'down')}>
                        {latestReport()?.dirtBurden}%
                      </span>
                    </span>
                  </div>
                  <ul>
                    {latestReport()?.notes.map((note) => (
                      <li>{note}</li>
                    ))}
                  </ul>
                  <div class="report-risks">
                    <span>Next risks</span>
                    <ul>
                      {latestReport()?.nextRisks.map((risk) => (
                        <li>{risk}</li>
                      ))}
                    </ul>
                  </div>
                </article>
              )}
            </section>
            <section class="drawer-section">
              <div class="eyebrow">Visit docket</div>
              {activeVisitReadiness().length > 0 && (
                <div class="active-visit-list">
                  {activeVisitReadiness().map((visit) => (
                    <article class={`active-visit-card ${visit.mood}`}>
                      <div class="visit-forecast-header">
                        <span>Active commitment</span>
                        <strong>{visit.label}</strong>
                      </div>
                      <p>{visit.message}</p>
                      <div class="visit-forecast-metrics">
                        <span>Phase</span>
                        <strong>{visit.phaseLabel}</strong>
                        <span>Venue</span>
                        <strong>{visit.targetRoomName}</strong>
                        <span>Representatives</span>
                        <strong>
                          {visit.spawnedAgents}/{visit.representativeCount}
                        </strong>
                        <span>Risk</span>
                        <strong>
                          {visit.frictionScore} · {humanizeEnum(visit.mood)}
                        </strong>
                      </div>
                      <div class="pressure-tags compact">
                        {pressureReasonsOrClear(visit.pressureReasons).map((reason) => (
                          <span class={`pressure-tag ${reason}`}>
                            {formatPressureReason(reason)}
                          </span>
                        ))}
                      </div>
                      <BehaviorProfile behavior={visit.behavior} />
                      <HostingPlan plan={visit.hostingPlan} />
                      <div class="forecast-fixes">
                        <span>Protect now</span>
                        <ul>
                          {visit.recommendations.map((recommendation) => (
                            <li>{recommendation}</li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  ))}
                </div>
              )}
              <article class={`visit-forecast-card ${visitForecast().mood ?? 'blocked'}`}>
                <div class="visit-forecast-header">
                  <span>
                    {activeVisitReadiness().length > 0
                      ? 'Next invite forecast'
                      : 'Hosting forecast'}
                  </span>
                  <strong>
                    {visitForecast().canInvite ? visitForecast().label : 'No viable invite'}
                  </strong>
                </div>
                <p>{visitForecast().message}</p>
                <div class="visit-forecast-metrics">
                  <span>Group</span>
                  <strong>{visitForecast().size > 0 ? visitForecast().size : 'n/a'}</strong>
                  <span>Venue</span>
                  <strong>{visitForecast().targetRoomName ?? 'Needed'}</strong>
                  <span>Arrival</span>
                  <strong>
                    Day {visitForecast().arrivalDay} ·{' '}
                    {visitForecast().arrivalHour.toString().padStart(2, '0')}:00
                  </strong>
                  <span>Friction</span>
                  <strong>{visitForecast().frictionScore}</strong>
                </div>
                <div class="pressure-tags compact">
                  {pressureReasonsOrClear(visitForecast().pressureReasons).map((reason) => (
                    <span class={`pressure-tag ${reason}`}>{formatPressureReason(reason)}</span>
                  ))}
                </div>
                <BehaviorProfile behavior={visitForecast().behavior} />
                <HostingPlan plan={visitForecast().hostingPlan} />
                <div class="forecast-fixes">
                  <span>Fix first</span>
                  <ul>
                    {visitForecast().recommendations.map((recommendation) => (
                      <li>{recommendation}</li>
                    ))}
                  </ul>
                </div>
              </article>
              <div class="visit-action-row">
                <button
                  type="button"
                  disabled={!visitForecast().canInvite}
                  onClick={handleInviteVisit}
                >
                  Invite Public Visit
                </button>
                <span>
                  Invite commits this slot. The group will still judge queues, privacy, safety,
                  service, and mood through the live simulation.
                </span>
              </div>
              {visitNotice() && <p class="visit-notice">{visitNotice()}</p>}
              {visitDocket().length > 0 ? (
                <div class="visit-list">
                  {visitDocket().map((visit) => (
                    <article class={`visit-card ${visit.friction.mood}`}>
                      <div>
                        <strong>{visit.label}</strong>
                        <span>
                          {visit.size} people · {humanizeEnum(visit.status)} ·{' '}
                          {visit.target ? BUILDINGS[visit.target.type].name : 'Unassigned'}
                        </span>
                      </div>
                      <small>
                        {humanizeEnum(visit.friction.mood)} outlook · Pressure reasons
                        {visit.friction.reasons.length > 0
                          ? `: ${visit.friction.reasons.map(formatPressureReason).join(', ')}`
                          : ': no current friction'}
                      </small>
                      <div class="pressure-tags compact">
                        {pressureReasonsOrClear(visit.friction.reasons).map((reason) => (
                          <span class={`pressure-tag ${reason}`}>
                            {formatPressureReason(reason)}
                          </span>
                        ))}
                      </div>
                      <BehaviorProfile behavior={visit.behavior} label="Cohort profile" />
                      <HostingPlan plan={visit.hostingPlan} />
                    </article>
                  ))}
                </div>
              ) : (
                <p class="empty-docket">
                  No current visit inquiries. Credible venues and smooth operations attract them.
                </p>
              )}
            </section>
            <section class="drawer-section">
              <div class="eyebrow">Public memory</div>
              {publicMemories().length > 0 ? (
                <div class="memory-list">
                  {publicMemories().map((memory) => (
                    <article class={`memory-card ${memory.outcome}`}>
                      <div>
                        <strong>{memory.label}</strong>
                        <span>
                          {humanizeEnum(memory.outcome)} · sentiment{' '}
                          <span class={metricTone(memory.sentiment, 'up')}>
                            {memory.sentiment}%
                          </span>{' '}
                          · day {memory.resolvedDay}
                        </span>
                      </div>
                      <small>{memory.impressions[0]}</small>
                      <div class="pressure-tags compact">
                        {pressureReasonsOrClear(memory.pressureReasons).map((reason) => (
                          <span class={`pressure-tag ${reason}`}>
                            {formatPressureReason(reason)}
                          </span>
                        ))}
                      </div>
                      <BehaviorProfile
                        behavior={describeVisitorBehavior(VISITOR_ARCHETYPES[memory.archetypeId])}
                        label="Remembered profile"
                      />
                    </article>
                  ))}
                </div>
              ) : (
                <p class="empty-docket">
                  Public visits have not yet left durable memories. Host groups cleanly to build a
                  public story.
                </p>
              )}
            </section>
          </>
        )}
      </aside>
      <aside
        class="settings-drawer"
        classList={{ open: settingsOpen() }}
        aria-label="Settings drawer"
        aria-hidden={!settingsOpen()}
      >
        <div class="drawer-head">
          <div>
            <div class="eyebrow">Your tower</div>
            <h2>Settings</h2>
          </div>
          <button type="button" onClick={() => setSettingsOpen(false)}>
            Close
          </button>
        </div>
        <section class="save-slot-panel">
          <div class="settings-title">Save Slots</div>
          <div class="save-slot-list">
            {SAVE_SLOT_OPTIONS.map((slot) => {
              const summary = saveSlots().find((candidate) => candidate.slotId === slot.id);
              return (
                <button
                  type="button"
                  data-save-slot={slot.id}
                  classList={{ active: selectedSaveSlot() === slot.id }}
                  onClick={() => setSelectedSaveSlot(slot.id)}
                >
                  <strong>{slot.label}</strong>
                  <span>{formatSlotSummary(summary)}</span>
                  <small>
                    {summary
                      ? `${formatSaveDate(summary.savedAt)} · $${summary.funds.toLocaleString()}`
                      : slot.description}
                  </small>
                </button>
              );
            })}
          </div>
          <div class="save-row">
            <button type="button" onClick={() => void handleSave()}>
              Save
            </button>
            <button type="button" onClick={() => void handleLoad()}>
              Load
            </button>
            <button
              type="button"
              disabled={!selectedSlotSummary()}
              onClick={() => void handleDeleteSave()}
            >
              Delete
            </button>
          </div>
          {saveNotice() && (
            <p class="save-notice" role="status" aria-live="polite">
              {saveNotice()}
            </p>
          )}
        </section>
        <div class="drawer-metrics">
          <span>{economyState().activeAgents} active agents</span>
          <span>
            {formatMoney(economyState().netRevenue)} net daily ·{' '}
            {formatMoney(economyState().dailyRevenue)} revenue
          </span>
          <span>{economyState().cleanliness}% clean</span>
        </div>
        <Show when={settingsState().ui.diagnosticsVisible}>
          <section class="diagnostics-panel">
            <div class="settings-title">Diagnostics</div>
            <div class="diagnostics-release">
              <strong>v{PRODUCTION_RELEASE.version}</strong>
              <span>
                {PRODUCTION_RELEASE.contentVersion} · save v{PRODUCTION_RELEASE.saveSchemaVersion} ·{' '}
                {PRODUCTION_BUDGETS.maxSavedEvents} event cap
              </span>
            </div>
            <div class="save-row">
              <button type="button" onClick={handleExportDiagnostics}>
                Export Debug Bundle
              </button>
            </div>
            {corruptSaves().length > 0 && (
              <div class="corrupt-save-list">
                <strong>Corrupt save recovery</strong>
                {corruptSaves().map((save) => (
                  <article>
                    <div>
                      <span>{slotLabel(save.slotId)}</span>
                      <small>
                        {save.error} · recovered {formatSaveDate(save.detectedAt)}
                      </small>
                    </div>
                    <button type="button" onClick={() => void handleDeleteCorruptSave(save.slotId)}>
                      Forget
                    </button>
                  </article>
                ))}
              </div>
            )}
            {recentEvents().length > 0 ? (
              <div class="event-history-list">
                {recentEvents().map((event) => (
                  <article>
                    <div>
                      <strong>{formatEventType(event.eventType)}</strong>
                      <span>{formatEventContext(event.data)}</span>
                    </div>
                    <small>{formatSaveDate(event.createdAt)}</small>
                  </article>
                ))}
              </div>
            ) : (
              <p class="save-notice">
                No durable event rows yet. Build, save, collect rent, or host visits to populate
                SQLite history.
              </p>
            )}
          </section>
        </Show>
        <div class="settings-stack">
          <div class="settings-title">Signal</div>
          <label>
            Procedural
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settingsState().audio.proceduralVolume}
              onInput={(event) =>
                setAudioSettings({ proceduralVolume: Number(event.currentTarget.value) })
              }
            />
          </label>
          <label>
            Samples
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settingsState().audio.sampleVolume}
              onInput={(event) =>
                setAudioSettings({ sampleVolume: Number(event.currentTarget.value) })
              }
            />
          </label>
          <div class="settings-toggles">
            <button
              type="button"
              classList={{ active: settingsState().audio.muted }}
              onClick={() => setAudioSettings({ muted: !settingsState().audio.muted })}
            >
              Mute
            </button>
            <button
              type="button"
              classList={{ active: settingsState().accessibility.highContrast }}
              onClick={() =>
                setAccessibilitySettings({
                  highContrast: !settingsState().accessibility.highContrast,
                })
              }
            >
              Contrast
            </button>
            <button
              type="button"
              classList={{ active: settingsState().accessibility.reducedMotion }}
              onClick={() =>
                setAccessibilitySettings({
                  reducedMotion: !settingsState().accessibility.reducedMotion,
                })
              }
            >
              Motion
            </button>
          </div>
        </div>
        <div class="settings-stack">
          <div class="settings-title">Interface</div>
          <label>
            Scale
            <input
              type="range"
              min="0.85"
              max="1.25"
              step="0.05"
              value={settingsState().ui.displayScale}
              onInput={(event) =>
                setUiSettings({ displayScale: Number(event.currentTarget.value) })
              }
            />
          </label>
          <div class="settings-toggles">
            <button
              type="button"
              classList={{ active: settingsState().ui.inputHints }}
              onClick={() => setUiSettings({ inputHints: !settingsState().ui.inputHints })}
            >
              Hints
            </button>
            <button
              type="button"
              classList={{ active: settingsState().ui.diagnosticsVisible }}
              onClick={() =>
                setUiSettings({ diagnosticsVisible: !settingsState().ui.diagnosticsVisible })
              }
            >
              Diagnostics
            </button>
            <button
              type="button"
              classList={{ active: settingsState().ui.safeAreaMode === 'compact' }}
              onClick={() =>
                setUiSettings({
                  safeAreaMode: settingsState().ui.safeAreaMode === 'compact' ? 'auto' : 'compact',
                })
              }
            >
              Compact
            </button>
          </div>
        </div>
      </aside>

      {phaseState().phase === 'menu' && (
        <StartScreen
          assetUrl={assetUrl}
          formatSlotSummary={formatSlotSummary}
          onContinue={handleContinue}
          onScenario={handleScenario}
          onSelectSaveSlot={setSelectedSaveSlot}
          onStart={handleStart}
          platformLabel={PRODUCTION_PLATFORM_LABEL}
          saveSlots={saveSlots()}
          scenarios={SCENARIO_CARDS}
          selectedSaveSlot={selectedSaveSlot()}
          slotLabel={slotLabel}
          startNotice={startNotice()}
        />
      )}

      {phaseState().phase === 'playing' && (
        <>
          {/* Tutorial card guides the first 5 build steps, then dismisses the
              moment the player presses Play or a new day starts. Leaving it
              up after step 4 (the "5. Run the Day" hint) creates a persistent
              floating callout in the middle of gameplay — clutter, not help. */}
          {clockState().day === 1 && clockState().speed === 0 && (
            <section class="tutorial-card">
              <strong>{tutorialTitle(viewState().tutorialStep)}</strong>
              <span>{tutorialText(viewState().tutorialStep)}</span>
            </section>
          )}
          <section class="lens-panel" aria-label="Diagnostic lenses">
            <button
              type="button"
              classList={{ active: viewState().lensMode === 'normal' }}
              aria-pressed={viewState().lensMode === 'normal'}
              onClick={() => setLensMode('normal')}
            >
              Normal
            </button>
            <button
              type="button"
              classList={{ active: viewState().lensMode === 'maintenance' }}
              aria-pressed={viewState().lensMode === 'maintenance'}
              onClick={() => setLensMode('maintenance')}
            >
              Maintenance
            </button>
            <button
              type="button"
              classList={{ active: viewState().lensMode === 'transit' }}
              aria-pressed={viewState().lensMode === 'transit'}
              onClick={() => setLensMode('transit')}
            >
              Transit
            </button>
            <button
              type="button"
              classList={{ active: viewState().lensMode === 'value' }}
              aria-pressed={viewState().lensMode === 'value'}
              onClick={() => setLensMode('value')}
            >
              Value
            </button>
            <button
              type="button"
              classList={{ active: viewState().lensMode === 'sentiment' }}
              aria-pressed={viewState().lensMode === 'sentiment'}
              onClick={() => setLensMode('sentiment')}
            >
              Sentiment
            </button>
            <button
              type="button"
              classList={{ active: viewState().lensMode === 'privacy' }}
              aria-pressed={viewState().lensMode === 'privacy'}
              onClick={() => setLensMode('privacy')}
            >
              Privacy
            </button>
            <button
              type="button"
              classList={{ active: viewState().lensMode === 'safety' }}
              aria-pressed={viewState().lensMode === 'safety'}
              onClick={() => setLensMode('safety')}
            >
              Safety
            </button>
            <button
              type="button"
              classList={{ active: viewState().lensMode === 'event' }}
              aria-pressed={viewState().lensMode === 'event'}
              onClick={() => setLensMode('event')}
            >
              Events
            </button>
          </section>
          <section class="toolbar" aria-label="Build tools">
            {TOOL_ORDER.map((toolId) => {
              const tool = BUILDINGS[toolId];
              return (
                <button
                  type="button"
                  class="tool-button"
                  classList={{ active: viewState().selectedTool === toolId }}
                  aria-pressed={viewState().selectedTool === toolId}
                  onClick={() => selectTool(toolId)}
                  title={`${tool.name}: $${tool.cost.toLocaleString()}`}
                >
                  {TOOL_VECTOR_PREVIEWS[toolId] ? (
                    <img
                      class="tool-icon"
                      src={assetUrl(TOOL_VECTOR_PREVIEWS[toolId])}
                      alt=""
                      draggable={false}
                    />
                  ) : (
                    <span class="swatch" style={{ 'background-color': tool.color }} />
                  )}
                  <span>{tool.name}</span>
                  <small>${tool.cost.toLocaleString()}</small>
                </button>
              );
            })}
          </section>
          <section class="build-readout">
            <strong>{selectedBuilding()?.name ?? 'Select a tool'}</strong>
            <span>
              {selectedBuilding()
                ? (preview().error ?? formatMoney(preview().cost))
                : 'Pick from the palette to start placing'}
            </span>
            <small>
              Transit{' '}
              <span class={metricTone(economyState().transitPressure, 'down')}>
                {economyState().transitPressure}%
              </span>{' '}
              · Service{' '}
              <span class={metricTone(economyState().servicePressure, 'down')}>
                {economyState().servicePressure}%
              </span>
              {' · '}
              Sentiment{' '}
              <span class={metricTone(economyState().tenantSatisfaction, 'up')}>
                {economyState().tenantSatisfaction}%
              </span>{' '}
              · Ops{' '}
              <span class={metricTone(operationsState().operationalGrade, 'up')}>
                {operationsState().operationalGrade}%
              </span>
            </small>
          </section>
        </>
      )}

      {inspectionState().selection && (
        <section class={`inspection-card ${inspectionState().selection?.kind}`}>
          <button type="button" aria-label="Close inspection" onClick={() => clearInspection()}>
            Close
          </button>
          <div class="eyebrow">Inspection</div>
          <h3>{inspectionState().selection?.title}</h3>
          <strong>{inspectionState().selection?.subtitle}</strong>
          {publicStoryInspectionContext() && (
            <article class="inspection-context-card">
              <span>Public story focus</span>
              <strong>{publicStoryInspectionContext()?.memoryLabel}</strong>
              <div class="inspection-context-grid">
                <span>Pressure</span>
                <strong>
                  {publicStoryInspectionContext()?.pressureReason
                    ? formatPressureReason(publicStoryInspectionContext()?.pressureReason ?? '')
                    : 'Broad sentiment'}
                </strong>
                <span>{publicStoryInspectionContext()?.metricLabel}</span>
                <strong>{publicStoryInspectionContext()?.metricValue}</strong>
              </div>
              <p>{publicStoryInspectionContext()?.diagnostic}</p>
              <small>{publicStoryInspectionContext()?.recommendation}</small>
            </article>
          )}
          <ul>
            {inspectionState().selection?.details.map((detail) => (
              <li>{detail}</li>
            ))}
          </ul>
          {(inspectionState().selection?.warnings.length ?? 0) > 0 && (
            <div class="inspection-warnings">
              {inspectionState().selection?.warnings.map((warning) => (
                <span>{warning}</span>
              ))}
            </div>
          )}
        </section>
      )}

      <section
        class="notifications"
        aria-label="Live notifications"
        aria-live="polite"
        aria-atomic="false"
      >
        {towerState().notifications.map((notice) => (
          <article class={`notice ${notice.type}`}>{notice.text}</article>
        ))}
      </section>

      <button
        type="button"
        class="reset-button"
        aria-label="Reset tower and return to start screen"
        onClick={() => {
          const automated = typeof navigator !== 'undefined' && navigator.webdriver === true;
          const confirmFn =
            typeof window !== 'undefined' ? window.confirm.bind(window) : () => true;
          if (
            !shouldRunDestructive({
              automated,
              confirmFn,
              message:
                'Reset the tower? This clears the current session and returns you to the start screen.',
            })
          ) {
            return;
          }
          resetGame();
        }}
      >
        Reset
      </button>
    </main>
  );
}

function tutorialTitle(step: number): string {
  const titles = [
    '1. Grand Entrance',
    '2. Vertical Expansion',
    '3. Attract Tenants',
    '4. Connect Transit',
    '5. Run the Day',
  ] as const;
  return titles[Math.min(step, titles.length - 1)] ?? titles[0];
}

function tutorialText(step: number): string {
  const steps = [
    'Select Lobby and drag along the glowing ground line.',
    'Select Floor and drag above the lobby to lay rentable space.',
    'Select Office and drag across complete floors.',
    'Select Elevator and drag vertically through floors and lobby.',
    'Press Play and watch the morning rush expose bottlenecks.',
  ] as const;
  return steps[Math.min(step, steps.length - 1)] ?? steps[0];
}
