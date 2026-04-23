import { advanceGameSpine } from './campaign';
import {
  createInitialCampaign,
  createInitialClock,
  createInitialEconomy,
  createInitialMacro,
  createInitialOperations,
  createInitialTower,
  createInitialView,
} from './initialState';
import { placeBuild } from './placement';
import {
  type BuildingId,
  type CampaignState,
  type ClockState,
  DAY_TICKS,
  type EconomyState,
  type MacroState,
  type OperationsState,
  type SimulationSnapshot,
  type TowerState,
} from './types';

interface ScenarioPlacement {
  tool: BuildingId;
  start: { gx: number; gy: number };
  end: { gx: number; gy: number };
}

interface ScenarioState {
  tower: TowerState;
  economy: EconomyState;
  campaign: CampaignState;
  macro: MacroState;
  operations: OperationsState;
  clock: ClockState;
  tutorialStep: number;
}

const OPENING_CONTRACT: ScenarioPlacement[] = [
  { tool: 'lobby', start: { gx: -4, gy: 0 }, end: { gx: 5, gy: 0 } },
  { tool: 'floor', start: { gx: -4, gy: 1 }, end: { gx: 5, gy: 1 } },
  { tool: 'floor', start: { gx: -4, gy: 2 }, end: { gx: 5, gy: 2 } },
  { tool: 'floor', start: { gx: -4, gy: 3 }, end: { gx: 5, gy: 3 } },
  { tool: 'elevator', start: { gx: 0, gy: 0 }, end: { gx: 0, gy: 3 } },
  { tool: 'office', start: { gx: -4, gy: 1 }, end: { gx: -1, gy: 2 } },
  { tool: 'cafe', start: { gx: 1, gy: 1 }, end: { gx: 3, gy: 1 } },
  { tool: 'maint', start: { gx: 4, gy: 1 }, end: { gx: 5, gy: 1 } },
  { tool: 'condo', start: { gx: 1, gy: 2 }, end: { gx: 4, gy: 2 } },
  { tool: 'office', start: { gx: -4, gy: 3 }, end: { gx: -1, gy: 3 } },
  { tool: 'hotel', start: { gx: 2, gy: 3 }, end: { gx: 5, gy: 3 } },
];

