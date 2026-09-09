import { nanoid } from "nanoid";

import type {
  SharedLevelDesignState,
  SharedSpatialConstraint,
} from "../shared-state/types";
import {
  defaultGenerativeFreedom,
  defaultToleranceForProperty,
} from "../constraints/spatialConstraintModel";
import type {
  ApproximateContractConstraint,
  ContractGameplayNode,
  ContractGameplayRelation,
  ContractGameplayRoute,
  ContractSceneElement,
  ExactContractConstraint,
  FreeContractConstraint,
  GenerationContractIssue,
  PlayableGenerationContract,
  RegenerationScope,
} from "./types";

export type BuildPlayableGenerationContractOptions = {
  projectId?: string;
  seed?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  regenerationMode?: "full" | "local";
  targetElementIds?: string[];
  targetGameplayNodeIds?: string[];
  lockedElementIds?: string[];
  lockedGameplayNodeIds?: string[];
  compiledAt?: number;
};

const unique = (values: string[]): string[] =>
  [...new Set(values)];

function compileSceneElements(
  state: SharedLevelDesignState,
  lockedElementIds: Set<string>,
): ContractSceneElement[] {
  return state.scene.elements
    .filter(
      (element) =>
        element.status === "committed" ||
        element.preserved ||
        lockedElementIds.has(element.id),
    )
    .map((element) => ({
      id: element.id,
      type: element.type,
      name: element.name,
      description: element.description,
      assetDefinitionId:
        element.assetDefinitionId,
      sourceRef: element.sourceRef,
      transform: element.transform
        ? {
            ...element.transform,
            position: {
              ...element.transform.position,
            },
          }
        : undefined,
      bounds: element.bounds
        ? { ...element.bounds }
        : undefined,
      semanticRoles: [
        ...element.semanticRoles,
      ],
      preserve:
        element.preserved ||
        lockedElementIds.has(element.id),
    }));
}

function compileExactConstraint(
  constraint: SharedSpatialConstraint,
): ExactContractConstraint {
  return {
    id: constraint.id,
    sourceConstraintId: constraint.id,
    targetElementId:
      constraint.targetElementId,
    property: constraint.property,
    mode: "exact",
    value: constraint.value,
    unit: constraint.unit,
    preserveOnRegeneration: true,
  };
}

function compileApproximateConstraint(
  constraint: SharedSpatialConstraint,
): ApproximateContractConstraint {
  return {
    id: constraint.id,
    sourceConstraintId: constraint.id,
    targetElementId:
      constraint.targetElementId,
    property: constraint.property,
    mode: "approximate",
    value: constraint.value,
    unit: constraint.unit,
    tolerance:
      constraint.tolerance ??
      defaultToleranceForProperty(
        constraint.property,
      ),
    preserveOnRegeneration:
      constraint.preserveOnRegeneration ??
      false,
  };
}

function compileFreeConstraint(
  constraint: SharedSpatialConstraint,
): FreeContractConstraint {
  return {
    id: constraint.id,
    sourceConstraintId: constraint.id,
    targetElementId:
      constraint.targetElementId,
    property: constraint.property,
    mode: "free",
    value: constraint.value,
    unit: constraint.unit,
    generativeFreedom:
      constraint.generativeFreedom ??
      defaultGenerativeFreedom("free"),
    preserveOnRegeneration: false,
  };
}

function compileRegenerationScope(
  state: SharedLevelDesignState,
  options: BuildPlayableGenerationContractOptions,
  preservedElementIds: string[],
  preservedGameplayNodeIds: string[],
): RegenerationScope {
  const mode =
    options.regenerationMode ?? "full";

  return {
    mode,
    targetElementIds:
      mode === "local"
        ? unique(options.targetElementIds ?? [])
        : [],
    targetGameplayNodeIds:
      mode === "local"
        ? unique(
            options.targetGameplayNodeIds ?? [],
          )
        : [],
    lockedElementIds: unique([
      ...preservedElementIds,
      ...(options.lockedElementIds ?? []),
    ]),
    lockedGameplayNodeIds: unique([
      ...preservedGameplayNodeIds,
      ...(options.lockedGameplayNodeIds ?? []),
    ]),
  };
}

