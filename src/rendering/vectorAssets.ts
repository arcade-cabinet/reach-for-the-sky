import { Assets, type Texture } from 'pixi.js';
import type { BuildingId } from '@/simulation/types';

export type RoomVectorKey =
  | 'floor'
  | 'lobby'
  | 'office-lit'
  | 'office-dim'
  | 'condo-day'
  | 'condo-night'
  | 'cafe'
  | 'hotel-day'
  | 'hotel-night'
  | 'maintenance';

export type CoreVectorKey = 'shaft' | 'elevator-car';
export type AgentVectorKey =
  | 'agent-worker'
  | 'agent-guest'
  | 'agent-visitor'
  | 'agent-janitor'
  | 'agent-waiting-ring';
export type UiVectorKey =
  | 'ghost-valid'
  | 'ghost-invalid'
  | 'lens-maintenance'
  | 'lens-transit'
  | 'lens-value'
  | 'lens-sentiment'
  | 'lens-privacy'
  | 'lens-safety'
  | 'lens-event';
export type EnvironmentVectorKey = 'cloud-bank' | 'skyline-tower' | 'air-rights-marker';
export type ElementVectorKey =
  | 'window-bank'
  | 'facade-rib'
  | 'floor-slab'
  | 'ceiling-rail'
  | 'room-divider'
  | 'office-desk'
  | 'plant'
  | 'cafe-awning'
  | 'cafe-counter'
  | 'cafe-table'
  | 'cafe-sign'
  | 'bed'
  | 'lamp'
  | 'tv-console'
  | 'lobby-door'
  | 'service-wrench'
  | 'service-panel'
  | 'service-stripes'
  | 'utility-pipes'
  | 'restroom-fixtures'
  | 'security-desk'
  | 'event-stage'
  | 'retail-shelves'
  | 'garden-canopy'
  | 'observation-scope'
  | 'conference-table'
  | 'clinic-cross'
  | 'gallery-frame'
  | 'luxury-sofa'
  | 'weather-array';
export type VectorKey =
  | RoomVectorKey
  | CoreVectorKey
  | AgentVectorKey
  | UiVectorKey
  | EnvironmentVectorKey
  | ElementVectorKey;

