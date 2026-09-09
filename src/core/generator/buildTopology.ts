import type {
  GameplayConstraint,
  Point,
  Stroke,
} from "../types";
import type {
  GameplayGraph,
  GameplayNode,
  GameplayRequirement,
  GameplayRouteType,
} from "../gameplay/types";
import type {
  SharedLevelDesignState,
  SharedPoint,
  SharedSpatialConstraint,
  SpatialTolerance,
} from "../shared-state/types";
import { resamplePath } from "../geometry/distance";

export type TopologyNode = {
  id: string;
  point: Point;
  sourceStrokeIds: string[];
  sourceConstraintIds: string[];
  sourceGameplayNodeId?: string;
  incomingGameplayRouteId?: string;
  incomingGameplayRouteType?: GameplayRouteType;
  gameplayRequirement?: GameplayRequirement;
};

type GraphConnection = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  requirement: GameplayRequirement;
  routeType?: GameplayRouteType;
  sourceStrokeIds: string[];
};

const routePriority: Record<GameplayRouteType, number> = {
  main_route: 0,
  gated_route: 1,
  shortcut: 2,
  return_path: 3,
  optional_route: 4,
};

function connectionPriority(connection: GraphConnection): number {
  const requirementPriority =
    connection.requirement === "mandatory" ? 0 : 10;
  const typePriority = connection.routeType
    ? routePriority[connection.routeType]
    : 5;
  return requirementPriority + typePriority;
}

function graphConnections(graph: GameplayGraph): GraphConnection[] {
  const routeConnections = graph.routes.map((route) => ({
    id: route.id,
    sourceNodeId: route.sourceNodeId,
    targetNodeId: route.targetNodeId,
    requirement: route.requirement,
    routeType: route.type,
    sourceStrokeIds: [...route.sourceStrokeIds],
  }));

  const relationConnections = graph.relations
    .filter(
      (relation) =>
        relation.type === "leads_to" ||
        relation.type === "reconnects",
    )
    .map((relation) => ({
      id: relation.id,
      sourceNodeId: relation.sourceNodeId,
      targetNodeId: relation.targetNodeId,
      requirement: relation.requirement,
      sourceStrokeIds: [],
    }));

  return [...routeConnections, ...relationConnections];
}

function isSharedPoint(
  value: unknown,
): value is SharedPoint {
  if (!value || typeof value !== "object") {
    return false;
  }

  const point = value as Partial<SharedPoint>;

  return (
    typeof point.x === "number" &&
    typeof point.y === "number"
  );
}

function constraintTargetsNode(
  constraint: SharedSpatialConstraint,
  node: GameplayNode,
): boolean {
  return (
    constraint.targetElementId === node.id ||
    node.sourceObjectIds.includes(
      constraint.targetElementId,
    ) ||
    node.sourceAssetIds.includes(
      constraint.targetElementId,
    )
  );
}

function constraintsForNode(
  node: GameplayNode,
  constraints: SharedSpatialConstraint[],
): SharedSpatialConstraint[] {
  return constraints.filter(
    (constraint) =>
      constraint.enabled &&
      constraint.status === "committed" &&
      constraintTargetsNode(constraint, node),
  );
}

function toleranceRadius(
  tolerance:
    | number
    | SpatialTolerance
    | undefined,
): number {
  if (typeof tolerance === "number") {
    return Math.max(0, tolerance);
  }

  if (!tolerance) {
    return 24;
  }

  if (
    tolerance.kind === "absolute" ||
    tolerance.kind === "radius"
  ) {
    return Math.max(0, tolerance.value ?? 24);
  }

  return 24;
}

function clampPointToRegion(
  point: SharedPoint,
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
): SharedPoint {
  return {
    x: Math.max(
      region.x,
      Math.min(region.x + region.width, point.x),
    ),
    y: Math.max(
      region.y,
      Math.min(region.y + region.height, point.y),
    ),
  };
}

