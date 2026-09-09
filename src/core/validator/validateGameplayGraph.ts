import { nanoid } from "nanoid";

import type {
  GameplayGraph,
  GameplayNode,
} from "../gameplay/types";
import type {
  GameplayConflictType,
  GameplayValidationConflict,
  GameplayValidationResult,
} from "../shared-state/types";

export type ValidateGameplayGraphOptions = {
  validatorVersion?: string;
  checkedAt?: number;
};

type Adjacency = Map<string, Set<string>>;

function addEdge(
  adjacency: Adjacency,
  sourceId: string,
  targetId: string,
): void {
  const targets =
    adjacency.get(sourceId) ??
    new Set<string>();

  targets.add(targetId);
  adjacency.set(sourceId, targets);
}

function createAdjacency(
  graph: GameplayGraph,
  reverse = false,
): Adjacency {
  const adjacency: Adjacency = new Map();

  for (const node of graph.nodes) {
    adjacency.set(node.id, new Set());
  }

  for (const route of graph.routes) {
    addEdge(
      adjacency,
      reverse
        ? route.targetNodeId
        : route.sourceNodeId,
      reverse
        ? route.sourceNodeId
        : route.targetNodeId,
    );
  }

  for (const relation of graph.relations) {
    if (
      relation.type !== "leads_to" &&
      relation.type !== "reconnects"
    ) {
      continue;
    }

    addEdge(
      adjacency,
      reverse
        ? relation.targetNodeId
        : relation.sourceNodeId,
      reverse
        ? relation.sourceNodeId
        : relation.targetNodeId,
    );
  }

  return adjacency;
}

function traverse(
  adjacency: Adjacency,
  startingNodeIds: string[],
): Set<string> {
  const visited = new Set<string>();
  const queue = [...startingNodeIds];

  while (queue.length > 0) {
    const nodeId = queue.shift();

    if (!nodeId || visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);

    for (const targetId of
      adjacency.get(nodeId) ?? []) {
      if (!visited.has(targetId)) {
        queue.push(targetId);
      }
    }
  }

  return visited;
}

function createConflict(
  type: GameplayConflictType,
  severity: GameplayValidationConflict["severity"],
  message: string,
  entityIds: {
    nodeIds?: string[];
    relationIds?: string[];
    routeIds?: string[];
  } = {},
): GameplayValidationConflict {
  const id = `GVC-${nanoid(8)}`;

  return {
    id,
    type,
    severity,
    message,
    nodeIds: entityIds.nodeIds ?? [],
    relationIds:
      entityIds.relationIds ?? [],
    routeIds: entityIds.routeIds ?? [],
    suggestedRepairIds: [
      `repair-${id}`,
    ],
  };
}

function findDanglingReferences(
  graph: GameplayGraph,
  nodeIds: Set<string>,
): GameplayValidationConflict[] {
  const conflicts:
    GameplayValidationConflict[] = [];

  for (const relation of graph.relations) {
    const missingNodeIds = [
      relation.sourceNodeId,
      relation.targetNodeId,
    ].filter((id) => !nodeIds.has(id));

    if (missingNodeIds.length > 0) {
      conflicts.push(
        createConflict(
          "dangling_reference",
          "error",
          `Relation ${relation.id} references a missing node.`,
          {
            nodeIds: missingNodeIds,
            relationIds: [relation.id],
          },
        ),
      );
    }
  }

  for (const route of graph.routes) {
    const missingNodeIds = [
      route.sourceNodeId,
      route.targetNodeId,
    ].filter((id) => !nodeIds.has(id));

    if (missingNodeIds.length > 0) {
      conflicts.push(
        createConflict(
          "dangling_reference",
          "error",
          `Route ${route.id} references a missing node.`,
          {
            nodeIds: missingNodeIds,
            routeIds: [route.id],
          },
        ),
      );
    }
  }

  return conflicts;
}

