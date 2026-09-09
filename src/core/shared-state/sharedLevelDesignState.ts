import { createEmptyGameplayGraph } from "../gameplay/types";
import type { GameplayGraph } from "../gameplay/types";
import type {
  ExperienceLayer,
  GameplayNegotiationState,
  GameplayRepairProposal,
  GameplayValidationResult,
  GameplayLayer,
  SceneLayer,
  SharedExperienceGoal,
  SharedGameplayCandidate,
  SharedLevelDesignState,
  SharedSceneElement,
  SharedSpatialConstraint,
  SpatialConstraintObservation,
  SpatialLayer,
} from "./types";

export type SharedLevelDesignStateUpdate = {
  scene?: Partial<SceneLayer>;
  spatial?: Partial<SpatialLayer>;
  gameplay?: Partial<GameplayLayer>;
  experience?: Partial<ExperienceLayer>;
};

function cloneGameplayGraph(graph: GameplayGraph): GameplayGraph {
  return {
    schemaVersion: "1.0",
    nodes: graph.nodes.map((node) => ({
      ...node,
      position: { ...node.position },
      sourceObjectIds: [...node.sourceObjectIds],
      sourceAssetIds: [...node.sourceAssetIds],
    })),
    relations: graph.relations.map((relation) => ({ ...relation })),
    routes: graph.routes.map((route) => ({
      ...route,
      controlPointIds: [...route.controlPointIds],
      sourceStrokeIds: [...route.sourceStrokeIds],
    })),
  };
}

function cloneGameplayCandidate(
  candidate: SharedGameplayCandidate,
): SharedGameplayCandidate {
  return {
    ...candidate,
    sourceSceneElementIds: [
      ...candidate.sourceSceneElementIds,
    ],
    sourceSketchIds: [...candidate.sourceSketchIds],
    choices: candidate.choices.map((choice) => ({ ...choice })),
    proposedNodes: cloneGameplayGraph({
      schemaVersion: "1.0",
      nodes: candidate.proposedNodes,
      relations: [],
      routes: [],
    }).nodes,
    proposedRelations: candidate.proposedRelations.map(
      (relation) => ({ ...relation }),
    ),
    proposedRoutes: candidate.proposedRoutes.map((route) => ({
      ...route,
      controlPointIds: [...route.controlPointIds],
      sourceStrokeIds: [...route.sourceStrokeIds],
    })),
    provenance: {
      ...candidate.provenance,
      sourceIds: [...candidate.provenance.sourceIds],
    },
  };
}

function cloneNegotiationState(
  negotiation: GameplayNegotiationState,
): GameplayNegotiationState {
  return {
    candidates: negotiation.candidates.map(
      cloneGameplayCandidate,
    ),
    selectedCandidateId:
      negotiation.selectedCandidateId,
    committedCandidateIds: [
      ...negotiation.committedCandidateIds,
    ],
  };
}

function cloneValidationResult(
  validation: GameplayValidationResult,
): GameplayValidationResult {
  return {
    ...validation,
    reachableNodeIds: [...validation.reachableNodeIds],
    mandatoryNodeIds: [...validation.mandatoryNodeIds],
    conflicts: validation.conflicts.map((conflict) => ({
      ...conflict,
      nodeIds: [...conflict.nodeIds],
      relationIds: [...conflict.relationIds],
      routeIds: [...conflict.routeIds],
      suggestedRepairIds: [
        ...conflict.suggestedRepairIds,
      ],
    })),
  };
}

function cloneRepairProposal(
  repair: GameplayRepairProposal,
): GameplayRepairProposal {
  return {
    ...repair,
    operations: repair.operations.map((operation) => ({
      ...operation,
    })),
    provenance: {
      ...repair.provenance,
      sourceIds: [...repair.provenance.sourceIds],
    },
  };
}

