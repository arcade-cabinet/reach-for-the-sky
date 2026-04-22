import { trait } from "koota";
import { createInitialSkyState, createStarterTower } from "../engine/towerPlanning";
import type { BuildingData } from "../engine/types";

export const SkyTrait = trait(() => createInitialSkyState());

export const TowerTrait = trait(() => ({
  buildings: createStarterTower() as BuildingData[],
}));