export const VECTOR_SOURCES: Record<VectorKey, string> = {
  floor: 'assets/vectors/rooms/floor.svg',
  lobby: 'assets/vectors/rooms/lobby.svg',
  'office-lit': 'assets/vectors/rooms/office-lit.svg',
  'office-dim': 'assets/vectors/rooms/office-dim.svg',
  'condo-day': 'assets/vectors/rooms/condo-day.svg',
  'condo-night': 'assets/vectors/rooms/condo-night.svg',
  cafe: 'assets/vectors/rooms/cafe.svg',
  'hotel-day': 'assets/vectors/rooms/hotel-day.svg',
  'hotel-night': 'assets/vectors/rooms/hotel-night.svg',
  maintenance: 'assets/vectors/rooms/maintenance.svg',
  shaft: 'assets/vectors/cores/shaft.svg',
  'elevator-car': 'assets/vectors/cores/elevator-car.svg',
  'agent-worker': 'assets/vectors/agents/worker.svg',
  'agent-guest': 'assets/vectors/agents/guest.svg',
  'agent-visitor': 'assets/vectors/agents/visitor.svg',
  'agent-janitor': 'assets/vectors/agents/janitor.svg',
  'agent-waiting-ring': 'assets/vectors/agents/waiting-ring.svg',
  'ghost-valid': 'assets/vectors/ui/ghost-valid.svg',
  'ghost-invalid': 'assets/vectors/ui/ghost-invalid.svg',
  'lens-maintenance': 'assets/vectors/ui/lens-maintenance.svg',
  'lens-transit': 'assets/vectors/ui/lens-transit.svg',
  'lens-value': 'assets/vectors/ui/lens-value.svg',
  'lens-sentiment': 'assets/vectors/ui/lens-sentiment.svg',
  'lens-privacy': 'assets/vectors/ui/lens-privacy.svg',
  'lens-safety': 'assets/vectors/ui/lens-safety.svg',
  'lens-event': 'assets/vectors/ui/lens-event.svg',
  'cloud-bank': 'assets/vectors/environment/cloud-bank.svg',
  'skyline-tower': 'assets/vectors/environment/skyline-tower.svg',
  'air-rights-marker': 'assets/vectors/environment/air-rights-marker.svg',
  'window-bank': 'assets/vectors/elements/window-bank.svg',
  'facade-rib': 'assets/vectors/elements/facade-rib.svg',
  'floor-slab': 'assets/vectors/elements/floor-slab.svg',
  'ceiling-rail': 'assets/vectors/elements/ceiling-rail.svg',
  'room-divider': 'assets/vectors/elements/room-divider.svg',
  'office-desk': 'assets/vectors/elements/office-desk.svg',
  plant: 'assets/vectors/elements/plant.svg',
  'cafe-awning': 'assets/vectors/elements/cafe-awning.svg',
  'cafe-counter': 'assets/vectors/elements/cafe-counter.svg',
  'cafe-table': 'assets/vectors/elements/cafe-table.svg',
  'cafe-sign': 'assets/vectors/elements/cafe-sign.svg',
  bed: 'assets/vectors/elements/bed.svg',
  lamp: 'assets/vectors/elements/lamp.svg',
  'tv-console': 'assets/vectors/elements/tv-console.svg',
  'lobby-door': 'assets/vectors/elements/lobby-door.svg',
  'service-wrench': 'assets/vectors/elements/service-wrench.svg',
  'service-panel': 'assets/vectors/elements/service-panel.svg',
  'service-stripes': 'assets/vectors/elements/service-stripes.svg',
  'utility-pipes': 'assets/vectors/elements/utility-pipes.svg',
  'restroom-fixtures': 'assets/vectors/elements/restroom-fixtures.svg',
  'security-desk': 'assets/vectors/elements/security-desk.svg',
  'event-stage': 'assets/vectors/elements/event-stage.svg',
  'retail-shelves': 'assets/vectors/elements/retail-shelves.svg',
  'garden-canopy': 'assets/vectors/elements/garden-canopy.svg',
  'observation-scope': 'assets/vectors/elements/observation-scope.svg',
  'conference-table': 'assets/vectors/elements/conference-table.svg',
  'clinic-cross': 'assets/vectors/elements/clinic-cross.svg',
  'gallery-frame': 'assets/vectors/elements/gallery-frame.svg',
  'luxury-sofa': 'assets/vectors/elements/luxury-sofa.svg',
  'weather-array': 'assets/vectors/elements/weather-array.svg',
};

let sharedLoad: Promise<Map<VectorKey, Texture>> | null = null;

function withBase(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

function roomKey(type: BuildingId, lit: boolean, night: boolean): RoomVectorKey | null {
  switch (type) {
    case 'floor':
      return 'floor';
    case 'lobby':
      return 'lobby';
    case 'office':
      return lit ? 'office-lit' : 'office-dim';
    case 'condo':
      return night ? 'condo-night' : 'condo-day';
    case 'cafe':
      return 'cafe';
    case 'hotel':
      return night ? 'hotel-night' : 'hotel-day';
    case 'maint':
      return 'maintenance';
    default:
      return null;
  }
}

export class VectorAssetLibrary {
  private textures = new Map<VectorKey, Texture>();

  async load(): Promise<void> {
    sharedLoad ??= Promise.all(
      Object.entries(VECTOR_SOURCES).map(async ([key, source]) => {
        const texture = await Assets.load<Texture>(withBase(source));
        return [key as VectorKey, texture] as const;
      }),
    ).then((entries) => new Map(entries));
    this.textures = await sharedLoad;
  }

  roomTexture(type: BuildingId, lit: boolean, night: boolean): Texture | null {
    const key = roomKey(type, lit, night);
    return key ? (this.textures.get(key) ?? null) : null;
  }

  coreTexture(key: CoreVectorKey): Texture | null {
    return this.textures.get(key) ?? null;
  }

  agentTexture(key: AgentVectorKey): Texture | null {
    return this.textures.get(key) ?? null;
  }

  uiTexture(key: UiVectorKey): Texture | null {
    return this.textures.get(key) ?? null;
  }

  environmentTexture(key: EnvironmentVectorKey): Texture | null {
    return this.textures.get(key) ?? null;
  }

  elementTexture(key: ElementVectorKey): Texture | null {
    return this.textures.get(key) ?? null;
  }
}
