import type { World } from 'koota';
import { advanceGameSpine } from '@/simulation/campaign';
import {
  createInitialCampaign,
  createInitialClock,
  createInitialEconomy,
  createInitialInspection,
  createInitialMacro,
  createInitialOperations,
  createInitialTower,
  createInitialView,
} from '@/simulation/initialState';
import { createInspectionForCell } from '@/simulation/inspection';
import { placeBuild } from '@/simulation/placement';
import { generateId, nextRandomSeed } from '@/simulation/random';
import { stepSimulation } from '@/simulation/tick';
import { getHour } from '@/simulation/time';
import type {
  AccessibilitySettings,
  AudioSettings,
  BuildDrag,
  BuildingId,
  ClockState,
  GridCell,
  InspectionContext,
  LensMode,
  SimulationSnapshot,
  TowerIdentity,
  TowerState,
  UiSettings,
} from '@/simulation/types';
import { BUILDINGS } from '@/simulation/types';
import { planVisitorHosting, type VisitorHostingPlan } from '@/simulation/visitorPlanning';
import {
  type CohortFriction,
  describeVisitorBehavior,
  evaluateCohortFriction,
  generateVisitCohort,
  rememberCohortExperience,
  type VisitCohort,
  type VisitGenerationContext,
  type VisitorBehaviorProfile,
} from '@/simulation/visitors';
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
} from './traits';
import { gameWorld } from './world';

function requireSingleton<T>(value: T | undefined, name: string): T {
  if (!value) throw new Error(`Missing Koota singleton trait: ${name}`);
  return value;
}

function visitContextForWorld(world: World): VisitGenerationContext {
  const economy = requireSingleton(world.get(EconomyTrait), 'EconomyTrait');
  const campaign = requireSingleton(world.get(CampaignTrait), 'CampaignTrait');
  const macro = requireSingleton(world.get(MacroTrait), 'MacroTrait');
  const operations = requireSingleton(world.get(OperationsTrait), 'OperationsTrait');
  return {
    economy,
    fame: macro.fame,
    publicTrust: macro.publicTrust,
    regulationPressure: macro.regulationPressure,
    scandalRisk: macro.scandalRisk,
    towerIdentity: campaign.declaredIdentity ?? macro.districtIdentity ?? campaign.towerIdentity,
    weatherRisk: macro.weatherRisk,
    operations: {
      eventReadiness: operations.eventReadiness,
      noiseControl: operations.noiseControl,
      privacyComfort: operations.privacyComfort,
      safetyReadiness: operations.safetyReadiness,
      weatherRisk: macro.weatherRisk,
    },
  };
}

function pushActionNotice(
  tower: TowerState,
  text: string,
  type: 'info' | 'success' | 'warning',
): void {
  tower.notifications = [
    ...tower.notifications,
    { id: generateId('notice'), text, type, time: 260 },
  ].slice(-5);
}

export interface PublicVisitForecast {
  canInvite: boolean;
  message: string;
  label: string | null;
  size: number;
  targetRoomId: string | null;
  targetRoomName: string | null;
  targetRoomType: BuildingId | null;
  arrivalDay: number;
  arrivalHour: number;
  mood: CohortFriction['mood'] | null;
  frictionScore: number;
  pressureReasons: string[];
  recommendations: string[];
  behavior: VisitorBehaviorProfile | null;
  hostingPlan: VisitorHostingPlan | null;
}

export interface ActivePublicVisitReadiness {
  id: string;
  label: string;
  size: number;
  status: VisitCohort['status'];
  phaseLabel: string;
  message: string;
  targetRoomId: string | null;
  targetRoomName: string;
  targetRoomType: BuildingId | null;
  arrivalDay: number;
  arrivalHour: number;
  representativeCount: number;
  spawnedAgents: number;
  mood: CohortFriction['mood'];
  frictionScore: number;
  pressureReasons: string[];
  recommendations: string[];
  behavior: VisitorBehaviorProfile;
  hostingPlan: VisitorHostingPlan;
}

export type PublicStoryInspectionContext = Omit<InspectionContext, 'source'>;

