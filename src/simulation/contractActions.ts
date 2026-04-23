import type {
  BuildingId,
  ContractMetric,
  ContractObjective,
  EconomyState,
  GridCell,
  LensMode,
  MacroState,
  OperationsState,
  TowerRoom,
  TowerState,
} from './types';
import { BUILDINGS } from './types';

export interface ContractObjectiveAction {
  metric: ContractMetric;
  lensMode: LensMode;
  lensLabel: string;
  headline: string;
  diagnostic: string;
  recommendation: string;
  focusLabel: string;
  focusCell: GridCell | null;
  toolId: BuildingId | null;
  toolLabel: string | null;
}

const NOISE_SOURCE_ROOMS = new Set<BuildingId>(['cafe', 'eventHall', 'retail']);

function roomCount(tower: TowerState, type: BuildingId): number {
  return tower.rooms.filter((room) => room.type === type).length;
}

function firstRoomOf(tower: TowerState, types: Iterable<BuildingId>): TowerRoom | null {
  const wanted = new Set(types);
  return tower.rooms.find((room) => wanted.has(room.type)) ?? null;
}

function worstDirtyRoom(tower: TowerState): TowerRoom | null {
  return [...tower.rooms].sort((a, b) => b.dirt - a.dirt)[0] ?? null;
}

function topRoom(tower: TowerState): TowerRoom | null {
  return [...tower.rooms].sort((a, b) => b.y - a.y)[0] ?? null;
}

function roomCell(room: TowerRoom): GridCell {
  return { gx: room.x, gy: room.y };
}

function roomLabel(room: TowerRoom): string {
  return `${BUILDINGS[room.type].name}, floor ${room.y}`;
}

function toolLabel(toolId: BuildingId | null): string | null {
  return toolId ? BUILDINGS[toolId].name : null;
}

function progressText(objective: ContractObjective): string {
  const comparator = objective.direction === 'at-least' ? 'needs at least' : 'must be at most';
  return `${objective.label}: ${objective.value}/${objective.target}, ${comparator} ${objective.target}.`;
}

function roomMetricLens(roomType: BuildingId): LensMode {
  const kind = BUILDINGS[roomType].kind;
  if (kind === 'security' || kind === 'health' || kind === 'weather' || kind === 'utility') {
    return 'safety';
  }
  if (kind === 'green' || kind === 'luxury' || kind === 'sleep' || kind === 'home') {
    return 'privacy';
  }
  if (kind === 'event' || kind === 'retail' || kind === 'culture' || kind === 'observation') {
    return 'event';
  }
  if (kind === 'service' || kind === 'sanitation' || roomType === 'maint') {
    return 'maintenance';
  }
  if (BUILDINGS[roomType].cat === 'trans') return 'transit';
  return 'value';
}

function lensLabel(lensMode: LensMode): string {
  if (lensMode === 'maintenance') return 'Maintenance';
  if (lensMode === 'transit') return 'Transit';
  if (lensMode === 'value') return 'Value';
  if (lensMode === 'sentiment') return 'Sentiment';
  if (lensMode === 'privacy') return 'Privacy';
  if (lensMode === 'safety') return 'Safety';
  if (lensMode === 'event') return 'Event';
  return 'Normal';
}

function weakestOperation(operations: OperationsState): {
  label: string;
  value: number;
  lensMode: LensMode;
  toolId: BuildingId;
} {
  return [
    {
      label: 'transit topology',
      value: operations.transitTopology,
      lensMode: 'transit',
      toolId: 'elevator',
    },
    {
      label: 'service coverage',
      value: operations.serviceCoverage,
      lensMode: 'maintenance',
      toolId: 'maint',
    },
    {
      label: 'safety readiness',
      value: operations.safetyReadiness,
      lensMode: 'safety',
      toolId: 'security',
    },
    {
      label: 'event readiness',
      value: operations.eventReadiness,
      lensMode: 'event',
      toolId: 'eventHall',
    },
    {
      label: 'privacy comfort',
      value: operations.privacyComfort,
      lensMode: 'privacy',
      toolId: 'security',
    },
    {
      label: 'noise control',
      value: operations.noiseControl,
      lensMode: 'privacy',
      toolId: 'skyGarden',
    },
  ].sort((a, b) => a.value - b.value)[0] as {
    label: string;
    value: number;
    lensMode: LensMode;
    toolId: BuildingId;
  };
}

function firstElevatorCell(tower: TowerState): GridCell | null {
  const elevator = tower.elevators[0];
  if (!elevator) return null;
  return { gx: Math.round(elevator.x), gy: Math.round(elevator.floor) };
}

function longestWaitCell(tower: TowerState): GridCell | null {
  const waiter = [...tower.agents].sort((a, b) => (b.waitTicks ?? 0) - (a.waitTicks ?? 0))[0];
  if (!waiter || (waiter.waitTicks ?? 0) <= 0) return null;
  return { gx: Math.round(waiter.x), gy: Math.round(waiter.floor) };
}