function collectIssues(
  state: SharedLevelDesignState,
  sceneElementIds: Set<string>,
): GenerationContractIssue[] {
  const issues: GenerationContractIssue[] = [];
  const graph = state.gameplay.graph;
  const nodeIds = new Set(
    graph.nodes.map((node) => node.id),
  );

  for (const constraint of
    state.spatial.constraints) {
    if (
      constraint.enabled &&
      constraint.status === "committed" &&
      !sceneElementIds.has(
        constraint.targetElementId,
      )
    ) {
      issues.push({
        id: `issue-${nanoid(8)}`,
        severity: "error",
        layer: "spatial",
        message:
          `Constraint ${constraint.id} targets a missing scene element.`,
        entityIds: [
          constraint.id,
          constraint.targetElementId,
        ],
      });
    }
  }

  for (const relation of graph.relations) {
    if (
      !nodeIds.has(relation.sourceNodeId) ||
      !nodeIds.has(relation.targetNodeId)
    ) {
      issues.push({
        id: `issue-${nanoid(8)}`,
        severity: "error",
        layer: "gameplay",
        message:
          `Relation ${relation.id} references a missing gameplay node.`,
        entityIds: [
          relation.id,
          relation.sourceNodeId,
          relation.targetNodeId,
        ],
      });
    }
  }

  for (const route of graph.routes) {
    if (
      !nodeIds.has(route.sourceNodeId) ||
      !nodeIds.has(route.targetNodeId)
    ) {
      issues.push({
        id: `issue-${nanoid(8)}`,
        severity: "error",
        layer: "gameplay",
        message:
          `Route ${route.id} references a missing gameplay node.`,
        entityIds: [
          route.id,
          route.sourceNodeId,
          route.targetNodeId,
        ],
      });
    }
  }

  if (
    graph.nodes.length > 0 &&
    !graph.nodes.some(
      (node) => node.type === "start",
    )
  ) {
    issues.push({
      id: `issue-${nanoid(8)}`,
      severity: "error",
      layer: "gameplay",
      message:
        "The gameplay graph has no start node.",
      entityIds: [],
    });
  }

  if (
    graph.nodes.length > 0 &&
    !graph.nodes.some(
      (node) => node.type === "goal",
    )
  ) {
    issues.push({
      id: `issue-${nanoid(8)}`,
      severity: "warning",
      layer: "gameplay",
      message:
        "The gameplay graph has no goal node.",
      entityIds: [],
    });
  }

  return issues;
}

