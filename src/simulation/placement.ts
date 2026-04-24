import { generateId, hashToUnit } from './random';
import {
  BUILDINGS,
  type BuildDrag,
  type BuildingId,
  type BuildPreview,
  type BuildPreviewItem,
  type EconomyState,
  type PlaceBuildResult,
  STAR_REQUIREMENTS,
  type TowerRoom,
  type TowerState,
} from './types';

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function roomCovers(room: TowerRoom, x: number, y: number): boolean {
  return x >= room.x && x < room.x + room.width && y >= room.y && y < room.y + room.height;
}

function hasRoom(tower: TowerState, x: number, y: number, type: BuildingId): boolean {
  return tower.rooms.some((room) => room.type === type && roomCovers(room, x, y));
}

/**
 * Infra structural support check: a floor at height y > 0 must have a floor or
 * lobby at (x, y-1) for every x in its span. Prevents placing floating slabs
 * in midair — the cutaway now reads as a continuous structure from the ground
 * line up, not as disconnected shelves.
 *
 * For multi-row area drags, sibling items in the same drag count as support
 * so a rectangle spanning y=1..y=5 over a ground-line lobby validates as a
 * single atomic placement (the bottom row is supported by the lobby; each
 * higher row is supported by its sibling below).
 */
function hasInfraSupportBeneath(
  tower: TowerState,
  item: Pick<BuildPreviewItem, 'x' | 'y' | 'width'>,
  siblings: readonly Pick<BuildPreviewItem, 'x' | 'y' | 'width'>[] = [],
): boolean {
  if (item.y <= 0) return true;
  const below = item.y - 1;
  for (let x = item.x; x < item.x + item.width; x += 1) {
    const fromTower = hasRoom(tower, x, below, 'floor') || hasRoom(tower, x, below, 'lobby');
    if (fromTower) continue;
    const fromSibling = siblings.some(
      (sibling) => sibling.y === below && x >= sibling.x && x < sibling.x + sibling.width,
    );
    if (!fromSibling) return false;
  }
  return true;
}

function overlapsCategory(
  tower: TowerState,
  item: Pick<BuildPreviewItem, 'x' | 'y' | 'width' | 'height'>,
  predicate: (room: TowerRoom) => boolean,
): TowerRoom | undefined {
  return tower.rooms.find((room) => predicate(room) && rectsOverlap(item, room));
}

function createRawPreviewItems(toolId: BuildingId, drag: BuildDrag): BuildPreviewItem[] {
  const tool = BUILDINGS[toolId];
  const minX = Math.min(drag.start.gx, drag.end.gx);
  const maxX = Math.max(drag.start.gx, drag.end.gx);
  const minY = Math.min(drag.start.gy, drag.end.gy);
  const maxY = Math.max(drag.start.gy, drag.end.gy);
  const items: BuildPreviewItem[] = [];

  if (toolId === 'lobby') {
    const height = Math.min(3, Math.max(1, maxY - minY + 1));
    for (let x = minX; x <= maxX; x += 1) {
      items.push({ x, y: minY, width: 1, height, valid: true, reason: '' });
    }
    return items;
  }

  if (tool.drag === 'v') {
    for (let y = minY; y <= maxY; y += 1) {
      items.push({ x: drag.start.gx, y, width: 1, height: 1, valid: true, reason: '' });
    }
    return items;
  }

  const width = toolId === 'floor' ? 1 : (tool.width ?? 1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += width) {
      if (x + width - 1 <= maxX) items.push({ x, y, width, height: 1, valid: true, reason: '' });
    }
  }

  return items;
}

function validateItem(
  tower: TowerState,
  toolId: BuildingId,
  item: BuildPreviewItem,
  siblings: readonly BuildPreviewItem[] = [],
): BuildPreviewItem {
  const tool = BUILDINGS[toolId];
  const overlappingInfra = overlapsCategory(
    tower,
    item,
    (room) => BUILDINGS[room.type].cat === 'infra',
  );
  const overlappingOccupant = overlapsCategory(
    tower,
    item,
    (room) => BUILDINGS[room.type].cat !== 'infra',
  );

  let valid = false;
  let reason = '';

  if (item.y < 0) reason = 'Cannot build underground';
  else if (tool.cat === 'infra') {
    if (overlappingInfra) reason = 'Infrastructure already exists here';
    else if (toolId === 'lobby' && item.y !== 0) reason = 'Lobbies must touch the ground line';
    else if (toolId === 'floor' && !hasInfraSupportBeneath(tower, item, siblings))
      reason = 'Floors need a floor or lobby directly beneath';
    else valid = true;
  } else if (tool.cat === 'trans') {
    if (overlappingOccupant) reason = 'Transit shaft already occupies this bay';
    else if (overlappingInfra) valid = true;
    else reason = 'Shafts must pass through floors or lobbies';
  } else {
    let hasFullFloor = true;
    for (let x = item.x; x < item.x + item.width; x += 1) {
      if (!hasRoom(tower, x, item.y, 'floor')) {
        hasFullFloor = false;
        break;
      }
    }
    if (item.y === 0) reason = 'Rooms cannot be on the ground floor; use lobbies';
    else if (!hasFullFloor) reason = 'Needs complete floor beneath';
    else if (overlappingOccupant) reason = 'Space is already occupied';
    else valid = true;
  }

  return { ...item, valid, reason };
}