export function createContractObjectiveAction(
  objective: ContractObjective,
  tower: TowerState,
  economy: EconomyState,
  macro: MacroState,
  operations: OperationsState,
): ContractObjectiveAction {
  if (objective.metric === 'room-count' && objective.roomType) {
    const existing = firstRoomOf(tower, [objective.roomType]);
    const lensMode = roomMetricLens(objective.roomType);
    const label = BUILDINGS[objective.roomType].name;
    return {
      metric: objective.metric,
      lensMode,
      lensLabel: lensLabel(lensMode),
      headline: `Build ${label}`,
      diagnostic: `${progressText(objective)} Current count is ${roomCount(tower, objective.roomType)}.`,
      recommendation: `Switch to construction and place ${label} where it supports this pressure objective.`,
      focusLabel: existing ? roomLabel(existing) : `${label} placement`,
      focusCell: existing ? roomCell(existing) : null,
      toolId: objective.roomType,
      toolLabel: label,
    };
  }

  if (objective.metric === 'transit-pressure') {
    return {
      metric: objective.metric,
      lensMode: 'transit',
      lensLabel: 'Transit',
      headline: 'Reduce elevator pressure',
      diagnostic: `${progressText(objective)} Current transit topology is ${operations.transitTopology}%.`,
      recommendation:
        'Open transit lens, inspect the core, then extend elevator shafts or add capacity.',
      focusLabel: 'Elevator core',
      focusCell: longestWaitCell(tower) ?? firstElevatorCell(tower),
      toolId: 'elevator',
      toolLabel: 'Elevator',
    };
  }

  if (objective.metric === 'service-pressure') {
    const focus = firstRoomOf(tower, ['maint', 'restroom', 'clinic']);
    return {
      metric: objective.metric,
      lensMode: 'maintenance',
      lensLabel: 'Maintenance',
      headline: 'Relieve service load',
      diagnostic: `${progressText(objective)} Service coverage is ${operations.serviceCoverage}% for ${economy.population} people.`,
      recommendation:
        'Add maintenance, restroom, or clinic capacity before this service gap becomes sentiment loss.',
      focusLabel: focus ? roomLabel(focus) : 'Service footprint',
      focusCell: focus ? roomCell(focus) : null,
      toolId: 'maint',
      toolLabel: 'Maint.',
    };
  }

  if (objective.metric === 'cleanliness') {
    const focus = worstDirtyRoom(tower);
    return {
      metric: objective.metric,
      lensMode: 'maintenance',
      lensLabel: 'Maintenance',
      headline: 'Clean the visible problem',
      diagnostic: `${progressText(objective)} The tower is ${economy.cleanliness}% clean.`,
      recommendation:
        'Open maintenance lens, inspect the dirtiest room, and expand maintenance coverage.',
      focusLabel: focus ? roomLabel(focus) : 'Maintenance coverage',
      focusCell: focus ? roomCell(focus) : null,
      toolId: 'maint',
      toolLabel: 'Maint.',
    };
  }

  if (objective.metric === 'operations-grade') {
    const weakest = weakestOperation(operations);
    return {
      metric: objective.metric,
      lensMode: weakest.lensMode,
      lensLabel: lensLabel(weakest.lensMode),
      headline: 'Raise the weakest operation',
      diagnostic: `${progressText(objective)} Weakest subsystem: ${weakest.label} at ${weakest.value}%.`,
      recommendation: `Open ${lensLabel(weakest.lensMode).toLowerCase()} lens and build toward the weakest operational subsystem.`,
      focusLabel: weakest.label,
      focusCell: null,
      toolId: weakest.toolId,
      toolLabel: toolLabel(weakest.toolId),
    };
  }

  if (objective.metric === 'noise-control') {
    const focus = firstRoomOf(tower, NOISE_SOURCE_ROOMS);
    return {
      metric: objective.metric,
      lensMode: 'privacy',
      lensLabel: 'Privacy',
      headline: 'Buffer noisy public space',
      diagnostic: `${progressText(objective)} Current privacy comfort is ${operations.privacyComfort}%.`,
      recommendation:
        'Open privacy lens, separate loud venues from quiet rooms, and add sky gardens or mechanical buffers.',
      focusLabel: focus ? roomLabel(focus) : 'Noisy venue footprint',
      focusCell: focus ? roomCell(focus) : null,
      toolId: 'skyGarden',
      toolLabel: 'Sky Garden',
    };
  }

  if (objective.metric === 'privacy-comfort') {
    const focus = firstRoomOf(tower, ['luxurySuite', 'hotel', 'condo', 'security']);
    return {
      metric: objective.metric,
      lensMode: 'privacy',
      lensLabel: 'Privacy',
      headline: 'Protect privacy routes',
      diagnostic: `${progressText(objective)} Noise control is ${operations.noiseControl}%.`,
      recommendation:
        'Open privacy lens and add security, suites, or garden buffers near prestige traffic.',
      focusLabel: focus ? roomLabel(focus) : 'Privacy-sensitive footprint',
      focusCell: focus ? roomCell(focus) : null,
      toolId: 'security',
      toolLabel: 'Security',
    };
  }

  if (objective.metric === 'safety-readiness') {
    const focus = firstRoomOf(tower, ['security', 'mechanical', 'clinic']) ?? topRoom(tower);
    return {
      metric: objective.metric,
      lensMode: 'safety',
      lensLabel: 'Safety',
      headline: 'Improve code readiness',
      diagnostic: `${progressText(objective)} Height risk is ${operations.heightRisk}%.`,
      recommendation:
        'Open safety lens and add security, mechanical, clinic, or weather systems where risk concentrates.',
      focusLabel: focus ? roomLabel(focus) : 'Safety coverage',
      focusCell: focus ? roomCell(focus) : null,
      toolId: 'security',
      toolLabel: 'Security',
    };
  }

  if (objective.metric === 'event-readiness' || objective.metric === 'venue-credibility') {
    const focus = firstRoomOf(tower, ['eventHall', 'conference', 'gallery', 'observation', 'cafe']);
    return {
      metric: objective.metric,
      lensMode: 'event',
      lensLabel: 'Event',
      headline: 'Make the venue credible',
      diagnostic: `${progressText(objective)} Venue credibility is ${operations.venueCredibility}%.`,
      recommendation:
        'Open event lens and add public-facing venues with supporting service and safety coverage.',
      focusLabel: focus ? roomLabel(focus) : 'Public venue footprint',
      focusCell: focus ? roomCell(focus) : null,
      toolId: 'eventHall',
      toolLabel: 'Event Hall',
    };
  }

  if (objective.metric === 'successful-visits') {
    return {
      metric: objective.metric,
      lensMode: 'event',
      lensLabel: 'Event',
      headline: 'Host a better public visit',
      diagnostic: `${progressText(objective)} Public trust is ${macro.publicTrust}% and event readiness is ${operations.eventReadiness}%.`,
      recommendation:
        'Open event lens, stabilize current pressure reasons, then use the Visit docket to invite or receive a group.',
      focusLabel: 'Visit docket',
      focusCell: null,
      toolId: 'eventHall',
      toolLabel: 'Event Hall',
    };
  }

  if (objective.metric === 'weather-risk' || objective.metric === 'height') {
    const focus = firstRoomOf(tower, ['weatherCore']) ?? topRoom(tower);
    return {
      metric: objective.metric,
      lensMode: 'safety',
      lensLabel: 'Safety',
      headline: 'Control height exposure',
      diagnostic: `${progressText(objective)} Weather risk is ${macro.weatherRisk}% and height risk is ${operations.heightRisk}%.`,
      recommendation:
        'Open safety lens and add weather cores or mechanical support before pushing higher.',
      focusLabel: focus ? roomLabel(focus) : 'Weather protection',
      focusCell: focus ? roomCell(focus) : null,
      toolId: 'weatherCore',
      toolLabel: 'Weather Core',
    };
  }

  if (objective.metric === 'public-trust' || objective.metric === 'tenant-satisfaction') {
    return {
      metric: objective.metric,
      lensMode: 'sentiment',
      lensLabel: 'Sentiment',
      headline: 'Repair confidence',
      diagnostic: `${progressText(objective)} Tenant sentiment is ${economy.tenantSatisfaction}% and public trust is ${macro.publicTrust}%.`,
      recommendation: 'Open sentiment lens and fix the operating pressure most visible to people.',
      focusLabel: 'Sentiment layer',
      focusCell: null,
      toolId: null,
      toolLabel: null,
    };
  }

  if (
    objective.metric === 'daily-revenue' ||
    objective.metric === 'funds' ||
    objective.metric === 'tower-value'
  ) {
    return {
      metric: objective.metric,
      lensMode: 'value',
      lensLabel: 'Value',
      headline: 'Improve financial yield',
      diagnostic: `${progressText(objective)} Daily revenue is $${economy.dailyRevenue.toLocaleString()} and tower value is $${economy.towerValue.toLocaleString()}.`,
      recommendation:
        'Open value lens and add high-yield rooms without worsening transit or service pressure.',
      focusLabel: 'Value layer',
      focusCell: null,
      toolId: 'office',
      toolLabel: 'Office',
    };
  }

  return {
    metric: objective.metric,
    lensMode: 'event',
    lensLabel: 'Event',
    headline: 'Review objective pressure',
    diagnostic: progressText(objective),
    recommendation:
      'Open the most relevant operating lens and inspect the rooms contributing to this objective.',
    focusLabel: 'Objective context',
    focusCell: null,
    toolId: null,
    toolLabel: null,
  };
}
