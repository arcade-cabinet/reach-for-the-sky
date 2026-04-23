import type {
  EconomyState,
  GridCell,
  LensMode,
  MacroState,
  OperationsState,
  TowerRoom,
  TowerState,
} from './types';
import { BUILDINGS, type BuildingId } from './types';
import type { VisitMemoryRecord } from './visitors';

export interface PublicStoryActionSummary {
  dominantReason: string | null;
  lensMode: LensMode;
  lensLabel: string;
  headline: string;
  metricLabel: string;
  metricValue: string;
  diagnostic: string;
  recommendation: string;
  focusLabel: string;
  focusCell: GridCell | null;
}

const NOISE_SOURCE_ROOMS = new Set<BuildingId>(['cafe', 'eventHall', 'retail']);

function countRooms(tower: TowerState, type: BuildingId): number {
  return tower.rooms.filter((room) => room.type === type).length;
}

function countAny(tower: TowerState, types: Iterable<BuildingId>): number {
  const wanted = new Set(types);
  return tower.rooms.filter((room) => wanted.has(room.type)).length;
}

function roomCell(room: TowerRoom): GridCell {
  return { gx: room.x, gy: room.y };
}

function roomLabel(room: TowerRoom): string {
  return `${BUILDINGS[room.type].name}, floor ${room.y}`;
}

function topRoom(tower: TowerState): TowerRoom | null {
  return [...tower.rooms].sort((a, b) => b.y - a.y)[0] ?? null;
}

function worstDirtyRoom(tower: TowerState): TowerRoom | null {
  return [...tower.rooms].sort((a, b) => b.dirt - a.dirt)[0] ?? null;
}

function firstRoomOf(tower: TowerState, types: Iterable<BuildingId>): TowerRoom | null {
  const wanted = new Set(types);
  return tower.rooms.find((room) => wanted.has(room.type)) ?? null;
}

export function publicStoryReasonPriority(reason: string): number {
  if (reason === 'queues') return 100;
  if (reason === 'safety') return 94;
  if (reason === 'privacy') return 90;
  if (reason === 'noise') return 86;
  if (reason === 'cleanliness') return 82;
  if (reason === 'service') return 78;
  if (reason === 'weather') return 74;
  return 50;
}

export function dominantPublicPressureReason(reasons: readonly string[]): string | null {
  return (
    [...reasons].sort((a, b) => publicStoryReasonPriority(b) - publicStoryReasonPriority(a))[0] ??
    null
  );
}

export function publicStoryTone(outcome: string): string {
  if (outcome === 'praised') return 'Public praise';
  if (outcome === 'complained') return 'Public damage';
  return 'Mixed public story';
}

export function publicStoryImpact(outcome: string): string {
  if (outcome === 'praised') return 'Reputation tailwind';
  if (outcome === 'complained') return 'Trust damage likely';
  return 'Reputation at risk';
}