export function createBuildPreview(
  tower: TowerState,
  economy: EconomyState,
  toolId: BuildingId | null,
  drag: BuildDrag | null,
): BuildPreview {
  if (!toolId || !drag) return { items: [], valid: false, error: null, cost: 0, saleProfit: 0 };

  const tool = BUILDINGS[toolId];
  const rawItems = createRawPreviewItems(toolId, drag);
  const items = rawItems.map((item) => validateItem(tower, toolId, item, rawItems));
  const invalid = items.find((item) => !item.valid);
  const cost = items.reduce(
    (total, item) => total + tool.cost * (toolId === 'lobby' ? item.height : 1),
    0,
  );
  const saleProfit = items.reduce((total) => total + (tool.sale ?? 0), 0);
  const hasFunds = economy.funds >= cost;

  return {
    items,
    valid: items.length > 0 && !invalid && hasFunds,
    error: invalid?.reason ?? (hasFunds ? null : 'Insufficient funds'),
    cost,
    saleProfit,
  };
}

export function placeBuild(
  tower: TowerState,
  economy: EconomyState,
  toolId: BuildingId,
  drag: BuildDrag,
  tutorialStep: number,
): PlaceBuildResult {
  const preview = createBuildPreview(tower, economy, toolId, drag);
  if (!preview.valid) {
    return {
      ok: false,
      message: preview.error ?? 'Invalid placement',
      tower,
      economy,
      tutorialStep,
    };
  }

  const tool = BUILDINGS[toolId];
  const nextTower: TowerState = {
    ...tower,
    rooms: [...tower.rooms],
    shafts: [...tower.shafts],
    elevators: [...tower.elevators],
    particles: [
      ...tower.particles,
      {
        id: generateId('particle'),
        x: preview.items[0]?.x ?? 0,
        y: preview.items[0]?.y ?? 0,
        text: preview.saleProfit > 0 ? `+$${preview.saleProfit}` : `-$${preview.cost}`,
        color: preview.saleProfit > 0 ? '#78B185' : '#C47B7D',
        life: 55,
        floatSpeed: 0.45,
      },
    ],
  };

  for (const item of preview.items) {
    if (tool.cat === 'trans') {
      const existingShaft = nextTower.shafts.find((shaft) => shaft.x === item.x);
      if (existingShaft) {
        existingShaft.min = Math.min(existingShaft.min, item.y);
        existingShaft.max = Math.max(existingShaft.max, item.y);
      } else {
        const shaft = { id: generateId(`${toolId}-shaft`), x: item.x, min: item.y, max: item.y };
        nextTower.shafts.push(shaft);
        nextTower.elevators.push({
          id: generateId(`${toolId}-car`),
          shaftId: shaft.id,
          x: item.x,
          y: item.y,
          floor: item.y,
          min: item.y,
          max: item.y,
          state: 'idle',
          riders: [],
          timer: 0,
          targetY: null,
        });
      }

      const car = nextTower.elevators.find((elevator) => elevator.x === item.x);
      if (car) {
        car.min = Math.min(car.min, item.y);
        car.max = Math.max(car.max, item.y);
      }
    }

    const id = generateId(toolId);
    nextTower.rooms.push({
      id,
      type: toolId,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      dirt: 0,
      seed: hashToUnit(`${toolId}:${item.x}:${item.y}:${item.width}:${item.height}`),
    });
  }

  let nextTutorialStep = tutorialStep;
  if (tutorialStep === 0 && toolId === 'lobby') nextTutorialStep = 1;
  else if (tutorialStep === 1 && toolId === 'floor') nextTutorialStep = 2;
  else if (tutorialStep === 2 && toolId === 'office') nextTutorialStep = 3;
  else if (tutorialStep === 3 && tool.cat === 'trans') nextTutorialStep = 4;

  const nextEconomy = recalculateEconomy(
    nextTower,
    { ...economy, funds: economy.funds - preview.cost + preview.saleProfit },
    nextTower.agents.length,
  );
  if (nextEconomy.stars > economy.stars) {
    nextTower.notifications.push({
      id: generateId('notice'),
      text: `${STAR_REQUIREMENTS[nextEconomy.stars]?.title ?? 'New permit'} unlocked. City grant added.`,
      type: 'success',
      time: 360,
    });
    nextTower.particles.push({
      id: generateId('particle'),
      x: preview.items[0]?.x ?? 0,
      y: (preview.items[0]?.y ?? 0) + 2,
      text: 'PERMIT',
      color: '#D3B15D',
      life: 90,
      floatSpeed: 0.28,
    });
  }

  return {
    ok: true,
    message:
      preview.saleProfit > 0 ? `Sold units for $${preview.saleProfit}` : `Built ${tool.name}`,
    tower: nextTower,
    economy: nextEconomy,
    tutorialStep: nextTutorialStep,
  };
}