interface PreparedPublicVisitInvite {
  seed: number;
  cohort: VisitCohort | null;
  friction: CohortFriction | null;
  forecast: PublicVisitForecast;
}

function inviteSchedule(clock: ClockState): {
  createdDay: number;
  createdHour: number;
  arrivalHour: number;
} {
  const currentHour = getHour(clock.tick);
  const createdDay = currentHour >= 20 ? clock.day + 1 : clock.day;
  const createdHour = currentHour >= 20 ? 9 : currentHour;
  return {
    createdDay,
    createdHour,
    arrivalHour: Math.min(20, Math.max(9, createdHour + 1)),
  };
}

function cohortExperienceContextForWorld(world: World) {
  const macro = requireSingleton(world.get(MacroTrait), 'MacroTrait');
  const operations = requireSingleton(world.get(OperationsTrait), 'OperationsTrait');
  return {
    eventReadiness: operations.eventReadiness,
    noiseControl: operations.noiseControl,
    privacyComfort: operations.privacyComfort,
    safetyReadiness: operations.safetyReadiness,
    weatherRisk: macro.weatherRisk,
  };
}

function recommendationsForFriction(reasons: readonly string[]): string[] {
  if (reasons.length === 0) {
    return ['Hosting posture is strong. Invite while queues, service, and safety stay calm.'];
  }
  const recommendations = reasons.map((reason) => {
    if (reason === 'queues') return 'Add elevator capacity or reduce peak transit pressure first.';
    if (reason === 'cleanliness') return 'Dispatch maintenance and add restroom/service coverage.';
    if (reason === 'service')
      return 'Improve staffed services before this group becomes the story.';
    if (reason === 'noise') return 'Separate quiet venues from heavy traffic and event floors.';
    if (reason === 'privacy')
      return 'Add security, suites, or quieter access before high-status guests.';
    if (reason === 'safety')
      return 'Improve security, mechanical, and code readiness before inviting press.';
    if (reason === 'weather')
      return 'Add weather core coverage before hosting skyline-facing visits.';
    return `Reduce ${reason} pressure before inviting.`;
  });
  return [...new Set(recommendations)].slice(0, 3);
}

function visitPhaseLabel(status: VisitCohort['status']): string {
  if (status === 'inside') return 'Visit underway';
  if (status === 'arriving') return 'Representatives routing';
  return 'Accepted inquiry';
}

function activeVisitMessage(visit: VisitCohort, friction: CohortFriction): string {
  if (visit.status === 'inside') {
    return `Visit underway: ${visit.label}. Their public memory is being shaped by current queues, privacy, safety, and service.`;
  }
  if (visit.status === 'arriving') {
    return `Representatives from ${visit.label} are moving through the tower. Transit delays now become part of the story.`;
  }
  return `Visit committed: ${visit.label}, day ${visit.createdDay} at ${visit.arrivalHour}:00, ${friction.mood} outlook. Fix the listed pressures before arrival.`;
}

