export interface Vec2 {
  x: number;
  y: number;
}

export type BuildingId =
  | "lobby"
  | "floor"
  | "elevator"
  | "stairs"
  | "office"
  | "condo"
  | "cafe"
  | "hotel"
  | "maint";

export interface BuildingType {
  id: BuildingId;
  cat: "infra" | "trans" | "room" | "com" | "fac";
  name: string;
  cost: number;
  color: string;
  drag: "area" | "v";
  w?: number;
  pop?: number;
  rent?: number;
  sale?: number;
  income?: number;
  cap?: number;
  type?: string;
  speed?: number;
}

export interface BuildingData {
  id: string;
  type: BuildingId;
  x: number;
  y: number;
  w: number;
  h: number;
  dirt: number;
}

export const BUILDINGS: Record<BuildingId, BuildingType> = {
  lobby: { id: "lobby", cat: "infra", name: "Lobby", cost: 1500, color: "#CFD8DC", drag: "area" },
  floor: { id: "floor", cat: "infra", name: "Floor", cost: 500, color: "#455A64", drag: "area" },
  elevator: {
    id: "elevator",
    cat: "trans",
    name: "Elevator",
    cost: 25000,
    color: "#D32F2F",
    drag: "v",
    speed: 10,
    cap: 20,
  },
  stairs: {
    id: "stairs",
    cat: "trans",
    name: "Stairs",
    cost: 1000,
    color: "#8D6E63",
    drag: "v",
    speed: 2,
    cap: 50,
  },
  office: {
    id: "office",
    cat: "room",
    name: "Office",
    cost: 12000,
    w: 2,
    color: "#1E88E5",
    pop: 6,
    rent: 1500,
    type: "work",
    drag: "area",
  },
  condo: {
    id: "condo",
    cat: "room",
    name: "Condo",
    cost: 8000,
    w: 2,
    color: "#43A047",
    pop: 3,
    sale: 12000,
    type: "home",
    drag: "area",
  },
  cafe: {
    id: "cafe",
    cat: "com",
    name: "Café",
    cost: 15000,
    w: 3,
    color: "#FB8C00",
    cap: 20,
    income: 80,
    type: "food",
    drag: "area",
  },
  hotel: {
    id: "hotel",
    cat: "com",
    name: "Hotel",
    cost: 30000,
    w: 2,
    color: "#8E24AA",
    cap: 2,
    income: 300,
    type: "sleep",
    drag: "area",
  },
  maint: {
    id: "maint",
    cat: "fac",
    name: "Maint.",
    cost: 15000,
    w: 2,
    color: "#FDD835",
    pop: 2,
    type: "service",
    drag: "area",
  },
};

export const CONFIG = {
  CELL_SIZE: { w: 3.2, h: 2.4 }, // Adjusted for 3D world space
  DAY_TICKS: 2000,
  STARTING_FUNDS: 200000,
};

export interface SkyState {
  funds: number;
  tick: number;
  day: number;
  speed: number;
  population: number;
  stars: number;
}
