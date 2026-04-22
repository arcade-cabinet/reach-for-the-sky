import { PhaseTrait, ScoreTrait, TimerTrait } from "@logic/shared";
import { createWorld } from "koota";
import { SkyTrait, TowerTrait } from "./traits";

export const skyWorld = createWorld();
export const skyEntity = skyWorld.spawn(
  PhaseTrait({ phase: "menu" }),
  ScoreTrait({ value: 0, label: "FUNDS" }),
  TimerTrait({ elapsedMs: 0, remainingMs: 0, label: "TICK" }),
  SkyTrait(),
  TowerTrait()
);
