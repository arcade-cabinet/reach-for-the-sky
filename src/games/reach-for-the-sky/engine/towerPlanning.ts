import { BUILDINGS, type BuildingData, type BuildingId, CONFIG, type SkyState } from "./types";

const FLOOR_COUNT = 11;
const CORE_BUILDING_TYPES = new Set<BuildingId>(["elevator", "stairs"]);
const NON_OCCUPYING_TYPES = new Set<BuildingId>(["floor"]);
const COMPACT_BAYS = [-4.7, -2.7, 0.9, 2.7] as const;
const LARGE_BAYS = [-4.7, 1.1] as const;

export function createInitialSkyState(): SkyState {
  return {
    funds: CONFIG.STARTING_FUNDS,
    tick: 500,
    day: 1,
    speed: 1,
    population: 0,
    stars: 1,
  };
}

export function createStarterTower(): BuildingData[] {
  const floorSlabs = Array.from({ length: FLOOR_COUNT }, (_, y) => ({
    id: `floor-${y}`,
    type: "floor" as const,
    x: -5,
    y,
    w: 10,
    h: 0.16,
    dirt: 0,
  }));

  return [
    ...floorSlabs,
    { id: "lobby-core", type: "lobby", x: -4.7, y: 0, w: 3.2, h: 1, dirt: 0 },
    { id: "elevator-core", type: "elevator", x: -0.55, y: 0, w: 0.9, h: FLOOR_COUNT, dirt: 0 },
    { id: "stairs-core", type: "stairs", x: 4.05, y: 0, w: 0.75, h: FLOOR_COUNT, dirt: 0 },
    { id: "office-seed-1", type: "office", x: -4.7, y: 1, w: 2, h: 1, dirt: 0 },
    { id: "condo-seed-1", type: "condo", x: 0.9, y: 1, w: 2, h: 1, dirt: 0 },
    { id: "cafe-seed-1", type: "cafe", x: -4.7, y: 2, w: 3, h: 1, dirt: 0 },
    { id: "hotel-seed-1", type: "hotel", x: 1.1, y: 2, w: 2, h: 1, dirt: 0 },
    { id: "maint-seed-1", type: "maint", x: -2.7, y: 3, w: 2, h: 1, dirt: 0 },
  ];
}

export function calculatePopulation(buildings: BuildingData[]) {
  return buildings.reduce((total, building) => total + (BUILDINGS[building.type].pop ?? 0), 0);
}

export function calculateDailyRevenue(buildings: BuildingData[]) {
  return buildings.reduce(
    (total, building) =>
      total + (BUILDINGS[building.type].rent ?? 0) + (BUILDINGS[building.type].income ?? 0),
    0
  );
}

export function calculateMaintenanceCoverage(buildings: BuildingData[]) {
  const occupiedRooms = buildings.filter(
    (building) => BUILDINGS[building.type].cat === "room" || BUILDINGS[building.type].cat === "com"
  ).length;
  if (occupiedRooms === 0) return 100;

  const maintCapacity = buildings.filter((building) => building.type === "maint").length * 6;
  return Math.min(100, Math.round((maintCapacity / occupiedRooms) * 100));
}

export function calculateTowerRating(buildings: BuildingData[]) {
  const population = calculatePopulation(buildings);
  const commercialMix = buildings.filter(
    (building) => BUILDINGS[building.type].cat === "com"
  ).length;
  const maintenanceCoverage = calculateMaintenanceCoverage(buildings);
  const rawRating = 1 + population / 24 + commercialMix * 0.35 + maintenanceCoverage / 42;

  return Math.max(1, Math.min(5, Math.round(rawRating)));
}

export function advanceSkyState(state: SkyState, buildings: BuildingData[], ticks = 1): SkyState {
  let nextTick = state.tick + Math.max(1, ticks) * state.speed;
  let nextDay = state.day;
  let nextFunds = state.funds;
  const stars = calculateTowerRating(buildings);
  const dailyRevenue = Math.floor(calculateDailyRevenue(buildings) * (1 + stars * 0.04));

  while (nextTick >= CONFIG.DAY_TICKS) {
    nextTick -= CONFIG.DAY_TICKS;
    nextDay += 1;
    nextFunds += dailyRevenue;
  }

  return {
    ...state,
    day: nextDay,
    funds: nextFunds,
    population: calculatePopulation(buildings),
    stars,
    tick: nextTick,
  };
}

export function findNextPlacement(buildings: BuildingData[], type: BuildingId) {
  const info = BUILDINGS[type];
  const width = info.w ?? 1;
  const height = type === "elevator" || type === "stairs" ? FLOOR_COUNT : 1;
  const bayOptions = width >= 3 ? LARGE_BAYS : COMPACT_BAYS;

  for (let y = 1; y < FLOOR_COUNT; y++) {
    for (const x of bayOptions) {
      const candidate = { x, y, w: width, h: height };
      if (!intersectsOccupiedBuilding(candidate, buildings)) {
        return candidate;
      }
    }
  }

  return null;
}

export function createPlacedBuilding(
  buildings: BuildingData[],
  type: BuildingId,
  id = `${type}-${buildings.length + 1}`
): BuildingData | null {
  const placement = findNextPlacement(buildings, type);
  if (!placement) return null;

  return {
    id,
    type,
    ...placement,
    dirt: 0,
  };
}

export function canAffordBuilding(state: SkyState, type: BuildingId) {
  return state.funds >= BUILDINGS[type].cost;
}

function intersectsOccupiedBuilding(
  candidate: Pick<BuildingData, "x" | "y" | "w" | "h">,
  buildings: BuildingData[]
) {
  return buildings.some((building) => {
    if (NON_OCCUPYING_TYPES.has(building.type)) return false;
    if (building.type === "lobby" && candidate.y > 0) return false;
    if (CORE_BUILDING_TYPES.has(building.type)) {
      return rectanglesOverlap(candidate, building);
    }
    return rectanglesOverlap(candidate, building);
  });
}

function rectanglesOverlap(
  a: Pick<BuildingData, "x" | "y" | "w" | "h">,
  b: Pick<BuildingData, "x" | "y" | "w" | "h">
) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
