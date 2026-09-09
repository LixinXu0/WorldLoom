import { nanoid } from "nanoid";

import type {
  GameplayGraph,
  GameplayNode,
  GameplayRelation,
  GameplayRoute,
} from "../gameplay/types";
import type {
  GameplayRepairOperation,
  GameplayRepairProposal,
  GameplayValidationConflict,
  GameplayValidationResult,
} from "../shared-state/types";
import { validateGameplayGraph } from "./validateGameplayGraph";

export type GameplayRepairResult = {
  graph: GameplayGraph;
  proposal: GameplayRepairProposal;
  validation: GameplayValidationResult;
};

function cloneNode(node: GameplayNode): GameplayNode {
  return {
    ...node,
    position: { ...node.position },
    sourceObjectIds: [...node.sourceObjectIds],
    sourceAssetIds: [...node.sourceAssetIds],
  };
}

function cloneRelation(
  relation: GameplayRelation,
): GameplayRelation {
  return { ...relation };
}

function cloneRoute(route: GameplayRoute): GameplayRoute {
  return {
    ...route,
    controlPointIds: [...route.controlPointIds],
    sourceStrokeIds: [...route.sourceStrokeIds],
  };
}

function cloneGraph(graph: GameplayGraph): GameplayGraph {
  return {
    schemaVersion: "1.0",
    nodes: graph.nodes.map(cloneNode),
    relations: graph.relations.map(cloneRelation),
    routes: graph.routes.map(cloneRoute),
  };
}

function createOperation(
  type: GameplayRepairOperation["type"],
  entityId: string,
  before?: unknown,
  after?: unknown,
): GameplayRepairOperation {
  return {
    id: `GRO-${nanoid(8)}`,
    type,
    entityId,
    before,
    after,
  };
}

function createProposal(
  conflict: GameplayValidationConflict,
  label: string,
  description: string,
  operations: GameplayRepairOperation[],
  createdAt: number,
): GameplayRepairProposal {
  return {
    id: `repair-${conflict.id}`,
    conflictId: conflict.id,
    label,
    description,
    operations,
    status: "proposed",
    createdAt,
    provenance: {
      source: "system",
      sourceIds: [conflict.id],
      explanation:
        "Local repair generated from gameplay validation.",
      createdAt,
      updatedAt: createdAt,
    },
  };
}

function averagePosition(
  nodes: GameplayNode[],
): { x: number; y: number } {
  if (nodes.length === 0) {
    return { x: 480, y: 280 };
  }

  return {
    x:
      nodes.reduce(
        (sum, node) => sum + node.position.x,
        0,
      ) / nodes.length,
    y:
      nodes.reduce(
        (sum, node) => sum + node.position.y,
        0,
      ) / nodes.length,
  };
}

function createGeneratedNode(
  type: "start" | "goal",
  graph: GameplayGraph,
): GameplayNode {
  const center = averagePosition(graph.nodes);
  const id = `${type}-${nanoid(8)}`;

  return {
    id,
    type,
    label:
      type === "start"
        ? "Generated Start"
        : "Generated Goal",
    description:
      "Automatically added by the local gameplay repair system.",
    position: {
      x:
        type === "start"
          ? Math.max(40, center.x - 160)
          : center.x + 160,
      y: center.y,
    },
    requirement: "mandatory",
    sourceObjectIds: [],
    sourceAssetIds: [],
  };
}

function createGeneratedRoute(
  sourceNodeId: string,
  targetNodeId: string,
  requirement: GameplayRoute["requirement"] =
    "mandatory",
  type: GameplayRoute["type"] = "main_route",
): GameplayRoute {
  return {
    id: `route-${nanoid(8)}`,
    type,
    sourceNodeId,
    targetNodeId,
    requirement,
    controlPointIds: [],
    sourceStrokeIds: [],
    description:
      "Automatically added to restore gameplay connectivity.",
  };
}