const SKYLINE_CHARTER: ScenarioPlacement[] = [
  { tool: 'lobby', start: { gx: -12, gy: 0 }, end: { gx: 12, gy: 0 } },
  { tool: 'floor', start: { gx: -12, gy: 1 }, end: { gx: 12, gy: 18 } },
  { tool: 'elevator', start: { gx: -2, gy: 0 }, end: { gx: -2, gy: 18 } },
  { tool: 'elevator', start: { gx: -1, gy: 0 }, end: { gx: -1, gy: 18 } },
  { tool: 'elevator', start: { gx: 0, gy: 0 }, end: { gx: 0, gy: 18 } },
  { tool: 'elevator', start: { gx: 1, gy: 0 }, end: { gx: 1, gy: 18 } },
  { tool: 'elevator', start: { gx: 2, gy: 0 }, end: { gx: 2, gy: 18 } },
  { tool: 'office', start: { gx: -12, gy: 1 }, end: { gx: -9, gy: 1 } },
  { tool: 'cafe', start: { gx: 3, gy: 1 }, end: { gx: 5, gy: 1 } },
  { tool: 'maint', start: { gx: 6, gy: 1 }, end: { gx: 7, gy: 1 } },
  { tool: 'restroom', start: { gx: 8, gy: 1 }, end: { gx: 8, gy: 1 } },
  { tool: 'security', start: { gx: 9, gy: 1 }, end: { gx: 10, gy: 1 } },
  { tool: 'utilities', start: { gx: 11, gy: 1 }, end: { gx: 12, gy: 1 } },
  { tool: 'office', start: { gx: -12, gy: 2 }, end: { gx: -9, gy: 2 } },
  { tool: 'condo', start: { gx: 3, gy: 2 }, end: { gx: 6, gy: 2 } },
  { tool: 'mechanical', start: { gx: 7, gy: 2 }, end: { gx: 8, gy: 2 } },
  { tool: 'restroom', start: { gx: 9, gy: 2 }, end: { gx: 9, gy: 2 } },
  { tool: 'retail', start: { gx: 10, gy: 2 }, end: { gx: 11, gy: 2 } },
  { tool: 'hotel', start: { gx: -12, gy: 3 }, end: { gx: -9, gy: 3 } },
  { tool: 'conference', start: { gx: 3, gy: 3 }, end: { gx: 5, gy: 3 } },
  { tool: 'gallery', start: { gx: 6, gy: 3 }, end: { gx: 8, gy: 3 } },
  { tool: 'clinic', start: { gx: 9, gy: 3 }, end: { gx: 10, gy: 3 } },
  { tool: 'eventHall', start: { gx: -12, gy: 4 }, end: { gx: -9, gy: 4 } },
  { tool: 'skyGarden', start: { gx: 3, gy: 4 }, end: { gx: 5, gy: 4 } },
  { tool: 'observation', start: { gx: 6, gy: 4 }, end: { gx: 9, gy: 4 } },
  { tool: 'weatherCore', start: { gx: 10, gy: 4 }, end: { gx: 11, gy: 4 } },
  { tool: 'luxurySuite', start: { gx: -12, gy: 5 }, end: { gx: -10, gy: 5 } },
  { tool: 'office', start: { gx: 3, gy: 5 }, end: { gx: 6, gy: 5 } },
  { tool: 'security', start: { gx: 7, gy: 5 }, end: { gx: 8, gy: 5 } },
  { tool: 'mechanical', start: { gx: 9, gy: 5 }, end: { gx: 10, gy: 5 } },
  { tool: 'conference', start: { gx: -12, gy: 6 }, end: { gx: -10, gy: 6 } },
  { tool: 'retail', start: { gx: 3, gy: 6 }, end: { gx: 4, gy: 6 } },
  { tool: 'skyGarden', start: { gx: 5, gy: 6 }, end: { gx: 7, gy: 6 } },
  { tool: 'gallery', start: { gx: -12, gy: 8 }, end: { gx: -10, gy: 8 } },
  { tool: 'observation', start: { gx: 3, gy: 9 }, end: { gx: 6, gy: 9 } },
  { tool: 'weatherCore', start: { gx: 7, gy: 10 }, end: { gx: 8, gy: 10 } },
  { tool: 'luxurySuite', start: { gx: -12, gy: 12 }, end: { gx: -10, gy: 12 } },
  { tool: 'mechanical', start: { gx: 3, gy: 14 }, end: { gx: 4, gy: 14 } },
  { tool: 'skyGarden', start: { gx: -12, gy: 16 }, end: { gx: -10, gy: 16 } },
  { tool: 'observation', start: { gx: 3, gy: 18 }, end: { gx: 6, gy: 18 } },
];

function applyPlacement(state: ScenarioState, placement: ScenarioPlacement): ScenarioState {
  const result = placeBuild(
    state.tower,
    state.economy,
    placement.tool,
    { start: placement.start, end: placement.end },
    state.tutorialStep,
  );
  if (!result.ok) {
    throw new Error(`Invalid ${placement.tool} scenario placement: ${result.message}`);
  }
  const spine = advanceGameSpine({
    tower: result.tower,
    economy: result.economy,
    campaign: state.campaign,
    macro: state.macro,
    operations: state.operations,
    clock: state.clock,
    events: ['build'],
  });
  return {
    tower: spine.tower,
    economy: spine.economy,
    campaign: spine.campaign,
    macro: spine.macro,
    operations: spine.operations,
    clock: state.clock,
    tutorialStep: result.tutorialStep,
  };
}

export function createOpeningContractSnapshot(): SimulationSnapshot {
  let state: ScenarioState = {
    tower: createInitialTower(4104),
    economy: { ...createInitialEconomy(), funds: 500_000 },
    campaign: createInitialCampaign(),
    macro: createInitialMacro(),
    operations: createInitialOperations(),
    clock: createInitialClock(),
    tutorialStep: 0,
  };

  for (const placement of OPENING_CONTRACT) {
    state = applyPlacement(state, placement);
  }
  state.tower.notifications = [
    {
      id: 'opening-contract-notice',
      text: 'Opening contract loaded: watch workers stress the core, then add service capacity.',
      type: 'info',
      time: 300,
    },
  ];
  state.tower.particles = [];

  return {
    version: 1,
    savedAt: new Date(0).toISOString(),
    tower: state.tower,
    economy: state.economy,
    clock: { ...createInitialClock(), tick: Math.floor((DAY_TICKS * 6.85) / 24), speed: 1 },
    view: { ...createInitialView(), panX: 0, panY: 146, zoom: 1.55, tutorialStep: 4 },
    campaign: state.campaign,
    macro: state.macro,
    operations: state.operations,
  };
}