function preparePublicVisitInvite(
  world: World,
  idFactory: (prefix?: string) => string = (prefix = 'visit') => `${prefix}-forecast`,
): PreparedPublicVisitInvite {
  const tower = requireSingleton(world.get(TowerTrait), 'TowerTrait');
  const economy = requireSingleton(world.get(EconomyTrait), 'EconomyTrait');
  const clock = requireSingleton(world.get(ClockTrait), 'ClockTrait');
  const seed = tower.visits.length >= 3 ? clock.rngSeed : nextRandomSeed(clock.rngSeed);
  const { createdDay, createdHour, arrivalHour } = inviteSchedule(clock);
  const emptyForecast = (
    message: string,
    recommendations: string[],
  ): PreparedPublicVisitInvite => ({
    seed,
    cohort: null,
    friction: null,
    forecast: {
      canInvite: false,
      message,
      label: null,
      size: 0,
      targetRoomId: null,
      targetRoomName: null,
      targetRoomType: null,
      arrivalDay: createdDay,
      arrivalHour,
      mood: null,
      frictionScore: 0,
      pressureReasons: [],
      recommendations,
      behavior: null,
      hostingPlan: null,
    },
  });

  if (tower.visits.length >= 3) {
    return emptyForecast('Visit docket is full.', [
      'Resolve one current inquiry before inviting another group.',
    ]);
  }

  let cohort = generateVisitCohort(
    seed,
    tower,
    { day: createdDay, hour: createdHour },
    visitContextForWorld(world),
    idFactory,
  );
  cohort = {
    ...cohort,
    createdDay,
    createdHour,
    arrivalHour,
  };

  const targetRoom = cohort.targetRoomId
    ? tower.rooms.find((room) => room.id === cohort.targetRoomId)
    : null;
  if (!targetRoom) {
    return emptyForecast('No credible public venue is available.', [
      'Build a cafe, hotel, retail space, conference room, event hall, gallery, or observation deck.',
    ]);
  }

  const experienceContext = cohortExperienceContextForWorld(world);
  cohort = rememberCohortExperience(
    cohort,
    economy,
    { day: createdDay, hour: createdHour },
    experienceContext,
  );
  const friction = evaluateCohortFriction(cohort, economy, experienceContext);
  const pressureReasons = [...new Set(friction.reasons)];
  const hostingPlan = planVisitorHosting(cohort, economy, experienceContext, friction);

  return {
    seed,
    cohort,
    friction,
    forecast: {
      canInvite: true,
      message: `${cohort.label} would arrive day ${createdDay} at ${arrivalHour}:00 with ${friction.mood} outlook.`,
      label: cohort.label,
      size: cohort.size,
      targetRoomId: targetRoom.id,
      targetRoomName: `${BUILDINGS[targetRoom.type].name} on floor ${targetRoom.y}`,
      targetRoomType: targetRoom.type,
      arrivalDay: createdDay,
      arrivalHour,
      mood: friction.mood,
      frictionScore: friction.score,
      pressureReasons,
      recommendations: recommendationsForFriction(pressureReasons),
      behavior: describeVisitorBehavior(cohort),
      hostingPlan,
    },
  };
}

export function forecastPublicVisitInvite(world: World = gameWorld): PublicVisitForecast {
  return preparePublicVisitInvite(world).forecast;
}

export function summarizeActivePublicVisits(
  world: World = gameWorld,
): ActivePublicVisitReadiness[] {
  const tower = requireSingleton(world.get(TowerTrait), 'TowerTrait');
  const economy = requireSingleton(world.get(EconomyTrait), 'EconomyTrait');
  const experienceContext = cohortExperienceContextForWorld(world);
  return tower.visits.map((visit) => {
    const targetRoom = visit.targetRoomId
      ? tower.rooms.find((room) => room.id === visit.targetRoomId)
      : null;
    const friction = evaluateCohortFriction(visit, economy, experienceContext);
    const pressureReasons = [...new Set(friction.reasons)];
    const hostingPlan = planVisitorHosting(visit, economy, experienceContext, friction);
    return {
      id: visit.id,
      label: visit.label,
      size: visit.size,
      status: visit.status,
      phaseLabel: visitPhaseLabel(visit.status),
      message: activeVisitMessage(visit, friction),
      targetRoomId: targetRoom?.id ?? null,
      targetRoomName: targetRoom
        ? `${BUILDINGS[targetRoom.type].name} on floor ${targetRoom.y}`
        : 'Unassigned',
      targetRoomType: targetRoom?.type ?? null,
      arrivalDay: visit.createdDay,
      arrivalHour: visit.arrivalHour,
      representativeCount: visit.representativeCount,
      spawnedAgents: visit.spawnedAgents,
      mood: friction.mood,
      frictionScore: friction.score,
      pressureReasons,
      recommendations: recommendationsForFriction(pressureReasons),
      behavior: describeVisitorBehavior(visit),
      hostingPlan,
    };
  });
}