function firstExistingNodeId(
  graph: GameplayGraph,
  preferredIds: string[],
): string | null {
  const nodeIds = new Set(
    graph.nodes.map((node) => node.id),
  );

  return (
    preferredIds.find((id) => nodeIds.has(id)) ??
    graph.nodes[0]?.id ??
    null
  );
}

function firstReachableAnchorId(
  graph: GameplayGraph,
  validation: GameplayValidationResult,
  excludedIds: Set<string>,
): string | null {
  const reachableIds = new Set(
    validation.reachableNodeIds,
  );

  return (
    graph.nodes.find(
      (node) =>
        reachableIds.has(node.id) &&
        !excludedIds.has(node.id),
    )?.id ??
    graph.nodes.find(
      (node) => !excludedIds.has(node.id),
    )?.id ??
    null
  );
}

function proposalForMissingStart(
  graph: GameplayGraph,
  conflict: GameplayValidationConflict,
  createdAt: number,
): GameplayRepairProposal {
  const node = createGeneratedNode("start", graph);
  const targetId = graph.nodes[0]?.id;
  const operations = [
    createOperation(
      "add_node",
      node.id,
      undefined,
      node,
    ),
  ];

  if (targetId) {
    const route = createGeneratedRoute(
      node.id,
      targetId,
    );
    operations.push(
      createOperation(
        "add_route",
        route.id,
        undefined,
        route,
      ),
    );
  }

  return createProposal(
    conflict,
    "Add a start node",
    "Add a start node and connect it to the existing graph.",
    operations,
    createdAt,
  );
}

function proposalForMissingGoal(
  graph: GameplayGraph,
  validation: GameplayValidationResult,
  conflict: GameplayValidationConflict,
  createdAt: number,
): GameplayRepairProposal {
  const node = createGeneratedNode("goal", graph);
  const sourceId =
    firstReachableAnchorId(
      graph,
      validation,
      new Set(),
    );
  const operations = [
    createOperation(
      "add_node",
      node.id,
      undefined,
      node,
    ),
  ];

  if (sourceId) {
    const route = createGeneratedRoute(
      sourceId,
      node.id,
    );
    operations.push(
      createOperation(
        "add_route",
        route.id,
        undefined,
        route,
      ),
    );
  }

  return createProposal(
    conflict,
    "Add a goal node",
    "Add a goal node and connect it to reachable gameplay content.",
    operations,
    createdAt,
  );
}

function proposalForUnreachableContent(
  graph: GameplayGraph,
  validation: GameplayValidationResult,
  conflict: GameplayValidationConflict,
  createdAt: number,
): GameplayRepairProposal {
  const targetId = firstExistingNodeId(
    graph,
    conflict.nodeIds,
  );
  const sourceId = firstReachableAnchorId(
    graph,
    validation,
    new Set(conflict.nodeIds),
  );
  const operations: GameplayRepairOperation[] = [];

  if (sourceId && targetId && sourceId !== targetId) {
    const target = graph.nodes.find(
      (node) => node.id === targetId,
    );
    const optional =
      target?.requirement === "optional" ||
      target?.type === "reward";
    const route = createGeneratedRoute(
      sourceId,
      targetId,
      optional ? "optional" : "mandatory",
      optional ? "optional_route" : "main_route",
    );

    operations.push(
      createOperation(
        "add_route",
        route.id,
        undefined,
        route,
      ),
    );
  }

  return createProposal(
    conflict,
    "Reconnect unreachable content",
    "Add one local route from reachable content to the affected node.",
    operations,
    createdAt,
  );
}

function proposalForDanglingReference(
  graph: GameplayGraph,
  conflict: GameplayValidationConflict,
  createdAt: number,
): GameplayRepairProposal {
  const operations: GameplayRepairOperation[] = [];

  for (const relationId of conflict.relationIds) {
    const relation = graph.relations.find(
      (item) => item.id === relationId,
    );

    if (relation) {
      operations.push(
        createOperation(
          "remove_relation",
          relation.id,
          relation,
        ),
      );
    }
  }

  for (const routeId of conflict.routeIds) {
    const route = graph.routes.find(
      (item) => item.id === routeId,
    );

    if (route) {
      operations.push(
        createOperation(
          "remove_route",
          route.id,
          route,
        ),
      );
    }
  }

  return createProposal(
    conflict,
    "Remove dangling reference",
    "Remove only the relation or route that references a missing node.",
    operations,
    createdAt,
  );
}

