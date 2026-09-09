import { nanoid } from "nanoid";

import type {
  GameplayGraph,
  GameplayNode,
  GameplayRelation,
  GameplayRoute,
  GameplayRouteType,
} from "../gameplay/types";
import type { SharedGameplayCandidate } from "../shared-state/types";
import type {
  CreateGameplayCandidateInput,
  GameplayCandidateDraft,
  GameplayCandidatePatch,
  GameplayCandidateResult,
  GameplayNegotiationContext,
  GameplayNegotiationSession,
} from "./types";

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function cloneNode(node: GameplayNode): GameplayNode {
  return {
    ...node,
    position: { ...node.position },
    sourceObjectIds: [...node.sourceObjectIds],
    sourceAssetIds: [...node.sourceAssetIds],
  };
}

function cloneRelation(relation: GameplayRelation): GameplayRelation {
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

function selectedNodes(context: GameplayNegotiationContext): GameplayNode[] {
  const selectedIds = new Set(context.sourceGameplayNodeIds);
  return context.currentGraph.nodes
    .filter((node) => selectedIds.has(node.id))
    .map(cloneNode);
}

function selectedRoutes(context: GameplayNegotiationContext): GameplayRoute[] {
  const selectedIds = new Set(context.sourceGameplayNodeIds);
  return context.currentGraph.routes
    .filter(
      (route) =>
        selectedIds.has(route.sourceNodeId) ||
        selectedIds.has(route.targetNodeId),
    )
    .map(cloneRoute);
}

function routesWithType(
  routes: GameplayRoute[],
  type: GameplayRouteType,
  requirement: GameplayRoute["requirement"],
): GameplayRoute[] {
  return routes.map((route) => ({
    ...route,
    type,
    requirement,
  }));
}

export function createGameplayCandidate(
  input: CreateGameplayCandidateInput,
  createdAt = Date.now(),
): SharedGameplayCandidate {
  const sourceIds = [
    ...input.context.sourceSceneElementIds,
    ...input.context.sourceSketchIds,
    ...input.context.sourceGameplayNodeIds,
  ];

  return {
    id: input.id ?? `GIC-${nanoid(8)}`,
    label: input.label,
    summary: input.summary,
    rationale: input.rationale,
    confidence: clampConfidence(input.confidence),
    sourceSceneElementIds: [...input.context.sourceSceneElementIds],
    sourceSketchIds: [...input.context.sourceSketchIds],
    choices: input.choices.map((choice) => ({ ...choice })),
    proposedNodes: input.proposedNodes.map(cloneNode),
    proposedRelations: input.proposedRelations.map(cloneRelation),
    proposedRoutes: input.proposedRoutes.map(cloneRoute),
    status: "candidate",
    provenance: {
      source: input.provenance?.source ?? "mixed",
      sourceIds: input.provenance?.sourceIds
        ? [...input.provenance.sourceIds]
        : sourceIds,
      explanation:
        input.provenance?.explanation ??
        "Gameplay interpretation generated from the selected context.",
      model: input.provenance?.model,
      createdAt: input.provenance?.createdAt ?? createdAt,
      updatedAt: input.provenance?.updatedAt ?? createdAt,
    },
  };
}

function defaultDrafts(
  context: GameplayNegotiationContext,
): GameplayCandidateDraft[] {
  const nodes = selectedNodes(context);
  const routes = selectedRoutes(context);

  return [
    {
      label: "Optional combat detour",
      summary: "Treat the selected structure as an optional risk-reward branch.",
      rationale:
        "The player may enter the branch for a harder encounter and bonus reward, then reconnect to the main route.",
      confidence: 0.78,
      choices: [
        { dimension: "mandatoryness", value: "optional" },
        { dimension: "reward_function", value: "bonus" },
        { dimension: "route_function", value: "detour" },
        { dimension: "encounter_function", value: "optional_challenge" },
        { dimension: "progression_role", value: "optional_support" },
      ],
      proposedNodes: nodes.map((node) => ({
        ...node,
        requirement: "optional",
      })),
      proposedRelations: [],
      proposedRoutes: routesWithType(
        routes,
        "optional_route",
        "optional",
      ),
    },
    {
      label: "Mandatory objective route",
      summary: "Treat the selected structure as required progression.",
      rationale:
        "The selected objective or reward is required before the player can continue through the gated route.",
      confidence: 0.66,
      choices: [
        { dimension: "mandatoryness", value: "mandatory" },
        {
          dimension: "reward_function",
          value: "progression_critical",
        },
        { dimension: "route_function", value: "gated_route" },
        { dimension: "encounter_function", value: "mandatory_challenge" },
        { dimension: "progression_role", value: "mandatory_progression" },
      ],
      proposedNodes: nodes.map((node) => ({
        ...node,
        requirement: "mandatory",
      })),
      proposedRelations: [],
      proposedRoutes: routesWithType(
        routes,
        "gated_route",
        "mandatory",
      ),
    },
    {
      label: "Risky shortcut",
      summary: "Treat the selected route as an optional shortcut.",
      rationale:
        "The route reduces travel distance but introduces an optional encounter or other risk before reconnecting.",
      confidence: 0.7,
      choices: [
        { dimension: "mandatoryness", value: "optional" },
        { dimension: "reward_function", value: "none" },
        { dimension: "route_function", value: "shortcut" },
        { dimension: "encounter_function", value: "obstacle" },
        { dimension: "progression_role", value: "reconnect" },
      ],
      proposedNodes: nodes.map((node) => ({
        ...node,
        requirement: "optional",
      })),
      proposedRelations: [],
      proposedRoutes: routesWithType(routes, "shortcut", "optional"),
    },
  ];
}

export function generateDefaultGameplayCandidates(
  context: GameplayNegotiationContext,
  generatedAt = Date.now(),
): GameplayCandidateResult {
  return {
    candidates: defaultDrafts(context).map((draft, index) =>
      createGameplayCandidate(
        {
          ...draft,
          id: `GIC-${index + 1}-${nanoid(6)}`,
          context,
          provenance: {
            source: "system",
            explanation:
              "Rule-based candidate generated to expose a structurally distinct gameplay interpretation.",
          },
        },
        generatedAt,
      ),
    ),
    generatedAt,
    source: "rule_based",
  };
}

export function createGameplayNegotiationSession(
  context: GameplayNegotiationContext,
  candidates: SharedGameplayCandidate[] = [],
  createdAt = Date.now(),
): GameplayNegotiationSession {
  return {
    id: `GNS-${nanoid(8)}`,
    status: candidates.length > 0 ? "candidates_ready" : "idle",
    context: {
      ...context,
      sourceSceneElementIds: [...context.sourceSceneElementIds],
      sourceSketchIds: [...context.sourceSketchIds],
      sourceGameplayNodeIds: [...context.sourceGameplayNodeIds],
      currentGraph: cloneGraph(context.currentGraph),
    },
    state: {
      candidates: candidates.map((candidate) => ({ ...candidate })),
      selectedCandidateId: null,
      committedCandidateIds: [],
    },
    selection: null,
    commitment: null,
    createdAt,
    updatedAt: createdAt,
  };
}

export function replaceGameplayCandidates(
  session: GameplayNegotiationSession,
  result: GameplayCandidateResult,
): GameplayNegotiationSession {
  return {
    ...session,
    status: result.candidates.length > 0 ? "candidates_ready" : "idle",
    state: {
      candidates: result.candidates.map((candidate) => ({ ...candidate })),
      selectedCandidateId: null,
      committedCandidateIds: [],
    },
    selection: null,
    commitment: null,
    updatedAt: result.generatedAt,
  };
}

export function updateGameplayCandidate(
  session: GameplayNegotiationSession,
  candidateId: string,
  patch: GameplayCandidatePatch,
  updatedAt = Date.now(),
): GameplayNegotiationSession {
  const exists = session.state.candidates.some(
    (candidate) => candidate.id === candidateId,
  );
  if (!exists) {
    throw new Error(`Gameplay candidate does not exist: ${candidateId}`);
  }

  return {
    ...session,
    state: {
      ...session.state,
      candidates: session.state.candidates.map((candidate) =>
        candidate.id === candidateId
          ? {
              ...candidate,
              ...patch,
              confidence:
                patch.confidence === undefined
                  ? candidate.confidence
                  : clampConfidence(patch.confidence),
              choices: patch.choices
                ? patch.choices.map((choice) => ({ ...choice }))
                : candidate.choices,
              proposedNodes: patch.proposedNodes
                ? patch.proposedNodes.map(cloneNode)
                : candidate.proposedNodes,
              proposedRelations: patch.proposedRelations
                ? patch.proposedRelations.map(cloneRelation)
                : candidate.proposedRelations,
              proposedRoutes: patch.proposedRoutes
                ? patch.proposedRoutes.map(cloneRoute)
                : candidate.proposedRoutes,
              provenance: {
                ...candidate.provenance,
                source: "mixed",
                updatedAt,
              },
            }
          : candidate,
      ),
    },
    updatedAt,
  };
}

export function selectGameplayCandidate(
  session: GameplayNegotiationSession,
  candidateId: string,
  selectedBy: "user" | "ai" = "user",
  selectedAt = Date.now(),
): GameplayNegotiationSession {
  const candidate = session.state.candidates.find(
    (item) => item.id === candidateId,
  );
  if (!candidate || candidate.status === "rejected") {
    throw new Error(`Selectable gameplay candidate does not exist: ${candidateId}`);
  }

  return {
    ...session,
    status: "candidate_selected",
    state: {
      ...session.state,
      selectedCandidateId: candidateId,
    },
    selection: { candidateId, selectedAt, selectedBy },
    updatedAt: selectedAt,
  };
}

export function rejectGameplayCandidate(
  session: GameplayNegotiationSession,
  candidateId: string,
  rejectedAt = Date.now(),
): GameplayNegotiationSession {
  const updated = updateGameplayCandidate(
    session,
    candidateId,
    {},
    rejectedAt,
  );

  return {
    ...updated,
    status:
      updated.state.selectedCandidateId === candidateId
        ? "candidates_ready"
        : updated.status,
    state: {
      ...updated.state,
      selectedCandidateId:
        updated.state.selectedCandidateId === candidateId
          ? null
          : updated.state.selectedCandidateId,
      candidates: updated.state.candidates.map((candidate) =>
        candidate.id === candidateId
          ? { ...candidate, status: "rejected" }
          : candidate,
      ),
    },
    selection:
      updated.selection?.candidateId === candidateId
        ? null
        : updated.selection,
  };
}

function upsertById<T extends { id: string }>(
  existing: T[],
  proposed: T[],
): T[] {
  const result = new Map(existing.map((item) => [item.id, item]));
  for (const item of proposed) result.set(item.id, item);
  return [...result.values()];
}

function mergeCandidateIntoGraph(
  graph: GameplayGraph,
  candidate: SharedGameplayCandidate,
): GameplayGraph {
  const nodes = upsertById(
    graph.nodes.map(cloneNode),
    candidate.proposedNodes.map(cloneNode),
  );
  const nodeIds = new Set(nodes.map((node) => node.id));

  const relations = candidate.proposedRelations.map(cloneRelation);
  const routes = candidate.proposedRoutes.map(cloneRoute);

  for (const relation of relations) {
    if (
      !nodeIds.has(relation.sourceNodeId) ||
      !nodeIds.has(relation.targetNodeId)
    ) {
      throw new Error(
        `Candidate relation references a missing node: ${relation.id}`,
      );
    }
  }

  for (const route of routes) {
    if (
      !nodeIds.has(route.sourceNodeId) ||
      !nodeIds.has(route.targetNodeId)
    ) {
      throw new Error(
        `Candidate route references a missing node: ${route.id}`,
      );
    }
  }

  return {
    schemaVersion: "1.0",
    nodes,
    relations: upsertById(
      graph.relations.map(cloneRelation),
      relations,
    ),
    routes: upsertById(graph.routes.map(cloneRoute), routes),
  };
}

export function commitGameplayCandidate(
  session: GameplayNegotiationSession,
  candidateId = session.state.selectedCandidateId,
  committedAt = Date.now(),
): GameplayNegotiationSession {
  if (!candidateId) {
    throw new Error("No gameplay candidate has been selected.");
  }

  const candidate = session.state.candidates.find(
    (item) => item.id === candidateId,
  );
  if (!candidate || candidate.status === "rejected") {
    throw new Error(`Committable gameplay candidate does not exist: ${candidateId}`);
  }

  const resultingGraph = mergeCandidateIntoGraph(
    session.context.currentGraph,
    candidate,
  );

  return {
    ...session,
    status: "committed",
    state: {
      candidates: session.state.candidates.map((item) => ({
        ...item,
        status:
          item.id === candidateId
            ? "committed"
            : item.status === "candidate"
              ? "superseded"
              : item.status,
      })),
      selectedCandidateId: candidateId,
      committedCandidateIds: [
        ...new Set([
          ...session.state.committedCandidateIds,
          candidateId,
        ]),
      ],
    },
    selection:
      session.selection ?? {
        candidateId,
        selectedAt: committedAt,
        selectedBy: "user",
      },
    commitment: {
      candidateId,
      committedAt,
      committedBy: "user",
      resultingGraph,
    },
    updatedAt: committedAt,
  };
}
