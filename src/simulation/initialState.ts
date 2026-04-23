import { createSeededRandom, generateId } from './random';
import {
  type ClockState,
  type EconomyState,
  type GameSettings,
  type InspectionState,
  STARTING_FUNDS,
  type TowerState,
  type ViewState,
} from './types';

export { createInitialCampaign, createInitialMacro, createInitialOperations } from './campaign';

export function createInitialClock(): ClockState {
  return { tick: 500, day: 1, speed: 0, rngSeed: 0x5eed_4104 };
}

export function createInitialEconomy(): EconomyState {
  return {
    funds: STARTING_FUNDS,
    population: 0,
    activeAgents: 0,
    stars: 1,
    cleanliness: 100,
    lifetimeRent: 0,
    dailyRevenue: 0,
    dailyCosts: 0,
    netRevenue: 0,
    towerValue: STARTING_FUNDS,
    transitPressure: 0,
    servicePressure: 0,
    tenantSatisfaction: 100,
    rentEfficiency: 100,
  };
}

export function createInitialView(): ViewState {
  return { selectedTool: null, lensMode: 'normal', panX: 0, panY: 150, zoom: 1, tutorialStep: 0 };
}

export function createInitialSettings(): GameSettings {
  return {
    audio: { proceduralVolume: 0.55, sampleVolume: 0.75, muted: false },
    accessibility: { highContrast: false, reducedMotion: false },
    ui: { displayScale: 1, inputHints: true, diagnosticsVisible: true, safeAreaMode: 'auto' },
  };
}

export function createInitialInspection(): InspectionState {
  return { selection: null };
}

export function createInitialTower(seed = 1729): TowerState {
  const random = createSeededRandom(seed);
  const clouds = Array.from({ length: 15 }, () => ({
    id: generateId('cloud'),
    x: random() * 200 - 100,
    y: random() * 80 + 20,
    speed: (random() * 0.05 + 0.01) * (random() > 0.5 ? 1 : -1),
    scale: random() * 1.5 + 0.5,
    opacity: random() * 0.3 + 0.1,
  }));

  return {
    rooms: [],
    shafts: [],
    elevators: [],
    agents: [],
    particles: [],
    notifications: [
      {
        id: generateId('notice'),
        text: 'Welcome. Build a lobby, floors, offices, and an elevator before the morning rush.',
        type: 'info',
        time: 240,
      },
    ],
    clouds,
    visits: [],
    visitMemories: [],
  };
}
