declare module 'yuka' {
  export class Vector3 {
    x: number;
    y: number;
    z: number;
    constructor(x?: number, y?: number, z?: number);
    distanceTo(v: Vector3): number;
    squaredDistanceTo(v: Vector3): number;
    manhattanDistanceTo(v: Vector3): number;
  }

  export class Node {
    index: number;
    constructor(index?: number);
  }

  export class Edge {
    from: number;
    to: number;
    cost: number;
    constructor(from?: number, to?: number, cost?: number);
  }

  export class Graph {
    digraph: boolean;
    addNode(node: Node): this;
    addEdge(edge: Edge): this;
    getNode(index: number): Node | null;
    getEdge(from: number, to: number): Edge | null;
    getNodeCount(): number;
    getEdgeCount(): number;
  }

  export class AStar {
    found: boolean;
    graph: Graph | null;
    source: number;
    target: number;
    heuristic: unknown;
    constructor(graph?: Graph | null, source?: number, target?: number);
    search(): this;
    getPath(): number[];
  }

  export class GoalEvaluator {
    characterBias: number;
    constructor(characterBias?: number);
    calculateDesirability(owner: unknown): number;
    setGoal(owner: unknown): void;
  }

  export class Think {
    owner: unknown;
    evaluators: GoalEvaluator[];
    constructor(owner?: unknown);
    addEvaluator(evaluator: GoalEvaluator): this;
    removeEvaluator(evaluator: GoalEvaluator): this;
    arbitrate(): this;
  }
}