function proposalForDependencyCycle(
  graph: GameplayGraph,
  conflict: GameplayValidationConflict,
  createdAt: number,
): GameplayRepairProposal {
  const relation = graph.relations.find(
    (item) =>
      conflict.relationIds.includes(item.id),
  );

  const operations = relation
    ? [
        createOperation(
          "remove_relation",
          relation.id,
          relation,
        ),
      ]
    : [];

  return createProposal(
    conflict,
    "Break dependency cycle",
    "Remove one local dependency edge to break the cycle without rebuilding the graph.",
    operations,
    createdAt,
  );
}

function proposalForOptionalBranch(
  graph: GameplayGraph,
  conflict: GameplayValidationConflict,
  createdAt: number,
): GameplayRepairProposal {
  const route = graph.routes.find(
    (item) => conflict.routeIds.includes(item.id),
  );
  const target = route
    ? graph.nodes.find(
        (node) => node.id === route.targetNodeId,
      )
    : undefined;

  if (
    route &&
    target?.requirement === "mandatory"
  ) {
    const updatedRoute: GameplayRoute = {
      ...cloneRoute(route),
      type: "main_route",
      requirement: "mandatory",
    };

    return createProposal(
      conflict,
      "Make the route mandatory",
      "Match the route requirement to its mandatory target.",
      [
        createOperation(
          "update_route",
          route.id,
          route,
          updatedRoute,
        ),
      ],
      createdAt,
    );
  }

  const goal = graph.nodes.find(
    (node) => node.type === "goal",
  );

  if (route && goal) {
    const returnRoute = createGeneratedRoute(
      route.targetNodeId,
      goal.id,
      "optional",
      "return_path",
    );

    return createProposal(
      conflict,
      "Reconnect optional branch",
      "Add a return path from the optional branch to the goal-reaching route.",
      [
        createOperation(
          "add_route",
          returnRoute.id,
          undefined,
          returnRoute,
        ),
      ],
      createdAt,
    );
  }

  return createProposal(
    conflict,
    "Review optional branch",
    "No safe automatic connection could be found; keep the proposal for manual review.",
    [],
    createdAt,
  );
}

function createRepairForConflict(
  graph: GameplayGraph,
  validation: GameplayValidationResult,
  conflict: GameplayValidationConflict,
  createdAt: number,
): GameplayRepairProposal {
  switch (conflict.type) {
    case "missing_start":
      return proposalForMissingStart(
        graph,
        conflict,
        createdAt,
      );

    case "missing_goal":
      return proposalForMissingGoal(
        graph,
        validation,
        conflict,
        createdAt,
      );

    case "unreachable_goal":
    case "unreachable_mandatory_node":
    case "unreachable_reward":
      return proposalForUnreachableContent(
        graph,
        validation,
        conflict,
        createdAt,
      );

    case "dangling_reference":
      return proposalForDanglingReference(
        graph,
        conflict,
        createdAt,
      );

    case "cyclic_dependency":
    case "gate_objective_deadlock":
      return proposalForDependencyCycle(
        graph,
        conflict,
        createdAt,
      );

    case "false_optionality":
    case "mandatory_node_bypass":
      return proposalForOptionalBranch(
        graph,
        conflict,
        createdAt,
      );

    default:
      return createProposal(
        conflict,
        "Review gameplay conflict",
        "This conflict requires manual review.",
        [],
        createdAt,
      );
  }
}

export function generateGameplayRepairProposals(
  graph: GameplayGraph,
  validation: GameplayValidationResult =
    validateGameplayGraph(graph),
  createdAt = Date.now(),
): GameplayRepairProposal[] {
  return validation.conflicts.map((conflict) =>
    createRepairForConflict(
      graph,
      validation,
      conflict,
      createdAt,
    ),
  );
}