export function startGame(world: World = gameWorld): void {
  world.set(PhaseTrait, { phase: 'playing' });
  world.set(TowerTrait, createInitialTower());
  world.set(EconomyTrait, createInitialEconomy());
  world.set(CampaignTrait, createInitialCampaign());
  world.set(MacroTrait, createInitialMacro());
  world.set(OperationsTrait, createInitialOperations());
  world.set(ClockTrait, { ...createInitialClock(), speed: 1 });
  world.set(ViewTrait, createInitialView());
  world.set(BuildDragTrait, { drag: null });
  world.set(InspectionTrait, createInitialInspection());
}

export function resetGame(world: World = gameWorld): void {
  world.set(PhaseTrait, { phase: 'menu' });
  world.set(TowerTrait, createInitialTower());
  world.set(EconomyTrait, createInitialEconomy());
  world.set(CampaignTrait, createInitialCampaign());
  world.set(MacroTrait, createInitialMacro());
  world.set(OperationsTrait, createInitialOperations());
  world.set(ClockTrait, createInitialClock());
  world.set(ViewTrait, createInitialView());
  world.set(BuildDragTrait, { drag: null });
  world.set(InspectionTrait, createInitialInspection());
}

export function selectTool(toolId: BuildingId | null, world: World = gameWorld): void {
  world.set(ViewTrait, (view) => ({
    ...view,
    selectedTool: view.selectedTool === toolId ? null : toolId,
  }));
  world.set(BuildDragTrait, { drag: null });
}

export function setSpeed(speed: ClockState['speed'], world: World = gameWorld): void {
  world.set(ClockTrait, (clock) => ({ ...clock, speed }));
}

export function setLensMode(mode: LensMode, world: World = gameWorld): void {
  world.set(ViewTrait, (view) => ({
    ...view,
    lensMode: mode,
    selectedTool: mode === 'normal' ? view.selectedTool : null,
  }));
  world.set(BuildDragTrait, { drag: null });
}

export function declareTowerIdentity(identity: TowerIdentity, world: World = gameWorld): boolean {
  if (identity === 'unformed') return false;
  const campaign = requireSingleton(world.get(CampaignTrait), 'CampaignTrait');
  if (campaign.act < 3 && !campaign.permits.includes('district-profile')) return false;
  const tower = requireSingleton(world.get(TowerTrait), 'TowerTrait');
  const nextTower = {
    ...tower,
    notifications: [
      ...tower.notifications,
      {
        id: generateId('notice'),
        text: `Tower identity declared: ${identity}.`,
        type: 'info' as const,
        time: 260,
      },
    ].slice(-5),
  };
  const spine = advanceGameSpine({
    tower: nextTower,
    economy: requireSingleton(world.get(EconomyTrait), 'EconomyTrait'),
    clock: requireSingleton(world.get(ClockTrait), 'ClockTrait'),
    campaign: { ...campaign, declaredIdentity: identity },
    macro: requireSingleton(world.get(MacroTrait), 'MacroTrait'),
    operations: requireSingleton(world.get(OperationsTrait), 'OperationsTrait'),
    events: ['identity-declared'],
  });
  world.set(TowerTrait, spine.tower);
  world.set(EconomyTrait, spine.economy);
  world.set(CampaignTrait, spine.campaign);
  world.set(MacroTrait, spine.macro);
  world.set(OperationsTrait, spine.operations);
  return true;
}

export function setTutorialStep(step: number, world: World = gameWorld): void {
  world.set(ViewTrait, (view) => ({ ...view, tutorialStep: step }));
}

export function setCamera(
  panX: number,
  panY: number,
  zoom: number,
  world: World = gameWorld,
): void {
  world.set(ViewTrait, (view) => ({ ...view, panX, panY, zoom }));
}

export function setAudioSettings(patch: Partial<AudioSettings>, world: World = gameWorld): void {
  world.set(SettingsTrait, (settings) => ({
    ...settings,
    audio: { ...settings.audio, ...patch },
  }));
}

export function setAccessibilitySettings(
  patch: Partial<AccessibilitySettings>,
  world: World = gameWorld,
): void {
  world.set(SettingsTrait, (settings) => ({
    ...settings,
    accessibility: { ...settings.accessibility, ...patch },
  }));
}

export function setUiSettings(patch: Partial<UiSettings>, world: World = gameWorld): void {
  world.set(SettingsTrait, (settings) => ({
    ...settings,
    ui: { ...settings.ui, ...patch },
  }));
}

