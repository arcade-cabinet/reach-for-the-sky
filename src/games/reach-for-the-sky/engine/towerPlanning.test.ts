import { describe, expect, test } from "vitest";
import {
  advanceSkyState,
  calculateDailyRevenue,
  calculateMaintenanceCoverage,
  calculatePopulation,
  calculateTowerRating,
  canAffordBuilding,
  createInitialSkyState,
  createPlacedBuilding,
  createStarterTower,
} from "./towerPlanning";
import { BUILDINGS, CONFIG, type SkyState } from "./types";

const skyState: SkyState = {
  day: 1,
  funds: CONFIG.STARTING_FUNDS,
  population: 0,
  speed: 1,
  stars: 1,
  tick: 0,
};

describe("tower planning", () => {
  test("creates the same initial sky economy used by the game store", () => {
    expect(createInitialSkyState()).toEqual({
      ...skyState,
      population: 0,
      tick: 500,
    });
  });

  test("creates a playable starter tower with structure, services, and population", () => {
    const tower = createStarterTower();

    expect(tower.some((building) => building.type === "lobby")).toBe(true);
    expect(tower.some((building) => building.type === "elevator")).toBe(true);
    expect(tower.filter((building) => building.type === "floor")).toHaveLength(11);
    expect(calculatePopulation(tower)).toBeGreaterThan(0);
    expect(calculateDailyRevenue(tower)).toBeGreaterThan(0);
    expect(calculateMaintenanceCoverage(tower)).toBe(100);
    expect(calculateTowerRating(tower)).toBeGreaterThan(1);
  });

  test("places new buildings deterministically in the next free bay", () => {
    const tower = createStarterTower();
    const office = createPlacedBuilding(tower, "office", "office-test");
    expect(office).toMatchObject({ id: "office-test", type: "office", y: 1 });

    const afterOffice = office ? [...tower, office] : tower;
    const condo = createPlacedBuilding(afterOffice, "condo", "condo-test");
    expect(condo).toMatchObject({ id: "condo-test", type: "condo" });
    expect(condo?.x).not.toBe(office?.x);
  });

  test("advances day-cycle economy from occupied tower modules", () => {
    const tower = createStarterTower();
    const next = advanceSkyState({ ...skyState, tick: CONFIG.DAY_TICKS - 1 }, tower, 2);

    expect(next.day).toBe(2);
    expect(next.tick).toBe(1);
    expect(next.population).toBe(calculatePopulation(tower));
    expect(next.stars).toBe(calculateTowerRating(tower));
    expect(next.funds).toBe(
      skyState.funds + Math.floor(calculateDailyRevenue(tower) * (1 + next.stars * 0.04))
    );
  });

  test("checks affordability against the selected module cost", () => {
    expect(canAffordBuilding(skyState, "office")).toBe(true);
    expect(canAffordBuilding({ ...skyState, funds: BUILDINGS.office.cost - 1 }, "office")).toBe(
      false
    );
  });
});
