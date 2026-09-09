import { nanoid } from "nanoid";

import type {
  GameplayGraph,
  GameplayNode,
  GameplayRelation,
  GameplayRoute,
} from "./types";

export type CreateGameplayNodeInput = Omit<
  GameplayNode,
  "id" | "sourceObjectIds" | "sourceAssetIds"
> & {
  id?: string;
  sourceObjectIds?: string[];
  sourceAssetIds?: string[];
};

export type CreateGameplayRelationInput = Omit<
  GameplayRelation,
  "id"
> & {
  id?: string;
};

export type CreateGameplayRouteInput = Omit<
  GameplayRoute,
  "id" | "controlPointIds" | "sourceStrokeIds"
> & {
  id?: string;
  controlPointIds?: string[];
  sourceStrokeIds?: string[];
};

function assertUniqueId(
  graph: GameplayGraph,
  id: string,
): void {
  const alreadyExists =
    graph.nodes.some((node) => node.id === id) ||
    graph.relations.some((relation) => relation.id === id) ||
    graph.routes.some((route) => route.id === id);

  if (alreadyExists) {
    throw new Error(`Gameplay element id already exists: ${id}`);
  }
}

function assertNodeExists(
  graph: GameplayGraph,
  nodeId: string,
): void {
  if (!graph.nodes.some((node) => node.id === nodeId)) {
    throw new Error(`Gameplay node does not exist: ${nodeId}`);
  }
}

function assertValidConnection(
  graph: GameplayGraph,
  sourceNodeId: string,
  targetNodeId: string,
): void {
  assertNodeExists(graph, sourceNodeId);
  assertNodeExists(graph, targetNodeId);

  if (sourceNodeId === targetNodeId) {
    throw new Error(
      "A gameplay element cannot connect a node to itself.",
    );
  }
}

export function createGameplayNode(
  input: CreateGameplayNodeInput,
): GameplayNode {
  return {
    ...input,
    id: input.id ?? `GN-${nanoid(8)}`,
    sourceObjectIds: [...(input.sourceObjectIds ?? [])],
    sourceAssetIds: [...(input.sourceAssetIds ?? [])],
  };
}

export function createGameplayRelation(
  input: CreateGameplayRelationInput,
): GameplayRelation {
  return {
    ...input,
    id: input.id ?? `GR-${nanoid(8)}`,
  };
}

export function createGameplayRoute(
  input: CreateGameplayRouteInput,
): GameplayRoute {
  return {
    ...input,
    id: input.id ?? `GT-${nanoid(8)}`,
    controlPointIds: [...(input.controlPointIds ?? [])],
    sourceStrokeIds: [...(input.sourceStrokeIds ?? [])],
  };
}

export function addGameplayNode(
  graph: GameplayGraph,
  node: GameplayNode,
): GameplayGraph {
  assertUniqueId(graph, node.id);

  return {
    ...graph,
    nodes: [...graph.nodes, node],
  };
}

export function updateGameplayNode(
  graph: GameplayGraph,
  nodeId: string,
  patch: Partial<Omit<GameplayNode, "id">>,
): GameplayGraph {
  assertNodeExists(graph, nodeId);

  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            ...patch,
            position: patch.position
              ? { ...patch.position }
              : node.position,
            sourceObjectIds: patch.sourceObjectIds
              ? [...patch.sourceObjectIds]
              : node.sourceObjectIds,
            sourceAssetIds: patch.sourceAssetIds
              ? [...patch.sourceAssetIds]
              : node.sourceAssetIds,
          }
        : node,
    ),
  };
}

export function removeGameplayNode(
  graph: GameplayGraph,
  nodeId: string,
): GameplayGraph {
  assertNodeExists(graph, nodeId);

  return {
    ...graph,
    nodes: graph.nodes.filter((node) => node.id !== nodeId),
    relations: graph.relations.filter(
      (relation) =>
        relation.sourceNodeId !== nodeId &&
        relation.targetNodeId !== nodeId,
    ),
    routes: graph.routes.filter(
      (route) =>
        route.sourceNodeId !== nodeId &&
        route.targetNodeId !== nodeId,
    ),
  };
}

export function addGameplayRelation(
  graph: GameplayGraph,
  relation: GameplayRelation,
): GameplayGraph {
  assertUniqueId(graph, relation.id);
  assertValidConnection(
    graph,
    relation.sourceNodeId,
    relation.targetNodeId,
  );

  return {
    ...graph,
    relations: [...graph.relations, relation],
  };
}

export function updateGameplayRelation(
  graph: GameplayGraph,
  relationId: string,
  patch: Partial<Omit<GameplayRelation, "id">>,
): GameplayGraph {
  const relation = graph.relations.find(
    (item) => item.id === relationId,
  );

  if (!relation) {
    throw new Error(
      `Gameplay relation does not exist: ${relationId}`,
    );
  }

  const sourceNodeId =
    patch.sourceNodeId ?? relation.sourceNodeId;

  const targetNodeId =
    patch.targetNodeId ?? relation.targetNodeId;

  assertValidConnection(graph, sourceNodeId, targetNodeId);

  return {
    ...graph,
    relations: graph.relations.map((item) =>
      item.id === relationId
        ? {
            ...item,
            ...patch,
            sourceNodeId,
            targetNodeId,
          }
        : item,
    ),
  };
}

export function removeGameplayRelation(
  graph: GameplayGraph,
  relationId: string,
): GameplayGraph {
  return {
    ...graph,
    relations: graph.relations.filter(
      (relation) => relation.id !== relationId,
    ),
  };
}

export function addGameplayRoute(
  graph: GameplayGraph,
  route: GameplayRoute,
): GameplayGraph {
  assertUniqueId(graph, route.id);
  assertValidConnection(
    graph,
    route.sourceNodeId,
    route.targetNodeId,
  );

  return {
    ...graph,
    routes: [...graph.routes, route],
  };
}

export function updateGameplayRoute(
  graph: GameplayGraph,
  routeId: string,
  patch: Partial<Omit<GameplayRoute, "id">>,
): GameplayGraph {
  const route = graph.routes.find(
    (item) => item.id === routeId,
  );

  if (!route) {
    throw new Error(`Gameplay route does not exist: ${routeId}`);
  }

  const sourceNodeId =
    patch.sourceNodeId ?? route.sourceNodeId;

  const targetNodeId =
    patch.targetNodeId ?? route.targetNodeId;

  assertValidConnection(graph, sourceNodeId, targetNodeId);

  return {
    ...graph,
    routes: graph.routes.map((item) =>
      item.id === routeId
        ? {
            ...item,
            ...patch,
            sourceNodeId,
            targetNodeId,
            controlPointIds: patch.controlPointIds
              ? [...patch.controlPointIds]
              : item.controlPointIds,
            sourceStrokeIds: patch.sourceStrokeIds
              ? [...patch.sourceStrokeIds]
              : item.sourceStrokeIds,
          }
        : item,
    ),
  };
}

export function removeGameplayRoute(
  graph: GameplayGraph,
  routeId: string,
): GameplayGraph {
  return {
    ...graph,
    routes: graph.routes.filter(
      (route) => route.id !== routeId,
    ),
  };
}