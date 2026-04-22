export type GamePhase = "menu" | "playing" | "paused" | "gameover" | "win";

export interface GameScore {
  value: number;
  label: string;
}

export interface ContainerSize {
  width: number;
  height: number;
}