function cloneGameplayLayer(
  layer: GameplayLayer,
): GameplayLayer {
  return {
    graph: cloneGameplayGraph(layer.graph),
    negotiation: layer.negotiation
      ? cloneNegotiationState(layer.negotiation)
      : undefined,
    validation: layer.validation
      ? cloneValidationResult(layer.validation)
      : layer.validation,
    repairs: layer.repairs
      ? layer.repairs.map(cloneRepairProposal)
      : undefined,
  };
}

function isGameplayGraph(
  value: GameplayGraph | Partial<GameplayLayer>,
): value is GameplayGraph {
  return (
    "nodes" in value &&
    "relations" in value &&
    "routes" in value
  );
}

function nextRevision(
  state: SharedLevelDesignState,
  updatedAt = Date.now(),
): Pick<SharedLevelDesignState, "revision" | "updatedAt"> {
  return {
    revision: state.revision + 1,
    updatedAt,
  };
}

export function createEmptySharedLevelDesignState(
  gameplayGraph: GameplayGraph = createEmptyGameplayGraph(),
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return {
    schemaVersion: "1.0",
    revision: 0,
    scene: {
      worldSetting: "",
      elements: [],
    },
    spatial: {
      constraints: [],
    },
    gameplay: {
      graph: cloneGameplayGraph(gameplayGraph),
    },
    experience: {
      goals: [],
      summary: "",
    },
    updatedAt,
  };
}

export function updateSceneLayer(
  state: SharedLevelDesignState,
  patch: Partial<SceneLayer>,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return {
    ...state,
    ...nextRevision(state, updatedAt),
    scene: {
      ...state.scene,
      ...patch,
      elements: patch.elements
        ? [...patch.elements]
        : state.scene.elements,
    },
  };
}

export function updateSpatialLayer(
  state: SharedLevelDesignState,
  patch: Partial<SpatialLayer>,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return {
    ...state,
    ...nextRevision(state, updatedAt),
    spatial: {
      ...state.spatial,
      ...patch,
      constraints: patch.constraints
        ? [...patch.constraints]
        : state.spatial.constraints,
    },
  };
}

export function updateGameplayLayer(
  state: SharedLevelDesignState,
  graphOrPatch: GameplayGraph | Partial<GameplayLayer>,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  const patch: Partial<GameplayLayer> =
    isGameplayGraph(graphOrPatch)
      ? { graph: graphOrPatch }
      : graphOrPatch;

  return {
    ...state,
    ...nextRevision(state, updatedAt),
    gameplay: {
      ...state.gameplay,
      ...patch,
      graph: patch.graph
        ? cloneGameplayGraph(patch.graph)
        : cloneGameplayGraph(state.gameplay.graph),
      negotiation: patch.negotiation
        ? cloneNegotiationState(patch.negotiation)
        : patch.negotiation === null
          ? undefined
          : state.gameplay.negotiation
            ? cloneNegotiationState(
                state.gameplay.negotiation,
              )
            : undefined,
      validation:
        patch.validation === null
          ? null
          : patch.validation
            ? cloneValidationResult(patch.validation)
            : state.gameplay.validation
              ? cloneValidationResult(
                  state.gameplay.validation,
                )
              : state.gameplay.validation,
      repairs: patch.repairs
        ? patch.repairs.map(cloneRepairProposal)
        : state.gameplay.repairs
          ? state.gameplay.repairs.map(
              cloneRepairProposal,
            )
          : undefined,
    },
  };
}

export function updateExperienceLayer(
  state: SharedLevelDesignState,
  patch: Partial<ExperienceLayer>,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return {
    ...state,
    ...nextRevision(state, updatedAt),
    experience: {
      ...state.experience,
      ...patch,
      goals: patch.goals
        ? [...patch.goals]
        : state.experience.goals,
    },
  };
}