export function setBuildDrag(drag: BuildDrag | null, world: World = gameWorld): void {
  world.set(BuildDragTrait, { drag });
}

export function commitBuild(world: World = gameWorld): boolean {
  const view = requireSingleton(world.get(ViewTrait), 'ViewTrait');
  const drag = requireSingleton(world.get(BuildDragTrait), 'BuildDragTrait').drag;
  const tower = requireSingleton(world.get(TowerTrait), 'TowerTrait');
  const economy = requireSingleton(world.get(EconomyTrait), 'EconomyTrait');
  if (!view.selectedTool || !drag || view.lensMode !== 'normal') return false;

  const result = placeBuild(tower, economy, view.selectedTool, drag, view.tutorialStep);
  const notifications = [
    ...result.tower.notifications,
    {
      id: generateId('notice'),
      text: result.message,
      type: result.ok ? ('success' as const) : ('warning' as const),
      time: 190,
    },
  ].slice(-5);

  const clock = requireSingleton(world.get(ClockTrait), 'ClockTrait');
  const spine = advanceGameSpine({
    tower: { ...result.tower, notifications },
    economy: result.economy,
    clock,
    campaign: requireSingleton(world.get(CampaignTrait), 'CampaignTrait'),
    macro: requireSingleton(world.get(MacroTrait), 'MacroTrait'),
    operations: requireSingleton(world.get(OperationsTrait), 'OperationsTrait'),
    events: result.ok ? ['build'] : [],
  });

  world.set(TowerTrait, spine.tower);
  world.set(EconomyTrait, spine.economy);
  world.set(CampaignTrait, spine.campaign);
  world.set(MacroTrait, spine.macro);
  world.set(OperationsTrait, spine.operations);
  world.set(ViewTrait, { ...view, tutorialStep: result.tutorialStep });
  world.set(BuildDragTrait, { drag: null });
  return result.ok;
}

export function tickWorld(world: World = gameWorld): string[] {
  const tower = requireSingleton(world.get(TowerTrait), 'TowerTrait');
  const economy = requireSingleton(world.get(EconomyTrait), 'EconomyTrait');
  const clock = requireSingleton(world.get(ClockTrait), 'ClockTrait');
  const campaign = requireSingleton(world.get(CampaignTrait), 'CampaignTrait');
  const macro = requireSingleton(world.get(MacroTrait), 'MacroTrait');
  const operations = requireSingleton(world.get(OperationsTrait), 'OperationsTrait');
  const result = stepSimulation(tower, economy, clock, undefined, visitContextForWorld(world));
  const spine = advanceGameSpine({
    tower: result.tower,
    economy: result.economy,
    clock: result.clock,
    campaign,
    macro,
    operations,
    events: result.events,
  });
  world.set(TowerTrait, spine.tower);
  world.set(EconomyTrait, spine.economy);
  world.set(CampaignTrait, spine.campaign);
  world.set(MacroTrait, spine.macro);
  world.set(OperationsTrait, spine.operations);
  world.set(ClockTrait, result.clock);
  return spine.events;
}

export interface InvitePublicVisitResult {
  ok: boolean;
  message: string;
  events: string[];
}