export function calculateDailyRevenue(rooms: TowerRoom[], rentEfficiency = 100): number {
  const baseline = rooms.reduce((total, room) => {
    const def = BUILDINGS[room.type];
    if (room.type === 'office' && room.dirt > 50) return total + Math.floor((def.rent ?? 0) / 2);
    if (room.type === 'hotel') return total + Math.floor((def.income ?? 0) * 0.65);
    if (def.income) return total + Math.floor(def.income * 0.8);
    return total + (def.rent ?? 0);
  }, 0);
  return Math.max(0, Math.floor((baseline * rentEfficiency) / 100));
}

export function calculateDailyOperatingCosts(
  rooms: TowerRoom[],
  metrics: Pick<EconomyState, 'population' | 'transitPressure' | 'servicePressure'>,
): number {
  const occupiedRooms = rooms.filter((room) => {
    const category = BUILDINGS[room.type].cat;
    return category !== 'infra' && category !== 'trans';
  }).length;
  const serviceRooms =
    rooms.filter((room) => ['maint', 'security', 'clinic', 'weatherCore'].includes(room.type))
      .length * 120;
  const infrastructure = rooms.filter((room) => BUILDINGS[room.type].cat === 'infra').length * 4;
  const height = rooms.reduce((max, room) => Math.max(max, room.y + room.height), 0);
  // Utility rooms (utilities + mechanical) amortize the per-floor height cost —
  // they represent HVAC / plumbing / electrical risers that let a tall tower
  // stay economic. Each one offsets 4 floors' worth of height overhead, capped
  // at the actual height cost so stacking beyond need can't drive costs negative.
  const utilityRooms = rooms.filter((room) => BUILDINGS[room.type].cat === 'utility').length;
  const heightCost = height * 30;
  const utilityRelief = Math.min(heightCost, utilityRooms * 120);
  const operatingLoad =
    occupiedRooms * 18 +
    infrastructure +
    serviceRooms +
    metrics.population * 4 +
    metrics.transitPressure * 4 +
    metrics.servicePressure * 5 +
    heightCost -
    utilityRelief;
  return Math.max(0, Math.round(operatingLoad));
}

export function calculateCommittedPopulation(rooms: TowerRoom[]): number {
  return rooms.reduce((total, room) => {
    const def = BUILDINGS[room.type];
    if (def.cat === 'infra' || def.cat === 'trans' || def.cat === 'utility') return total;
    if (room.type === 'hotel') return total + (def.cap ?? 0);
    if (room.type === 'cafe') return total + Math.ceil((def.cap ?? 0) / 4);
    if (def.cap) return total + Math.ceil(def.cap / 6);
    return total + (def.pop ?? 0);
  }, 0);
}

export function calculateCleanliness(rooms: TowerRoom[]): number {
  const occupied = rooms.filter((room) => {
    const category = BUILDINGS[room.type].cat;
    return category !== 'infra' && category !== 'trans' && category !== 'utility';
  });
  if (occupied.length === 0) return 100;
  const avg = occupied.reduce((sum, room) => sum + room.dirt, 0) / occupied.length;
  return Math.max(0, Math.min(100, Math.round(100 - avg)));
}