function clampPointToRadius(
  point: SharedPoint,
  center: SharedPoint,
  radius: number,
): SharedPoint {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const distance = Math.hypot(dx, dy);

  if (distance <= radius || distance === 0) {
    return point;
  }

  const scale = radius / distance;

  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

function applyPositionConstraint(
  point: SharedPoint,
  constraint: SharedSpatialConstraint,
): SharedPoint {
  if (
    constraint.mode === "free" ||
    constraint.property !== "position"
  ) {
    return point;
  }

  if (
    constraint.mode === "exact" &&
    isSharedPoint(constraint.value)
  ) {
    return { ...constraint.value };
  }

  if (constraint.mode !== "approximate") {
    return point;
  }

  const tolerance = constraint.tolerance;

  if (
    typeof tolerance === "object" &&
    tolerance.kind === "region" &&
    tolerance.region
  ) {
    return clampPointToRegion(
      point,
      tolerance.region,
    );
  }

  if (isSharedPoint(constraint.value)) {
    return clampPointToRadius(
      point,
      constraint.value,
      toleranceRadius(tolerance),
    );
  }

  return point;
}

function resolveGameplayNodePoint(
  node: GameplayNode,
  spatialConstraints: SharedSpatialConstraint[],
): {
  point: SharedPoint;
  sourceConstraintIds: string[];
} {
  const nodeConstraints = constraintsForNode(
    node,
    spatialConstraints,
  );

  const positionConstraints = nodeConstraints
    .filter(
      (constraint) =>
        constraint.property === "position",
    )
    .sort((a, b) => {
      const priority = {
        exact: 0,
        approximate: 1,
        free: 2,
      };

      return priority[a.mode] - priority[b.mode];
    });

  let point: SharedPoint = {
    ...node.position,
  };

  for (const constraint of positionConstraints) {
    point = applyPositionConstraint(
      point,
      constraint,
    );

    if (constraint.mode === "exact") {
      break;
    }
  }

  return {
    point,
    sourceConstraintIds: nodeConstraints.map(
      (constraint) => constraint.id,
    ),
  };
}

function findStartToGoalPath(
  graph: GameplayGraph,
): GraphConnection[] | null {
  const start = graph.nodes.find((node) => node.type === "start");
  const goal = graph.nodes.find((node) => node.type === "goal");

  if (!start || !goal) return null;

  const connections = graphConnections(graph);
  const queue: Array<{
    nodeId: string;
    path: GraphConnection[];
    visitedNodeIds: Set<string>;
    score: number;
  }> = [
    {
      nodeId: start.id,
      path: [],
      visitedNodeIds: new Set([start.id]),
      score: 0,
    },
  ];

  while (queue.length > 0) {
    queue.sort((a, b) => a.score - b.score);
    const current = queue.shift();
    if (!current) break;
    if (current.nodeId === goal.id) return current.path;

    const outgoing = connections
      .filter(
        (connection) =>
          connection.sourceNodeId === current.nodeId &&
          !current.visitedNodeIds.has(connection.targetNodeId),
      )
      .sort(
        (a, b) => connectionPriority(a) - connectionPriority(b),
      );

    for (const connection of outgoing) {
      queue.push({
        nodeId: connection.targetNodeId,
        path: [...current.path, connection],
        visitedNodeIds: new Set([
          ...current.visitedNodeIds,
          connection.targetNodeId,
        ]),
        score:
          current.score +
          connectionPriority(connection) +
          1,
      });
    }
  }

  return null;
}

function buildGameplayMainPath(
  graph: GameplayGraph,
  sourceConstraintIds: string[],
  spatialConstraints: SharedSpatialConstraint[],
): TopologyNode[] | null {
  const start = graph.nodes.find((node) => node.type === "start");
  const path = findStartToGoalPath(graph);

  if (!start || !path) return null;

  const resolvedStart = resolveGameplayNodePoint(
    start,
    spatialConstraints,
  );

  const firstNode: TopologyNode = {
    id: "T0",
    point: {
      x: resolvedStart.point.x,
      y: resolvedStart.point.y,
      time: 0,
    },
    sourceStrokeIds: [],
    sourceConstraintIds: [
      ...new Set([
        ...sourceConstraintIds,
        ...resolvedStart.sourceConstraintIds,
      ]),
    ],
    sourceGameplayNodeId: start.id,
    gameplayRequirement: start.requirement,
  };

  const remainingNodes = path.flatMap(
    (connection, index): TopologyNode[] => {
      const gameplayNode = graph.nodes.find(
        (node) => node.id === connection.targetNodeId,
      );

      if (!gameplayNode) return [];

      const resolved = resolveGameplayNodePoint(
        gameplayNode,
        spatialConstraints,
      );

      return [
        {
          id: `T${index + 1}`,
          point: {
            x: resolved.point.x,
            y: resolved.point.y,
            time: index + 1,
          },
          sourceStrokeIds: [...connection.sourceStrokeIds],
          sourceConstraintIds: [
            ...new Set([
              ...sourceConstraintIds,
              ...resolved.sourceConstraintIds,
            ]),
          ],
          sourceGameplayNodeId: gameplayNode.id,
          incomingGameplayRouteId: connection.id,
          incomingGameplayRouteType: connection.routeType,
          gameplayRequirement: gameplayNode.requirement,
        },
      ];
    },
  );

  return [firstNode, ...remainingNodes];
}

function buildDefaultMainPath(
  width: number,
  height: number,
  sourceConstraintIds: string[],
): TopologyNode[] {
  const points: Point[] = [
    { x: 64, y: height / 2, time: 0 },
    { x: width * 0.26, y: height / 2 - 24, time: 0 },
    { x: width * 0.48, y: height / 2 + 28, time: 0 },
    { x: width * 0.72, y: height / 2 - 18, time: 0 },
    { x: width - 64, y: height / 2, time: 0 },
  ];

  return points.map((point, index) => ({
    id: `T${index}`,
    point,
    sourceStrokeIds: [],
    sourceConstraintIds,
  }));
}

export function buildMainPath(
  strokes: Stroke[],
  constraints: GameplayConstraint[],
  width: number,
  height: number,
  gameplayGraph?: GameplayGraph,
  spatialConstraints: SharedSpatialConstraint[] = [],
): TopologyNode[] {
  const flowConstraintIds = constraints
    .filter((constraint) => constraint.target === "main_path")
    .map((constraint) => constraint.id);

  if (gameplayGraph) {
    const gameplayPath = buildGameplayMainPath(
      gameplayGraph,
      flowConstraintIds,
      spatialConstraints,
    );
    if (gameplayPath && gameplayPath.length >= 2) {
      return gameplayPath;
    }
  }

  const flowStrokes = strokes.filter(
    (stroke) => stroke.enabled && stroke.type === "flow",
  );

  if (flowStrokes.length === 0) {
    return buildDefaultMainPath(width, height, flowConstraintIds);
  }

  const longest = [...flowStrokes].sort(
    (a, b) => b.points.length - a.points.length,
  )[0];
  const count = Math.max(
    5,
    Math.min(10, Math.round(longest.points.length / 8)),
  );

  return resamplePath(longest.points, count).map(
    (point, index) => ({
      id: `T${index}`,
      point,
      sourceStrokeIds: [longest.id],
      sourceConstraintIds: flowConstraintIds,
    }),
  );
}

export function buildMainPathFromSharedState(
  strokes: Stroke[],
  constraints: GameplayConstraint[],
  width: number,
  height: number,
  sharedState: SharedLevelDesignState,
): TopologyNode[] {
  return buildMainPath(
    strokes,
    constraints,
    width,
    height,
    sharedState.gameplay.graph,
    sharedState.spatial.constraints,
  );
}