export function synchronizeSharedLevelDesignState(
  state: SharedLevelDesignState,
  update: SharedLevelDesignStateUpdate,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return {
    ...state,
    ...nextRevision(state, updatedAt),
    scene: {
      ...state.scene,
      ...update.scene,
      elements: update.scene?.elements
        ? [...update.scene.elements]
        : state.scene.elements,
    },
    spatial: {
      ...state.spatial,
      ...update.spatial,
      constraints: update.spatial?.constraints
        ? [...update.spatial.constraints]
        : state.spatial.constraints,
      lastObservations:
        update.spatial?.lastObservations
          ? update.spatial.lastObservations.map(
              (observation) => ({ ...observation }),
            )
          : state.spatial.lastObservations,
    },
    gameplay: cloneGameplayLayer({
      ...state.gameplay,
      ...update.gameplay,
      graph:
        update.gameplay?.graph ??
        state.gameplay.graph,
    }),
    experience: {
      ...state.experience,
      ...update.experience,
      goals: update.experience?.goals
        ? [...update.experience.goals]
        : state.experience.goals,
    },
  };
}

export function upsertSceneElement(
  state: SharedLevelDesignState,
  element: SharedSceneElement,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  const exists = state.scene.elements.some(
    (item) => item.id === element.id,
  );

  const elements = exists
    ? state.scene.elements.map((item) =>
        item.id === element.id ? element : item,
      )
    : [...state.scene.elements, element];

  return updateSceneLayer(state, { elements }, updatedAt);
}

export function removeSceneElement(
  state: SharedLevelDesignState,
  elementId: string,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return updateSceneLayer(
    state,
    {
      elements: state.scene.elements.filter(
        (element) => element.id !== elementId,
      ),
      backgroundElementId:
        state.scene.backgroundElementId === elementId
          ? undefined
          : state.scene.backgroundElementId,
    },
    updatedAt,
  );
}

export function upsertSpatialConstraint(
  state: SharedLevelDesignState,
  constraint: SharedSpatialConstraint,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  const exists = state.spatial.constraints.some(
    (item) => item.id === constraint.id,
  );

  const constraints = exists
    ? state.spatial.constraints.map((item) =>
        item.id === constraint.id ? constraint : item,
      )
    : [...state.spatial.constraints, constraint];

  return updateSpatialLayer(state, { constraints }, updatedAt);
}

export function removeSpatialConstraint(
  state: SharedLevelDesignState,
  constraintId: string,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return updateSpatialLayer(
    state,
    {
      constraints: state.spatial.constraints.filter(
        (constraint) => constraint.id !== constraintId,
      ),
    },
    updatedAt,
  );
}

export function replaceSpatialConstraints(
  state: SharedLevelDesignState,
  constraints: SharedSpatialConstraint[],
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return updateSpatialLayer(
    state,
    {
      constraints: constraints.map((constraint) => ({
        ...constraint,
        provenance: {
          ...constraint.provenance,
          sourceIds: [
            ...constraint.provenance.sourceIds,
          ],
        },
      })),
    },
    updatedAt,
  );
}

export function setSpatialConstraintObservations(
  state: SharedLevelDesignState,
  observations: SpatialConstraintObservation[],
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return updateSpatialLayer(
    state,
    {
      lastObservations: observations.map(
        (observation) => ({ ...observation }),
      ),
    },
    updatedAt,
  );
}

export function setGameplayCandidates(
  state: SharedLevelDesignState,
  candidates: SharedGameplayCandidate[],
  updatedAt = Date.now(),
): SharedLevelDesignState {
  const committedCandidateIds = candidates
    .filter(
      (candidate) =>
        candidate.status === "committed",
    )
    .map((candidate) => candidate.id);

  const selectedCandidateId =
    state.gameplay.negotiation
      ?.selectedCandidateId;

  return updateGameplayLayer(
    state,
    {
      negotiation: {
        candidates,
        selectedCandidateId:
          selectedCandidateId &&
          candidates.some(
            (candidate) =>
              candidate.id === selectedCandidateId,
          )
            ? selectedCandidateId
            : null,
        committedCandidateIds,
      },
    },
    updatedAt,
  );
}