function createDependencyAdjacency(
  graph: GameplayGraph,
): Adjacency {
  const adjacency: Adjacency = new Map();

  for (const node of graph.nodes) {
    adjacency.set(node.id, new Set());
  }

  for (const relation of graph.relations) {
    if (relation.type === "requires") {
      addEdge(
        adjacency,
        relation.sourceNodeId,
        relation.targetNodeId,
      );
    }

    if (
      relation.type === "unlocks" ||
      relation.type === "triggers"
    ) {
      addEdge(
        adjacency,
        relation.targetNodeId,
        relation.sourceNodeId,
      );
    }
  }

  return adjacency;
}

function findDependencyCycles(
  adjacency: Adjacency,
): string[][] {
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];
  const cycleKeys = new Set<string>();
  const cycles: string[][] = [];

  const visit = (nodeId: string): void => {
    if (active.has(nodeId)) {
      const startIndex =
        stack.indexOf(nodeId);

      const cycle =
        stack.slice(startIndex);

      const key = [...cycle]
        .sort()
        .join("|");

      if (
        cycle.length > 0 &&
        !cycleKeys.has(key)
      ) {
        cycleKeys.add(key);
        cycles.push(cycle);
      }

      return;
    }

    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    active.add(nodeId);
    stack.push(nodeId);

    for (const dependencyId of
      adjacency.get(nodeId) ?? []) {
      visit(dependencyId);
    }

    stack.pop();
    active.delete(nodeId);
  };

  for (const nodeId of adjacency.keys()) {
    visit(nodeId);
  }

  return cycles;
}

function relationsWithinNodes(
  graph: GameplayGraph,
  nodeIds: Set<string>,
): string[] {
  return graph.relations
    .filter(
      (relation) =>
        nodeIds.has(relation.sourceNodeId) &&
        nodeIds.has(relation.targetNodeId) &&
        (
          relation.type === "requires" ||
          relation.type === "unlocks" ||
          relation.type === "triggers"
        ),
    )
    .map((relation) => relation.id);
}

function findDependencyConflicts(
  graph: GameplayGraph,
  nodesById: Map<string, GameplayNode>,
): GameplayValidationConflict[] {
  const conflicts:
    GameplayValidationConflict[] = [];

  const cycles = findDependencyCycles(
    createDependencyAdjacency(graph),
  );

  for (const cycle of cycles) {
    const cycleNodeIds = new Set(cycle);
    const relationIds = relationsWithinNodes(
      graph,
      cycleNodeIds,
    );

    conflicts.push(
      createConflict(
        "cyclic_dependency",
        "error",
        "Gameplay dependencies form a cycle.",
        {
          nodeIds: cycle,
          relationIds,
        },
      ),
    );

    const containsGate = cycle.some(
      (id) => nodesById.get(id)?.type === "gate",
    );

    if (containsGate) {
      conflicts.push(
        createConflict(
          "gate_objective_deadlock",
          "error",
          "A gate depends on content that is locked behind the same dependency cycle.",
          {
            nodeIds: cycle,
            relationIds,
          },
        ),
      );
    }
  }

  return conflicts;
}

function findBranchConflicts(
  graph: GameplayGraph,
  nodesById: Map<string, GameplayNode>,
  reachableNodeIds: Set<string>,
  nodesThatReachGoal: Set<string>,
): GameplayValidationConflict[] {
  const conflicts:
    GameplayValidationConflict[] = [];

  for (const route of graph.routes) {
    if (
      route.requirement !== "optional" &&
      route.type !== "optional_route" &&
      route.type !== "shortcut"
    ) {
      continue;
    }

    const targetNode = nodesById.get(
      route.targetNodeId,
    );

    if (targetNode?.requirement === "mandatory") {
      conflicts.push(
        createConflict(
          "false_optionality",
          "error",
          "An optional route leads directly to mandatory content.",
          {
            nodeIds: [targetNode.id],
            routeIds: [route.id],
          },
        ),
      );
    }

    if (
      reachableNodeIds.has(route.targetNodeId) &&
      !nodesThatReachGoal.has(route.targetNodeId)
    ) {
      conflicts.push(
        createConflict(
          "false_optionality",
          "warning",
          "An optional branch does not reconnect to a goal-reaching route.",
          {
            nodeIds: [route.targetNodeId],
            routeIds: [route.id],
          },
        ),
      );
    }
  }

  return conflicts;
}