export function calculateTowerValue(rooms: TowerRoom[]): number {
  return rooms.reduce((total, room) => {
    const def = BUILDINGS[room.type];
    const baseCost = room.type === 'lobby' ? def.cost * room.height : def.cost;
    const premium = ['infra', 'trans', 'utility'].includes(def.cat) ? 1 : 1.35;
    return total + Math.round(baseCost * premium);
  }, 0);
}

export function calculateTransitPressure(tower: TowerState, population: number): number {
  if (population === 0) return 0;
  const elevatorCapacity = tower.elevators.length * (BUILDINGS.elevator.cap ?? 20);
  if (elevatorCapacity === 0) return 100;
  const waitingAgents = tower.agents.filter((agent) => agent.state === 'waiting');
  const waitingPressure = waitingAgents.length * 8;
  const waitBurden = waitingAgents.reduce(
    (total, agent) => total + Math.min(24, Math.floor((agent.waitTicks ?? 0) / 20)),
    0,
  );
  const blockedPressure =
    tower.agents.filter((agent) => agent.routeStatus === 'blocked').length * 18;
  const capacityPressure = (population / elevatorCapacity) * 34;
  return Math.max(
    0,
    Math.min(100, Math.round(capacityPressure + waitingPressure + waitBurden + blockedPressure)),
  );
}

export function calculateServicePressure(tower: TowerState): number {
  const dirtyRooms = tower.rooms.filter((room) => {
    const category = BUILDINGS[room.type].cat;
    return room.dirt > 35 && category !== 'infra' && category !== 'trans';
  }).length;
  const janitorCapacity =
    tower.rooms.filter((room) => room.type === 'maint').length * (BUILDINGS.maint.pop ?? 0) * 2 +
    tower.rooms.filter((room) => room.type === 'restroom').length +
    tower.rooms.filter((room) => room.type === 'clinic').length * 2;
  if (dirtyRooms === 0) return 0;
  if (janitorCapacity === 0) return 100;
  return Math.max(0, Math.min(100, Math.round((dirtyRooms / janitorCapacity) * 60)));
}

export function calculateTenantSatisfaction(
  cleanliness: number,
  transitPressure: number,
  servicePressure: number,
): number {
  const cleanlinessPenalty = (100 - cleanliness) * 0.35;
  const transitPenalty = transitPressure * 0.32;
  const servicePenalty = servicePressure * 0.28;
  return Math.max(
    0,
    Math.min(100, Math.round(100 - cleanlinessPenalty - transitPenalty - servicePenalty)),
  );
}

export function calculateRentEfficiency(tenantSatisfaction: number): number {
  return Math.max(60, Math.min(100, Math.round(60 + tenantSatisfaction * 0.4)));
}

export function calculateOperationalMetrics(
  tower: TowerState,
  population = calculateCommittedPopulation(tower.rooms),
): Pick<
  EconomyState,
  'cleanliness' | 'transitPressure' | 'servicePressure' | 'tenantSatisfaction' | 'rentEfficiency'
> {
  const cleanliness = calculateCleanliness(tower.rooms);
  const transitPressure = calculateTransitPressure(tower, population);
  const servicePressure = calculateServicePressure(tower);
  const tenantSatisfaction = calculateTenantSatisfaction(
    cleanliness,
    transitPressure,
    servicePressure,
  );
  return {
    cleanliness,
    transitPressure,
    servicePressure,
    tenantSatisfaction,
    rentEfficiency: calculateRentEfficiency(tenantSatisfaction),
  };
}

export function recalculateEconomy(
  tower: TowerState,
  economy: EconomyState,
  activeAgents = tower.agents.length,
): EconomyState {
  const population = calculateCommittedPopulation(tower.rooms);
  const operational = calculateOperationalMetrics(tower, population);
  let stars = economy.stars;
  const nextRequirement = STAR_REQUIREMENTS[stars + 1];
  let funds = economy.funds;
  if (nextRequirement && population >= nextRequirement.pop && funds >= nextRequirement.funds) {
    stars += 1;
    funds += nextRequirement.reward;
  }

  const dailyRevenue = calculateDailyRevenue(tower.rooms, operational.rentEfficiency);
  const dailyCosts = calculateDailyOperatingCosts(tower.rooms, {
    population,
    transitPressure: operational.transitPressure,
    servicePressure: operational.servicePressure,
  });

  return {
    ...economy,
    funds,
    population,
    activeAgents,
    stars,
    ...operational,
    dailyRevenue,
    dailyCosts,
    netRevenue: dailyRevenue - dailyCosts,
    towerValue: calculateTowerValue(tower.rooms),
  };
}