export function createPublicStoryActionSummary(
  memory: VisitMemoryRecord,
  tower: TowerState,
  economy: EconomyState,
  macro: MacroState,
  operations: OperationsState,
): PublicStoryActionSummary {
  const dominantReason = dominantPublicPressureReason(memory.pressureReasons);
  const longestWait = [...tower.agents].sort((a, b) => (b.waitTicks ?? 0) - (a.waitTicks ?? 0))[0];
  const dirtyRooms = tower.rooms.filter((room) => room.dirt >= 35);
  const dirtiestRoom = worstDirtyRoom(tower);
  const noiseRoom = firstRoomOf(tower, NOISE_SOURCE_ROOMS);
  const privacyRoom = firstRoomOf(tower, ['luxurySuite', 'hotel', 'condo', 'security']);
  const safetyRoom = firstRoomOf(tower, ['security', 'mechanical', 'clinic']) ?? topRoom(tower);
  const weatherRoom = firstRoomOf(tower, ['weatherCore']) ?? topRoom(tower);

  if (dominantReason === 'queues') {
    const focusCell = longestWait
      ? { gx: Math.round(longestWait.x), gy: Math.round(longestWait.floor) }
      : (tower.elevators[0] && {
          gx: Math.round(tower.elevators[0].x),
          gy: Math.round(tower.elevators[0].floor),
        }) ||
        null;
    return {
      dominantReason,
      lensMode: 'transit',
      lensLabel: 'Transit',
      headline: 'Vertical core bottleneck',
      metricLabel: 'Core load',
      metricValue: `${economy.transitPressure}% pressure · ${operations.transitTopology}% topology`,
      diagnostic: longestWait
        ? `Longest visible wait: ${longestWait.waitTicks ?? 0} ticks on floor ${Math.round(
            longestWait.floor,
          )}.`
        : `${tower.elevators.length} elevator cars and ${tower.shafts.length} shafts are carrying ${economy.population} people.`,
      recommendation: 'Open transit lens, extend the elevator core, and reduce peak routing load.',
      focusLabel: longestWait ? `Floor ${Math.round(longestWait.floor)} queue` : 'Elevator core',
      focusCell,
    };
  }

  if (dominantReason === 'cleanliness') {
    return {
      dominantReason,
      lensMode: 'maintenance',
      lensLabel: 'Maintenance',
      headline: 'Visible maintenance burden',
      metricLabel: 'Cleanliness',
      metricValue: `${economy.cleanliness}% clean · ${dirtyRooms.length} dirty rooms`,
      diagnostic: dirtiestRoom
        ? `Worst room: ${roomLabel(dirtiestRoom)} at ${Math.round(dirtiestRoom.dirt)}% dirt.`
        : 'No dirty room is currently visible, but the public memory still carries the cleanliness story.',
      recommendation:
        'Open maintenance lens, add maintenance/restroom coverage, and clean the worst room.',
      focusLabel: dirtiestRoom ? roomLabel(dirtiestRoom) : 'Maintenance coverage',
      focusCell: dirtiestRoom ? roomCell(dirtiestRoom) : null,
    };
  }

  if (dominantReason === 'service') {
    const serviceRoom = firstRoomOf(tower, ['maint', 'restroom', 'clinic', 'cafe']);
    return {
      dominantReason,
      lensMode: 'maintenance',
      lensLabel: 'Maintenance',
      headline: 'Service coverage gap',
      metricLabel: 'Service load',
      metricValue: `${economy.servicePressure}% pressure · ${operations.serviceCoverage}% coverage`,
      diagnostic: `${countRooms(tower, 'maint')} maintenance rooms, ${countRooms(
        tower,
        'restroom',
      )} restrooms, and ${countRooms(tower, 'clinic')} clinics are supporting ${economy.population} people.`,
      recommendation:
        'Open maintenance lens and add staffed services before hosting another group.',
      focusLabel: serviceRoom ? roomLabel(serviceRoom) : 'Service footprint',
      focusCell: serviceRoom ? roomCell(serviceRoom) : null,
    };
  }

  if (dominantReason === 'noise') {
    return {
      dominantReason,
      lensMode: 'privacy',
      lensLabel: 'Privacy',
      headline: 'Noise and crowding bleed',
      metricLabel: 'Noise control',
      metricValue: `${operations.noiseControl}% control · ${economy.transitPressure}% transit pressure`,
      diagnostic: `${countAny(tower, NOISE_SOURCE_ROOMS)} loud venues are operating against the current core load.`,
      recommendation:
        'Open privacy lens, separate noisy venues from quiet stays, and add buffer amenities.',
      focusLabel: noiseRoom ? roomLabel(noiseRoom) : 'Noisy venue footprint',
      focusCell: noiseRoom ? roomCell(noiseRoom) : null,
    };
  }

  if (dominantReason === 'privacy') {
    return {
      dominantReason,
      lensMode: 'privacy',
      lensLabel: 'Privacy',
      headline: 'Privacy comfort gap',
      metricLabel: 'Privacy',
      metricValue: `${operations.privacyComfort}% comfort · ${countRooms(
        tower,
        'security',
      )} security rooms`,
      diagnostic: `High-status guests need quiet routing; the tower has ${countRooms(
        tower,
        'luxurySuite',
      )} luxury suites and ${countRooms(tower, 'skyGarden')} sky gardens.`,
      recommendation:
        'Open privacy lens, add controlled access, and buffer prestige rooms from traffic.',
      focusLabel: privacyRoom ? roomLabel(privacyRoom) : 'Privacy-sensitive rooms',
      focusCell: privacyRoom ? roomCell(privacyRoom) : null,
    };
  }

  if (dominantReason === 'safety') {
    return {
      dominantReason,
      lensMode: 'safety',
      lensLabel: 'Safety',
      headline: 'Code readiness doubt',
      metricLabel: 'Safety',
      metricValue: `${operations.safetyReadiness}% readiness · ${operations.heightRisk}% height risk`,
      diagnostic: `${countRooms(tower, 'security')} security, ${countRooms(
        tower,
        'mechanical',
      )} mechanical, and ${countRooms(tower, 'clinic')} clinic rooms are covering ${operations.floorCount} occupied floors.`,
      recommendation:
        'Open safety lens and add security, mechanical, or clinic coverage before press scrutiny.',
      focusLabel: safetyRoom ? roomLabel(safetyRoom) : 'Safety coverage',
      focusCell: safetyRoom ? roomCell(safetyRoom) : null,
    };
  }

  if (dominantReason === 'weather') {
    return {
      dominantReason,
      lensMode: 'safety',
      lensLabel: 'Safety',
      headline: 'Weather exposure risk',
      metricLabel: 'Exposure',
      metricValue: `${macro.weatherRisk}% weather risk · ${operations.heightRisk}% height risk`,
      diagnostic: `${countRooms(tower, 'weatherCore')} weather cores are protecting a ${operations.floorCount}-floor tower.`,
      recommendation: 'Open safety lens, add weather cores, and reinforce high-floor systems.',
      focusLabel: weatherRoom ? roomLabel(weatherRoom) : 'Weather protection',
      focusCell: weatherRoom ? roomCell(weatherRoom) : null,
    };
  }

  return {
    dominantReason,
    lensMode: 'sentiment',
    lensLabel: 'Sentiment',
    headline: 'Public sentiment read',
    metricLabel: 'Sentiment',
    metricValue: `${economy.tenantSatisfaction}% tenant sentiment · ${macro.publicTrust}% trust`,
    diagnostic: 'This story has no single pressure reason, so read the broader sentiment layer.',
    recommendation: 'Open sentiment lens and inspect the rooms that shaped the public memory.',
    focusLabel: 'Sentiment layer',
    focusCell: null,
  };
}