export function buildPlayableGenerationContract(
  state: SharedLevelDesignState,
  options: BuildPlayableGenerationContractOptions = {},
): PlayableGenerationContract {
  const explicitlyLockedElements = new Set(
    options.lockedElementIds ?? [],
  );

  const sceneElements = compileSceneElements(
    state,
    explicitlyLockedElements,
  );

  const sceneElementIds = new Set(
    sceneElements.map((element) => element.id),
  );

  const activeConstraints =
    state.spatial.constraints.filter(
      (constraint) =>
        constraint.enabled &&
        constraint.status === "committed",
    );

  const exact = activeConstraints
    .filter(
      (constraint) =>
        constraint.mode === "exact",
    )
    .map(compileExactConstraint);

  const approximate = activeConstraints
    .filter(
      (constraint) =>
        constraint.mode === "approximate",
    )
    .map(compileApproximateConstraint);

  const free = activeConstraints
    .filter(
      (constraint) =>
        constraint.mode === "free",
    )
    .map(compileFreeConstraint);

  const preservedElementIds = sceneElements
    .filter((element) => element.preserve)
    .map((element) => element.id);

  const lockedElementIds = new Set([
    ...preservedElementIds,
    ...exact.map(
      (constraint) =>
        constraint.targetElementId,
    ),
    ...(options.lockedElementIds ?? []),
  ]);

  const explicitlyLockedNodes = new Set(
    options.lockedGameplayNodeIds ?? [],
  );

  const gameplayNodes: ContractGameplayNode[] =
    state.gameplay.graph.nodes.map((node) => {
      const sourceIds = [
        ...node.sourceObjectIds,
        ...node.sourceAssetIds,
      ];

      return {
        ...node,
        position: { ...node.position },
        sourceObjectIds: [
          ...node.sourceObjectIds,
        ],
        sourceAssetIds: [
          ...node.sourceAssetIds,
        ],
        preserve:
          explicitlyLockedNodes.has(node.id) ||
          sourceIds.some((id) =>
            lockedElementIds.has(id),
          ),
      };
    });

  const preservedGameplayNodeIds =
    gameplayNodes
      .filter((node) => node.preserve)
      .map((node) => node.id);

  const preservedNodeSet = new Set(
    preservedGameplayNodeIds,
  );

  const gameplayRelations:
    ContractGameplayRelation[] =
    state.gameplay.graph.relations.map(
      (relation) => ({
        ...relation,
        preserve:
          preservedNodeSet.has(
            relation.sourceNodeId,
          ) &&
          preservedNodeSet.has(
            relation.targetNodeId,
          ),
      }),
    );

  const gameplayRoutes:
    ContractGameplayRoute[] =
    state.gameplay.graph.routes.map(
      (route) => ({
        ...route,
        controlPointIds: [
          ...route.controlPointIds,
        ],
        sourceStrokeIds: [
          ...route.sourceStrokeIds,
        ],
        preserve:
          preservedNodeSet.has(
            route.sourceNodeId,
          ) &&
          preservedNodeSet.has(
            route.targetNodeId,
          ),
      }),
    );

  const regeneration =
    compileRegenerationScope(
      state,
      options,
      [...lockedElementIds],
      preservedGameplayNodeIds,
    );

  const issues = collectIssues(
    state,
    sceneElementIds,
  );

  const hasErrors = issues.some(
    (issue) => issue.severity === "error",
  );

  return {
    schemaVersion: "1.0",
    id: `generation-contract-${nanoid(8)}`,
    status: hasErrors ? "invalid" : "ready",
    source: {
      projectId: options.projectId,
      sharedStateRevision: state.revision,
      compiledAt:
        options.compiledAt ?? Date.now(),
    },
    seed: options.seed ?? 42017,
    scene: {
      worldSetting: state.scene.worldSetting,
      canvas: {
        width: options.canvasWidth ?? 960,
        height: options.canvasHeight ?? 560,
      },
      backgroundElementId:
        state.scene.backgroundElementId,
      elements: sceneElements,
    },
    spatial: {
      exact,
      approximate,
      free,
    },
    gameplay: {
      graphSchemaVersion:
        state.gameplay.graph.schemaVersion,
      nodes: gameplayNodes,
      relations: gameplayRelations,
      routes: gameplayRoutes,
      experienceGoals:
        state.experience.goals
          .filter(
            (goal) =>
              goal.status === "committed",
          )
          .map((goal) => ({
            id: goal.id,
            dimension: goal.dimension,
            description: goal.description,
            intensity: goal.intensity,
            weight: goal.weight ?? 1,
            order: goal.order,
            region: goal.region
              ? { ...goal.region }
              : undefined,
            targetGameplayNodeIds: [
              ...goal.targetGameplayNodeIds,
            ],
            required: goal.required ?? false,
          })),
      requireReachableGoal: true,
      requireReachableMandatoryNodes: true,
      allowDeadlocks: false,
    },
    regeneration,
    issues,
  };
}
