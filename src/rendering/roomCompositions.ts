import type { TowerRoom } from '@/simulation/types';
import type { ElementVectorKey } from './vectorAssets';

export interface RoomCompositionState {
  lit: boolean;
  night: boolean;
}

export interface VectorPlacement {
  key: ElementVectorKey;
  x: number;
  y: number;
  width: number;
  height: number;
  alpha?: number;
}

function seededSlot(seed: number, count: number): number {
  return Math.floor(seed * 9_973) % count;
}

function structuralFrame(alpha = 0.72): VectorPlacement[] {
  return [
    { key: 'facade-rib', x: 0, y: 0, width: 96, height: 32, alpha },
    { key: 'ceiling-rail', x: 2, y: 2, width: 92, height: 9, alpha: alpha * 0.72 },
    { key: 'floor-slab', x: 0, y: 25, width: 96, height: 7, alpha: alpha * 0.88 },
  ];
}

export function createRoomComposition(
  room: TowerRoom,
  state: RoomCompositionState,
): VectorPlacement[] {
  switch (room.type) {
    case 'floor':
      return [
        { key: 'facade-rib', x: 0, y: 0, width: 96, height: 32, alpha: 0.44 },
        { key: 'floor-slab', x: 0, y: 24, width: 96, height: 8, alpha: 0.78 },
        { key: 'window-bank', x: 2, y: 6, width: 92, height: 18, alpha: 0.18 },
      ];
    case 'lobby':
      return [
        ...structuralFrame(0.58),
        { key: 'window-bank', x: 1, y: 3, width: 94, height: 24, alpha: 0.22 },
        { key: 'lobby-door', x: 32, y: 6, width: 32, height: 24, alpha: 0.9 },
        { key: 'plant', x: 6, y: 7, width: 16, height: 23, alpha: 0.82 },
        { key: 'plant', x: 76, y: 9, width: 14, height: 21, alpha: 0.62 },
      ];
    case 'office': {
      const deskOffset = seededSlot(room.seed, 3) * 4;
      return [
        ...structuralFrame(0.64),
        { key: 'window-bank', x: 2, y: 4, width: 92, height: 22, alpha: state.lit ? 0.42 : 0.28 },
        {
          key: 'room-divider',
          x: room.seed > 0.5 ? 31 : 62,
          y: 7,
          width: 10,
          height: 21,
          alpha: 0.34,
        },
        { key: 'office-desk', x: 6 + deskOffset, y: 11, width: 25, height: 17, alpha: 0.92 },
        { key: 'office-desk', x: 37, y: 11, width: 25, height: 17, alpha: 0.86 },
        { key: 'office-desk', x: 68 - deskOffset, y: 11, width: 23, height: 17, alpha: 0.78 },
        { key: 'plant', x: room.seed > 0.5 ? 80 : 4, y: 6, width: 13, height: 22, alpha: 0.65 },
      ];
    }
    case 'condo':
      return [
        ...structuralFrame(0.54),
        { key: 'window-bank', x: 4, y: 6, width: 88, height: 19, alpha: state.night ? 0.16 : 0.22 },
        { key: 'room-divider', x: 34, y: 9, width: 9, height: 19, alpha: 0.26 },
        { key: 'plant', x: 6, y: 7, width: 16, height: 22, alpha: 0.76 },
        {
          key: 'tv-console',
          x: 44,
          y: 11,
          width: 38,
          height: 18,
          alpha: state.night ? 0.95 : 0.68,
        },
        { key: 'lamp', x: 80, y: 5, width: 12, height: 24, alpha: state.night ? 0.72 : 0.42 },
      ];
    case 'cafe':
      return [
        ...structuralFrame(0.5),
        { key: 'cafe-awning', x: 2, y: 2, width: 92, height: 10, alpha: 0.95 },
        { key: 'cafe-sign', x: 35, y: 5, width: 27, height: 8, alpha: 0.72 },
        { key: 'cafe-counter', x: 3, y: 9, width: 90, height: 18, alpha: 0.92 },
        { key: 'cafe-table', x: 14, y: 13, width: 15, height: 16, alpha: 0.86 },
        { key: 'cafe-table', x: 43, y: 13, width: 15, height: 16, alpha: 0.8 },
        { key: 'cafe-table', x: 72, y: 13, width: 15, height: 16, alpha: 0.86 },
      ];
    case 'hotel':
      return [
        ...structuralFrame(0.56),
        { key: 'window-bank', x: 6, y: 6, width: 84, height: 18, alpha: state.night ? 0.14 : 0.22 },
        { key: 'room-divider', x: 13, y: 8, width: 9, height: 20, alpha: 0.2 },
        { key: 'bed', x: 19, y: 10, width: 58, height: 18, alpha: 0.94 },
        { key: 'lamp', x: 78, y: 4, width: 13, height: 24, alpha: state.night ? 0.82 : 0.42 },
      ];
    case 'maint':
      return [
        ...structuralFrame(0.58),
        { key: 'service-stripes', x: 3, y: 4, width: 90, height: 14, alpha: 0.7 },
        { key: 'service-panel', x: 6, y: 9, width: 23, height: 19, alpha: 0.88 },
        { key: 'service-wrench', x: 25, y: 10, width: 46, height: 16, alpha: 0.9 },
      ];
    case 'utilities':
    case 'mechanical':
      return [
        ...structuralFrame(0.6),
        { key: 'utility-pipes', x: 4, y: 4, width: 88, height: 24, alpha: 0.92 },
        { key: 'service-panel', x: 6, y: 9, width: 24, height: 18, alpha: 0.7 },
      ];
    case 'restroom':
      return [
        ...structuralFrame(0.5),
        { key: 'restroom-fixtures', x: 5, y: 5, width: 86, height: 24, alpha: 0.9 },
      ];
    case 'security':
      return [
        ...structuralFrame(0.58),
        { key: 'security-desk', x: 5, y: 5, width: 86, height: 24, alpha: 0.9 },
        { key: 'window-bank', x: 3, y: 4, width: 90, height: 20, alpha: 0.12 },
      ];
    case 'eventHall':
      return [
        ...structuralFrame(0.54),
        { key: 'event-stage', x: 4, y: 4, width: 88, height: 25, alpha: 0.92 },
        { key: 'ceiling-rail', x: 4, y: 2, width: 88, height: 7, alpha: 0.6 },
      ];
    case 'retail':
      return [
        ...structuralFrame(0.54),
        { key: 'retail-shelves', x: 5, y: 5, width: 86, height: 24, alpha: 0.9 },
        { key: 'window-bank', x: 3, y: 4, width: 90, height: 20, alpha: 0.18 },
      ];
    case 'skyGarden':
      return [
        ...structuralFrame(0.44),
        { key: 'garden-canopy', x: 3, y: 4, width: 90, height: 25, alpha: 0.95 },
      ];
    case 'observation':
      return [
        ...structuralFrame(0.52),
        { key: 'window-bank', x: 2, y: 3, width: 92, height: 22, alpha: 0.46 },
        { key: 'observation-scope', x: 5, y: 5, width: 86, height: 24, alpha: 0.9 },
      ];
    case 'conference':
      return [
        ...structuralFrame(0.55),
        { key: 'conference-table', x: 5, y: 6, width: 86, height: 23, alpha: 0.9 },
      ];
    case 'clinic':
      return [
        ...structuralFrame(0.56),
        { key: 'clinic-cross', x: 5, y: 5, width: 86, height: 24, alpha: 0.9 },
      ];
    case 'gallery':
      return [
        ...structuralFrame(0.52),
        { key: 'gallery-frame', x: 5, y: 5, width: 86, height: 24, alpha: 0.9 },
      ];
    case 'luxurySuite':
      return [
        ...structuralFrame(0.54),
        { key: 'window-bank', x: 4, y: 6, width: 88, height: 19, alpha: state.night ? 0.2 : 0.28 },
        { key: 'luxury-sofa', x: 5, y: 5, width: 86, height: 24, alpha: 0.9 },
        { key: 'lamp', x: 78, y: 4, width: 13, height: 24, alpha: state.night ? 0.86 : 0.46 },
      ];
    case 'weatherCore':
      return [
        ...structuralFrame(0.6),
        { key: 'weather-array', x: 5, y: 4, width: 86, height: 25, alpha: 0.94 },
        { key: 'utility-pipes', x: 4, y: 13, width: 88, height: 14, alpha: 0.32 },
      ];
    default:
      return [];
  }
}