export function validateGameplayGraph(
  graph: GameplayGraph,
  options: ValidateGameplayGraphOptions = {},
): GameplayValidationResult {
  const conflicts:
    GameplayValidationConflict[] = [];

  const nodeIds = new Set(
    graph.nodes.map((node) => node.id),
  );

  const nodesById = new Map(
    graph.nodes.map((node) => [node.id, node]),
  );

  const startNodeIds = graph.nodes
    .filter((node) => node.type === "start")
    .map((node) => node.id);

  const goalNodeIds = graph.nodes
    .filter((node) => node.type === "goal")
    .map((node) => node.id);

  if (startNodeIds.length === 0) {
    conflicts.push(
      createConflict(
        "missing_start",
        "error",
        "The gameplay graph has no start node.",
      ),
    );
  }

  if (goalNodeIds.length === 0) {
    conflicts.push(
      createConflict(
        "missing_goal",
        "error",
        "The gameplay graph has no goal node.",
      ),
    );
  }

  conflicts.push(
    ...findDanglingReferences(graph, nodeIds),
  );

  const adjacency = createAdjacency(graph);
  const reachableNodeIds = traverse(
    adjacency,
    startNodeIds,
  );

  const unreachableGoalIds =
    goalNodeIds.filter(
      (id) => !reachableNodeIds.has(id),
    );

  if (unreachableGoalIds.length > 0) {
    conflicts.push(
      createConflict(
        "unreachable_goal",
        "error",
        "One or more goal nodes cannot be reached from a start node.",
        { nodeIds: unreachableGoalIds },
      ),
    );
  }

  const mandatoryNodeIds = graph.nodes
    .filter(
      (node) =>
        node.requirement === "mandatory",
    )
    .map((node) => node.id);

  const unreachableMandatoryNodeIds =
    mandatoryNodeIds.filter(
      (id) => !reachableNodeIds.has(id),
    );

  if (
    unreachableMandatoryNodeIds.length > 0
  ) {
    conflicts.push(
      createConflict(
        "unreachable_mandatory_node",
        "error",
        "Mandatory gameplay content cannot be reached from a start node.",
        {
          nodeIds:
            unreachableMandatoryNodeIds,
        },
      ),
    );
  }

  const unreachableRewardIds = graph.nodes
    .filter(
      (node) =>
        node.type === "reward" &&
        !reachableNodeIds.has(node.id),
    )
    .map((node) => node.id);

  if (unreachableRewardIds.length > 0) {
    conflicts.push(
      createConflict(
        "unreachable_reward",
        "warning",
        "One or more reward nodes cannot be reached.",
        { nodeIds: unreachableRewardIds },
      ),
    );
  }

  conflicts.push(
    ...findDependencyConflicts(
      graph,
      nodesById,
    ),
  );

  const nodesThatReachGoal = traverse(
    createAdjacency(graph, true),
    goalNodeIds,
  );

  conflicts.push(
    ...findBranchConflicts(
      graph,
      nodesById,
      reachableNodeIds,
      nodesThatReachGoal,
    ),
  );

  return {
    id: `GV-${nanoid(8)}`,
    valid: !conflicts.some(
      (conflict) =>
        conflict.severity === "error",
    ),
    validatorVersion:
      options.validatorVersion ?? "1.0.0",
    checkedAt: options.checkedAt ?? Date.now(),
    reachableNodeIds: [...reachableNodeIds],
    mandatoryNodeIds,
    conflicts,
  };
}