function applyOperation(
  graph: GameplayGraph,
  operation: GameplayRepairOperation,
): GameplayGraph {
  switch (operation.type) {
    case "add_node": {
      const node = operation.after as GameplayNode;
      return {
        ...graph,
        nodes: [
          ...graph.nodes.filter(
            (item) => item.id !== node.id,
          ),
          cloneNode(node),
        ],
      };
    }

    case "update_node": {
      const node = operation.after as GameplayNode;
      return {
        ...graph,
        nodes: graph.nodes.map((item) =>
          item.id === operation.entityId
            ? cloneNode(node)
            : item,
        ),
      };
    }

    case "remove_node":
      return {
        ...graph,
        nodes: graph.nodes.filter(
          (item) =>
            item.id !== operation.entityId,
        ),
        relations: graph.relations.filter(
          (item) =>
            item.sourceNodeId !==
              operation.entityId &&
            item.targetNodeId !==
              operation.entityId,
        ),
        routes: graph.routes.filter(
          (item) =>
            item.sourceNodeId !==
              operation.entityId &&
            item.targetNodeId !==
              operation.entityId,
        ),
      };

    case "add_relation": {
      const relation =
        operation.after as GameplayRelation;
      return {
        ...graph,
        relations: [
          ...graph.relations.filter(
            (item) => item.id !== relation.id,
          ),
          cloneRelation(relation),
        ],
      };
    }

    case "update_relation": {
      const relation =
        operation.after as GameplayRelation;
      return {
        ...graph,
        relations: graph.relations.map((item) =>
          item.id === operation.entityId
            ? cloneRelation(relation)
            : item,
        ),
      };
    }

    case "remove_relation":
      return {
        ...graph,
        relations: graph.relations.filter(
          (item) =>
            item.id !== operation.entityId,
        ),
      };

    case "add_route": {
      const route = operation.after as GameplayRoute;
      return {
        ...graph,
        routes: [
          ...graph.routes.filter(
            (item) => item.id !== route.id,
          ),
          cloneRoute(route),
        ],
      };
    }

    case "update_route": {
      const route = operation.after as GameplayRoute;
      return {
        ...graph,
        routes: graph.routes.map((item) =>
          item.id === operation.entityId
            ? cloneRoute(route)
            : item,
        ),
      };
    }

    case "remove_route":
      return {
        ...graph,
        routes: graph.routes.filter(
          (item) =>
            item.id !== operation.entityId,
        ),
      };
  }
}

export function applyGameplayRepair(
  graph: GameplayGraph,
  proposal: GameplayRepairProposal,
  appliedAt = Date.now(),
): GameplayRepairResult {
  let repairedGraph = cloneGraph(graph);

  for (const operation of proposal.operations) {
    repairedGraph = applyOperation(
      repairedGraph,
      operation,
    );
  }

  const appliedProposal: GameplayRepairProposal = {
    ...proposal,
    status: "applied",
    appliedAt,
    provenance: {
      ...proposal.provenance,
      updatedAt: appliedAt,
    },
  };

  return {
    graph: repairedGraph,
    proposal: appliedProposal,
    validation: validateGameplayGraph(
      repairedGraph,
      { checkedAt: appliedAt },
    ),
  };
}

export function applyGameplayRepairs(
  graph: GameplayGraph,
  proposals: GameplayRepairProposal[],
  appliedAt = Date.now(),
): {
  graph: GameplayGraph;
  proposals: GameplayRepairProposal[];
  validation: GameplayValidationResult;
} {
  let repairedGraph = cloneGraph(graph);
  const appliedProposals:
    GameplayRepairProposal[] = [];

  for (const proposal of proposals) {
    const result = applyGameplayRepair(
      repairedGraph,
      proposal,
      appliedAt,
    );

    repairedGraph = result.graph;
    appliedProposals.push(result.proposal);
  }

  return {
    graph: repairedGraph,
    proposals: appliedProposals,
    validation: validateGameplayGraph(
      repairedGraph,
      { checkedAt: appliedAt },
    ),
  };
}
