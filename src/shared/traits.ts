import { trait } from "koota";
import type { GamePhase } from "./types";

export const ScoreTrait = trait({ value: 0, label: "SCORE" });
export const PhaseTrait = trait({ phase: "menu" as GamePhase });
export const TimerTrait = trait({ elapsedMs: 0, remainingMs: 0, label: "TIME" });
