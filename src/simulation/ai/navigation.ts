import { AStar, Edge, Graph, Node, Vector3 } from 'yuka';
import { BUILDINGS, type NavigationWaypoint, type TowerRoom, type TowerState } from '../types';

type NodeKind = 'corridor' | 'lobby' | 'shaft';

class TowerNode extends Node {
  readonly position: Vector3;
  readonly x: number;
  readonly floor: number;
  readonly kind: NodeKind;

  constructor(index: number, x: number, floor: number, kind: NodeKind) {
    super(index);
    this.x = x;
    this.floor = floor;
    this.kind = kind;
    this.position = new Vector3(x, floor * 3, 0);
  }
}

export interface PlannedRoute {
  reachable: boolean;
  waypoints: NavigationWaypoint[];
  cost: number;
  nodeCount: number;
  edgeCount: number;
}

interface BuildGraphResult {
  graph: Graph;
  nodes: Map<string, TowerNode>;
  byIndex: Map<number, TowerNode>;
}

function cellKey(x: number, floor: number): string {
  return `${x}:${floor}`;
}

function roomCovers(room: TowerRoom, x: number, floor: number): boolean {
  return x >= room.x && x < room.x + room.width && floor >= room.y && floor < room.y + room.height;
}

function hasRoomAt(
  rooms: TowerRoom[],
  x: number,
  floor: number,
  predicate: (room: TowerRoom) => boolean,
): boolean {
  return rooms.some((room) => predicate(room) && roomCovers(room, x, floor));
}

function addCell(graphData: BuildGraphResult, x: number, floor: number, kind: NodeKind): TowerNode {
  const key = cellKey(x, floor);
  const existing = graphData.nodes.get(key);
  if (existing) return existing;

  const node = new TowerNode(graphData.byIndex.size, x, floor, kind);
  graphData.nodes.set(key, node);
  graphData.byIndex.set(node.index, node);
  graphData.graph.addNode(node);
  return node;
}

function edgeCost(from: TowerNode, to: TowerNode): number {
  if (from.floor !== to.floor) return 4.5;
  if (from.kind === 'shaft' || to.kind === 'shaft') return 1.25;
  return 1;
}

function getNode(graphData: BuildGraphResult, x: number, floor: number): TowerNode | undefined {
  return graphData.nodes.get(cellKey(x, floor));
}

function nearestNodeOnFloor(
  graphData: BuildGraphResult,
  x: number,
  floor: number,
): TowerNode | undefined {
  let best: TowerNode | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const node of graphData.nodes.values()) {
    if (node.floor !== floor) continue;
    const distance = Math.abs(node.x - x) + (node.kind === 'shaft' ? 0.15 : 0);
    if (distance < bestDistance) {
      best = node;
      bestDistance = distance;
    }
  }
  return best;
}

function addEdgeIfMissing(graph: Graph, from: TowerNode, to: TowerNode): void {
  if (!graph.getEdge(from.index, to.index))
    graph.addEdge(new Edge(from.index, to.index, edgeCost(from, to)));
}

export function buildTowerNavigationGraph(tower: TowerState): BuildGraphResult {
  const graphData: BuildGraphResult = { graph: new Graph(), nodes: new Map(), byIndex: new Map() };
  const rooms = tower.rooms;

  for (const room of rooms) {
    const def = BUILDINGS[room.type];
    if (def.cat !== 'infra' && def.cat !== 'trans') continue;
    for (let x = room.x; x < room.x + room.width; x += 1) {
      for (let floor = room.y; floor < room.y + room.height; floor += 1) {
        const hasTransit = hasRoomAt(
          rooms,
          x,
          floor,
          (candidate) => BUILDINGS[candidate.type].cat === 'trans',
        );
        const kind: NodeKind = hasTransit ? 'shaft' : room.type === 'lobby' ? 'lobby' : 'corridor';
        addCell(graphData, x, floor, kind);
      }
    }
  }

  const floors = new Set<number>();
  for (const node of graphData.nodes.values()) floors.add(node.floor);
  for (const floor of floors) {
    const nodesOnFloor = [...graphData.nodes.values()].filter((node) => node.floor === floor);
    for (const node of nodesOnFloor) {
      const left = getNode(graphData, node.x - 1, floor);
      const right = getNode(graphData, node.x + 1, floor);
      if (left) addEdgeIfMissing(graphData.graph, node, left);
      if (right) addEdgeIfMissing(graphData.graph, node, right);
    }
  }

  for (const shaft of tower.shafts) {
    for (let floor = shaft.min; floor < shaft.max; floor += 1) {
      const from = getNode(graphData, shaft.x, floor);
      const to = getNode(graphData, shaft.x, floor + 1);
      if (from && to) {
        addEdgeIfMissing(graphData.graph, from, to);
        addEdgeIfMissing(graphData.graph, to, from);
      }
    }
  }

  return graphData;
}

export function planAgentRoute(
  tower: TowerState,
  from: { x: number; floor: number },
  to: { x: number; floor: number },
): PlannedRoute {
  const graphData = buildTowerNavigationGraph(tower);
  const source =
    getNode(graphData, Math.round(from.x), Math.round(from.floor)) ??
    nearestNodeOnFloor(graphData, Math.round(from.x), Math.round(from.floor));
  const target =
    getNode(graphData, Math.round(to.x), Math.round(to.floor)) ??
    nearestNodeOnFloor(graphData, Math.round(to.x), Math.round(to.floor));

  if (!source || !target) {
    return {
      reachable: false,
      waypoints: [],
      cost: 0,
      nodeCount: graphData.graph.getNodeCount(),
      edgeCount: graphData.graph.getEdgeCount(),
    };
  }

  if (source.index === target.index) {
    return {
      reachable: true,
      waypoints: [{ x: source.x, floor: source.floor, node: source.index, kind: source.kind }],
      cost: 0,
      nodeCount: graphData.graph.getNodeCount(),
      edgeCount: graphData.graph.getEdgeCount(),
    };
  }

  const search = new AStar(graphData.graph, source.index, target.index).search();
  if (!search.found) {
    return {
      reachable: false,
      waypoints: [],
      cost: 0,
      nodeCount: graphData.graph.getNodeCount(),
      edgeCount: graphData.graph.getEdgeCount(),
    };
  }

  const nodePath = search.getPath();
  let cost = 0;
  for (let i = 0; i < nodePath.length - 1; i += 1) {
    cost += graphData.graph.getEdge(nodePath[i] ?? -1, nodePath[i + 1] ?? -1)?.cost ?? 0;
  }

  return {
    reachable: true,
    waypoints: nodePath.map((index) => {
      const node = graphData.byIndex.get(index);
      if (!node) throw new Error(`Yuka returned unknown tower node ${index}`);
      return { x: node.x, floor: node.floor, node: index, kind: node.kind };
    }),
    cost,
    nodeCount: graphData.graph.getNodeCount(),
    edgeCount: graphData.graph.getEdgeCount(),
  };
}