export function invitePublicVisit(world: World = gameWorld): InvitePublicVisitResult {
  const tower = requireSingleton(world.get(TowerTrait), 'TowerTrait');
  const economy = requireSingleton(world.get(EconomyTrait), 'EconomyTrait');
  const clock = requireSingleton(world.get(ClockTrait), 'ClockTrait');
  const campaign = requireSingleton(world.get(CampaignTrait), 'CampaignTrait');
  const macro = requireSingleton(world.get(MacroTrait), 'MacroTrait');
  const operations = requireSingleton(world.get(OperationsTrait), 'OperationsTrait');
  const prepared = preparePublicVisitInvite(world, generateId);
  const nextTower = {
    ...tower,
    visits: [...tower.visits],
    notifications: [...tower.notifications],
  };

  if (!prepared.cohort || !prepared.friction) {
    pushActionNotice(nextTower, prepared.forecast.message, 'warning');
    world.set(TowerTrait, nextTower);
    if (prepared.seed !== clock.rngSeed)
      world.set(ClockTrait, { ...clock, rngSeed: prepared.seed });
    return { ok: false, message: prepared.forecast.message, events: [] };
  }

  nextTower.visits.push(prepared.cohort);
  pushActionNotice(
    nextTower,
    `${prepared.cohort.label} invited for day ${prepared.forecast.arrivalDay} at ${prepared.forecast.arrivalHour}:00 with ${prepared.friction.mood} outlook.`,
    prepared.friction.mood === 'angry' ? 'warning' : 'info',
  );

  const events = ['visit-inquiry'];
  const spine = advanceGameSpine({
    tower: nextTower,
    economy,
    clock,
    campaign,
    macro,
    operations,
    events,
  });
  world.set(TowerTrait, spine.tower);
  world.set(EconomyTrait, spine.economy);
  world.set(CampaignTrait, spine.campaign);
  world.set(MacroTrait, spine.macro);
  world.set(OperationsTrait, spine.operations);
  world.set(ClockTrait, { ...clock, rngSeed: prepared.seed });
  return {
    ok: true,
    message: `${prepared.cohort.label} invited.`,
    events: spine.events,
  };
}

export function inspectGridCell(cell: GridCell, world: World = gameWorld): void {
  world.set(InspectionTrait, {
    selection: createInspectionForCell(
      requireSingleton(world.get(TowerTrait), 'TowerTrait'),
      requireSingleton(world.get(EconomyTrait), 'EconomyTrait'),
      requireSingleton(world.get(CampaignTrait), 'CampaignTrait'),
      requireSingleton(world.get(MacroTrait), 'MacroTrait'),
      requireSingleton(world.get(OperationsTrait), 'OperationsTrait'),
      cell,
    ),
  });
}

export function inspectPublicStoryFocus(
  cell: GridCell,
  context: PublicStoryInspectionContext,
  world: World = gameWorld,
): void {
  const selection = createInspectionForCell(
    requireSingleton(world.get(TowerTrait), 'TowerTrait'),
    requireSingleton(world.get(EconomyTrait), 'EconomyTrait'),
    requireSingleton(world.get(CampaignTrait), 'CampaignTrait'),
    requireSingleton(world.get(MacroTrait), 'MacroTrait'),
    requireSingleton(world.get(OperationsTrait), 'OperationsTrait'),
    cell,
  );
  world.set(InspectionTrait, {
    selection: {
      ...selection,
      context: {
        source: 'public-story',
        ...context,
      },
    },
  });
}

export function clearInspection(world: World = gameWorld): void {
  world.set(InspectionTrait, { selection: null });
}

export function createSnapshot(world: World = gameWorld): SimulationSnapshot {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    tower: requireSingleton(world.get(TowerTrait), 'TowerTrait'),
    economy: requireSingleton(world.get(EconomyTrait), 'EconomyTrait'),
    clock: requireSingleton(world.get(ClockTrait), 'ClockTrait'),
    view: requireSingleton(world.get(ViewTrait), 'ViewTrait'),
    campaign: requireSingleton(world.get(CampaignTrait), 'CampaignTrait'),
    macro: requireSingleton(world.get(MacroTrait), 'MacroTrait'),
    operations: requireSingleton(world.get(OperationsTrait), 'OperationsTrait'),
  };
}

export function hydrateSnapshot(snapshot: SimulationSnapshot, world: World = gameWorld): void {
  world.set(PhaseTrait, { phase: 'playing' });
  world.set(TowerTrait, snapshot.tower);
  world.set(EconomyTrait, snapshot.economy);
  world.set(CampaignTrait, snapshot.campaign);
  world.set(MacroTrait, snapshot.macro);
  world.set(OperationsTrait, snapshot.operations);
  world.set(ClockTrait, snapshot.clock);
  world.set(ViewTrait, snapshot.view);
  world.set(BuildDragTrait, { drag: null });
  world.set(InspectionTrait, createInitialInspection());
}