export function createSkylineCharterSnapshot(): SimulationSnapshot {
  let state: ScenarioState = {
    tower: createInitialTower(8405),
    economy: { ...createInitialEconomy(), funds: 8_500_000 },
    campaign: createInitialCampaign(),
    macro: createInitialMacro(),
    operations: createInitialOperations(),
    clock: { ...createInitialClock(), day: 18, tick: Math.floor((DAY_TICKS * 15) / 24), speed: 1 },
    tutorialStep: 0,
  };

  for (const placement of SKYLINE_CHARTER) {
    state = applyPlacement(state, placement);
  }

  state = {
    ...state,
    economy: { ...state.economy, funds: Math.max(state.economy.funds, 900_000) },
    campaign: { ...state.campaign, declaredIdentity: 'mixed-use', successfulVisits: 3 },
    macro: {
      ...state.macro,
      publicTrust: Math.max(state.macro.publicTrust, 78),
      fame: Math.max(state.macro.fame, 66),
      cityInfluence: Math.max(state.macro.cityInfluence, 64),
    },
  };

  for (let index = 0; index < 8 && state.campaign.victory !== 'won'; index += 1) {
    const spine = advanceGameSpine({
      tower: state.tower,
      economy: state.economy,
      campaign: state.campaign,
      macro: state.macro,
      operations: state.operations,
      clock: state.clock,
      events: [],
    });
    state = {
      ...state,
      tower: spine.tower,
      economy: spine.economy,
      campaign: spine.campaign,
      macro: spine.macro,
      operations: spine.operations,
    };
  }

  state.tower.notifications = [
    {
      id: 'skyline-charter-notice',
      text: 'Skyline charter secured. The campaign-backed sandbox is now running.',
      type: 'success',
      time: 420,
    },
  ];
  state.tower.visitMemories = [
    {
      id: 'memory-press',
      cohortId: 'scenario-press',
      archetypeId: 'press-swarm',
      label: 'Press swarm',
      size: 18,
      createdDay: 17,
      resolvedDay: 18,
      sentiment: 48,
      frictionScore: 52,
      outcome: 'complained',
      impressions: ['The cameras found the queue before they found the skyline.'],
      pressureReasons: ['queues'],
      updatedDay: 18,
      updatedHour: 13,
    },
    {
      id: 'memory-inspection',
      cohortId: 'scenario-inspection',
      archetypeId: 'city-inspectors',
      label: 'City inspector tour',
      size: 6,
      createdDay: 17,
      resolvedDay: 18,
      sentiment: 69,
      frictionScore: 31,
      outcome: 'mixed',
      impressions: ['Inspectors accepted the core but flagged crowd control.'],
      pressureReasons: ['safety', 'queues'],
      updatedDay: 18,
      updatedHour: 11,
    },
    {
      id: 'memory-teachers',
      cohortId: 'scenario-teachers',
      archetypeId: 'school-teachers',
      label: 'School teacher convention',
      size: 76,
      createdDay: 14,
      resolvedDay: 15,
      sentiment: 88,
      frictionScore: 12,
      outcome: 'praised',
      impressions: ['The group left calm, grateful, and easy to host.'],
      pressureReasons: [],
      updatedDay: 15,
      updatedHour: 17,
    },
    {
      id: 'memory-stamps',
      cohortId: 'scenario-stamps',
      archetypeId: 'stamp-collectors',
      label: 'Stamp collector convention',
      size: 34,
      createdDay: 15,
      resolvedDay: 16,
      sentiment: 71,
      frictionScore: 29,
      outcome: 'mixed',
      impressions: ['They remembered waiting more than the architecture.'],
      pressureReasons: ['queues', 'noise'],
      updatedDay: 16,
      updatedHour: 16,
    },
    {
      id: 'memory-delegation',
      cohortId: 'scenario-delegation',
      archetypeId: 'politician',
      label: 'Campaign delegation',
      size: 22,
      createdDay: 16,
      resolvedDay: 17,
      sentiment: 83,
      frictionScore: 17,
      outcome: 'praised',
      impressions: ['The group got the status signal it expected.'],
      pressureReasons: [],
      updatedDay: 17,
      updatedHour: 18,
    },
  ];
  state.campaign = { ...state.campaign, failedVisits: 1 };
  state.tower.particles = [];

  return {
    version: 1,
    savedAt: new Date(0).toISOString(),
    tower: state.tower,
    economy: state.economy,
    clock: state.clock,
    view: { ...createInitialView(), panX: 0, panY: 230, zoom: 1.1, tutorialStep: 4 },
    campaign: state.campaign,
    macro: state.macro,
    operations: state.operations,
  };
}