export function selectGameplayCandidate(
  state: SharedLevelDesignState,
  candidateId: string | null,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  const negotiation =
    state.gameplay.negotiation ?? {
      candidates: [],
      selectedCandidateId: null,
      committedCandidateIds: [],
    };

  if (
    candidateId &&
    !negotiation.candidates.some(
      (candidate) => candidate.id === candidateId,
    )
  ) {
    throw new Error(
      `Gameplay candidate does not exist: ${candidateId}`,
    );
  }

  return updateGameplayLayer(
    state,
    {
      negotiation: {
        ...negotiation,
        selectedCandidateId: candidateId,
      },
    },
    updatedAt,
  );
}

export function commitGameplayCandidate(
  state: SharedLevelDesignState,
  candidateId: string,
  resultingGraph: GameplayGraph,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  const negotiation = state.gameplay.negotiation;
  const candidate = negotiation?.candidates.find(
    (item) => item.id === candidateId,
  );

  if (!negotiation || !candidate) {
    throw new Error(
      `Gameplay candidate does not exist: ${candidateId}`,
    );
  }

  return updateGameplayLayer(
    state,
    {
      graph: resultingGraph,
      negotiation: {
        candidates: negotiation.candidates.map(
          (item) => ({
            ...item,
            status:
              item.id === candidateId
                ? "committed"
                : item.status === "candidate"
                  ? "superseded"
                  : item.status,
            provenance: {
              ...item.provenance,
              updatedAt,
            },
          }),
        ),
        selectedCandidateId: candidateId,
        committedCandidateIds: [
          ...new Set([
            ...negotiation.committedCandidateIds,
            candidateId,
          ]),
        ],
      },
      validation: null,
      repairs: [],
    },
    updatedAt,
  );
}

export function setGameplayValidationResult(
  state: SharedLevelDesignState,
  validation: GameplayValidationResult | null,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return updateGameplayLayer(
    state,
    { validation },
    updatedAt,
  );
}

export function setGameplayRepairProposals(
  state: SharedLevelDesignState,
  repairs: GameplayRepairProposal[],
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return updateGameplayLayer(
    state,
    { repairs },
    updatedAt,
  );
}

export function upsertGameplayRepairProposal(
  state: SharedLevelDesignState,
  repair: GameplayRepairProposal,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  const currentRepairs =
    state.gameplay.repairs ?? [];
  const exists = currentRepairs.some(
    (item) => item.id === repair.id,
  );

  const repairs = exists
    ? currentRepairs.map((item) =>
        item.id === repair.id ? repair : item,
      )
    : [...currentRepairs, repair];

  return setGameplayRepairProposals(
    state,
    repairs,
    updatedAt,
  );
}

export function synchronizeGameplayRepairResult(
  state: SharedLevelDesignState,
  graph: GameplayGraph,
  repair: GameplayRepairProposal,
  validation: GameplayValidationResult,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  const currentRepairs =
    state.gameplay.repairs ?? [];

  const repairs = currentRepairs.some(
    (item) => item.id === repair.id,
  )
    ? currentRepairs.map((item) =>
        item.id === repair.id ? repair : item,
      )
    : [...currentRepairs, repair];

  return updateGameplayLayer(
    state,
    {
      graph,
      validation,
      repairs,
    },
    updatedAt,
  );
}

export function upsertExperienceGoal(
  state: SharedLevelDesignState,
  goal: SharedExperienceGoal,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  const exists = state.experience.goals.some(
    (item) => item.id === goal.id,
  );

  const goals = exists
    ? state.experience.goals.map((item) =>
        item.id === goal.id ? goal : item,
      )
    : [...state.experience.goals, goal];

  return updateExperienceLayer(state, { goals }, updatedAt);
}

export function removeExperienceGoal(
  state: SharedLevelDesignState,
  goalId: string,
  updatedAt = Date.now(),
): SharedLevelDesignState {
  return updateExperienceLayer(
    state,
    {
      goals: state.experience.goals.filter(
        (goal) => goal.id !== goalId,
      ),
    },
    updatedAt,
  );
}