export function createWeatherStressSnapshot(): SimulationSnapshot {
  const snapshot = createSkylineCharterSnapshot();
  return {
    ...snapshot,
    savedAt: new Date(0).toISOString(),
    clock: { ...snapshot.clock, tick: Math.floor((DAY_TICKS * 17.4) / 24), speed: 0 },
    view: { ...snapshot.view, panX: 0, panY: 230, zoom: 1.02, lensMode: 'normal' },
    macro: {
      ...snapshot.macro,
      weatherRisk: 92,
      regulationPressure: Math.max(snapshot.macro.regulationPressure, 78),
      scandalRisk: Math.max(snapshot.macro.scandalRisk, 44),
    },
    operations: {
      ...snapshot.operations,
      heightRisk: 86,
      safetyReadiness: Math.min(snapshot.operations.safetyReadiness, 48),
    },
    tower: {
      ...snapshot.tower,
      notifications: [
        {
          id: 'weather-stress-notice',
          text: 'Weather stress scenario: height exposure is now visible as atmospheric pressure.',
          type: 'warning',
          time: 420,
        },
      ],
      particles: [],
    },
  };
}

export function createRecoveryDrillSnapshot(): SimulationSnapshot {
  const opening = createOpeningContractSnapshot();
  const pressured = advanceGameSpine({
    tower: opening.tower,
    economy: {
      ...opening.economy,
      transitPressure: 94,
      servicePressure: 12,
      tenantSatisfaction: 46,
    },
    campaign: {
      ...opening.campaign,
      act: 3,
      permits: ['foundation', 'working-core', 'operations-permit'],
    },
    macro: opening.macro,
    operations: opening.operations,
    clock: { ...opening.clock, day: 1 },
    events: [],
  });
  const failed = advanceGameSpine({
    tower: pressured.tower,
    economy: { ...pressured.economy, transitPressure: 94, tenantSatisfaction: 43 },
    campaign: pressured.campaign,
    macro: pressured.macro,
    operations: pressured.operations,
    clock: { ...opening.clock, day: 5 },
    events: [],
  });
  const memoryRepair = advanceGameSpine({
    tower: {
      ...failed.tower,
      visitMemories: [
        {
          id: 'memory-noise-repair',
          cohortId: 'cohort-noise-repair',
          archetypeId: 'stamp-collectors',
          label: 'Stamp collector convention',
          size: 42,
          createdDay: 4,
          resolvedDay: 5,
          sentiment: 39,
          frictionScore: 61,
          outcome: 'complained',
          impressions: ['Stamp collectors were polite until the room stopped feeling orderly.'],
          pressureReasons: ['noise'],
          updatedDay: 5,
          updatedHour: 15,
        },
        ...failed.tower.visitMemories,
      ],
    },
    economy: { ...failed.economy, transitPressure: 55, tenantSatisfaction: 55 },
    campaign: failed.campaign,
    macro: failed.macro,
    operations: failed.operations,
    clock: { ...opening.clock, day: 5 },
    events: ['visit-failure'],
  });

  return {
    version: 1,
    savedAt: new Date(0).toISOString(),
    tower: {
      ...memoryRepair.tower,
      notifications: [
        {
          id: 'recovery-drill-notice',
          text: 'Recovery drill loaded: failed transit and public memory are now repair work.',
          type: 'warning',
          time: 420,
        },
      ],
      particles: [],
    },
    economy: memoryRepair.economy,
    clock: { ...opening.clock, day: 5, speed: 0 },
    view: { ...opening.view, panX: 0, panY: 164, zoom: 1.85 },
    campaign: memoryRepair.campaign,
    macro: memoryRepair.macro,
    operations: memoryRepair.operations,
  };
}
