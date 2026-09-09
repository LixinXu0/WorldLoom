import type {
  WorldloomProject,
} from "../types";

import type {
  GameplayGraph,
} from "../gameplay/types";

import type {
  GameplayRepairProposal,
  GameplayValidationResult,
} from "../shared-state/types";

import type {
  PlayableGenerationContract,
} from "../contract/types";

import {
  buildPlayableGenerationContract,
} from "../contract/buildPlayableGenerationContract";

import {
  migrateProject,
} from "../migration/migrateProject";

const PROJECT_VERSION = "5.0.0";

type SerializedWorldloomProject =
  WorldloomProject & {
    generationContract:
      PlayableGenerationContract;

    gameplayValidation:
      GameplayValidationResult | null;

    gameplayRepairs:
      GameplayRepairProposal[];
  };

function cloneGameplayGraph(
  graph: GameplayGraph,
): GameplayGraph {
  return {
    schemaVersion: "1.0",

    nodes: graph.nodes.map(
      (node) => ({
        ...node,

        position: {
          ...node.position,
        },

        sourceObjectIds: [
          ...node.sourceObjectIds,
        ],

        sourceAssetIds: [
          ...node.sourceAssetIds,
        ],
      }),
    ),

    relations: graph.relations.map(
      (relation) => ({
        ...relation,
      }),
    ),

    routes: graph.routes.map(
      (route) => ({
        ...route,

        controlPointIds: [
          ...route.controlPointIds,
        ],

        sourceStrokeIds: [
          ...route.sourceStrokeIds,
        ],
      }),
    ),
  };
}

function cloneValidation(
  validation:
    GameplayValidationResult | null | undefined,
): GameplayValidationResult | null {
  if (!validation) {
    return null;
  }

  return {
    ...validation,

    reachableNodeIds: [
      ...validation.reachableNodeIds,
    ],

    mandatoryNodeIds: [
      ...validation.mandatoryNodeIds,
    ],

    conflicts:
      validation.conflicts.map(
        (conflict) => ({
          ...conflict,

          nodeIds: [
            ...conflict.nodeIds,
          ],

          relationIds: [
            ...conflict.relationIds,
          ],

          routeIds: [
            ...conflict.routeIds,
          ],

          suggestedRepairIds: [
            ...conflict.suggestedRepairIds,
          ],
        }),
      ),
  };
}

function cloneRepairs(
  repairs:
    GameplayRepairProposal[] | undefined,
): GameplayRepairProposal[] {
  return (repairs ?? []).map(
    (repair) => ({
      ...repair,

      operations:
        repair.operations.map(
          (operation) => ({
            ...operation,
          }),
        ),

      provenance: {
        ...repair.provenance,

        sourceIds: [
          ...repair.provenance.sourceIds,
        ],
      },
    }),
  );
}

export function exportProject(
  project: WorldloomProject,
): string {
  const updatedAt = Date.now();

  const sharedGameplayGraph =
    project.sharedLevelDesignState.gameplay.graph;

  const legacyGameplayGraph =
    project.gameplayGraph;

  const sharedGraphHasContent =
    sharedGameplayGraph.nodes.length > 0 ||
    sharedGameplayGraph.relations.length > 0 ||
    sharedGameplayGraph.routes.length > 0;

  const legacyGraphHasContent =
    legacyGameplayGraph.nodes.length > 0 ||
    legacyGameplayGraph.relations.length > 0 ||
    legacyGameplayGraph.routes.length > 0;

  const gameplayGraph =
    cloneGameplayGraph(
      sharedGraphHasContent || !legacyGraphHasContent
        ? sharedGameplayGraph
        : legacyGameplayGraph,
    );

  const gameplayValidation =
    cloneValidation(
      project
        .sharedLevelDesignState
        .gameplay
        .validation,
    );

  const gameplayRepairs =
    cloneRepairs(
      project
        .sharedLevelDesignState
        .gameplay
        .repairs,
    );

  const sharedLevelDesignState = {
    ...project.sharedLevelDesignState,

    scene: {
      ...project.sharedLevelDesignState.scene,

      elements:
        project.sharedLevelDesignState
          .scene
          .elements
          .map((element) => ({
            ...element,

            transform:
              element.transform
                ? {
                    ...element.transform,

                    position: {
                      ...element
                        .transform
                        .position,
                    },
                  }
                : undefined,

            bounds:
              element.bounds
                ? {
                    ...element.bounds,
                  }
                : undefined,

            semanticRoles: [
              ...element.semanticRoles,
            ],

            provenance: {
              ...element.provenance,

              sourceIds: [
                ...element
                  .provenance
                  .sourceIds,
              ],
            },
          })),
    },

    spatial: {
      ...project.sharedLevelDesignState.spatial,

      constraints:
        project.sharedLevelDesignState
          .spatial
          .constraints
          .map((constraint) => ({
            ...constraint,

            tolerance:
              typeof constraint.tolerance ===
              "object"
                ? {
                    ...constraint.tolerance,

                    region:
                      constraint.tolerance.region
                        ? {
                            ...constraint
                              .tolerance
                              .region,
                          }
                        : undefined,
                  }
                : constraint.tolerance,

            provenance: {
              ...constraint.provenance,

              sourceIds: [
                ...constraint
                  .provenance
                  .sourceIds,
              ],
            },
          })),

      lastObservations:
        project.sharedLevelDesignState
          .spatial
          .lastObservations
          ?.map((observation) => ({
            ...observation,
          })) ?? [],
    },

    gameplay: {
      ...project.sharedLevelDesignState
        .gameplay,

      graph:
        gameplayGraph,

      negotiation:
        project.sharedLevelDesignState
          .gameplay
          .negotiation
          ? {
              ...project
                .sharedLevelDesignState
                .gameplay
                .negotiation,

              candidates:
                project
                  .sharedLevelDesignState
                  .gameplay
                  .negotiation
                  .candidates
                  .map((candidate) => ({
                    ...candidate,

                    sourceSceneElementIds: [
                      ...candidate
                        .sourceSceneElementIds,
                    ],

                    sourceSketchIds: [
                      ...candidate
                        .sourceSketchIds,
                    ],

                    choices:
                      candidate.choices.map(
                        (choice) => ({
                          ...choice,
                        }),
                      ),

                    proposedNodes:
                      candidate
                        .proposedNodes
                        .map((node) => ({
                          ...node,

                          position: {
                            ...node.position,
                          },

                          sourceObjectIds: [
                            ...node
                              .sourceObjectIds,
                          ],

                          sourceAssetIds: [
                            ...node
                              .sourceAssetIds,
                          ],
                        })),

                    proposedRelations:
                      candidate
                        .proposedRelations
                        .map((relation) => ({
                          ...relation,
                        })),

                    proposedRoutes:
                      candidate
                        .proposedRoutes
                        .map((route) => ({
                          ...route,

                          controlPointIds: [
                            ...route
                              .controlPointIds,
                          ],

                          sourceStrokeIds: [
                            ...route
                              .sourceStrokeIds,
                          ],
                        })),

                    provenance: {
                      ...candidate
                        .provenance,

                      sourceIds: [
                        ...candidate
                          .provenance
                          .sourceIds,
                      ],
                    },
                  })),

              committedCandidateIds: [
                ...project
                  .sharedLevelDesignState
                  .gameplay
                  .negotiation
                  .committedCandidateIds,
              ],
            }
          : undefined,

      validation:
        gameplayValidation,

      repairs:
        gameplayRepairs,
    },

    experience: {
      ...project.sharedLevelDesignState
        .experience,

      goals:
        project.sharedLevelDesignState
          .experience
          .goals
          .map((goal) => ({
            ...goal,

            region:
              goal.region
                ? {
                    ...goal.region,
                  }
                : undefined,

            targetGameplayNodeIds: [
              ...goal
                .targetGameplayNodeIds,
            ],

            provenance: {
              ...goal.provenance,

              sourceIds: [
                ...goal
                  .provenance
                  .sourceIds,
              ],
            },
          })),
    },

    updatedAt,
  };

  const generationContract =
    buildPlayableGenerationContract(
      sharedLevelDesignState,
      {
        projectId:
          project.projectId,

        seed:
          project.seed,

        canvasWidth:
          project.metadata
            .canvasWidth,

        canvasHeight:
          project.metadata
            .canvasHeight,

        regenerationMode:
          "full",

        compiledAt:
          updatedAt,
      },
    );

  const revisions =
    project.revisions.map(
      (revision) => ({
        ...revision,

        projectSnapshot: {
          ...revision.projectSnapshot,

          revisions: [] as [],
        },
      }),
    );

  const exportedProject:
    SerializedWorldloomProject = {
    ...project,

    version:
      PROJECT_VERSION,

    // 保留旧字段，同时与共享状态保持一致。
    gameplayGraph,

    sharedLevelDesignState,

    generationContract,

    gameplayValidation,

    gameplayRepairs,

    revisions,

    metadata: {
      ...project.metadata,

      updatedAt,
    },
  };

  return JSON.stringify(
    exportedProject,
    null,
    2,
  );
}

export function importProjectJson(
  text: string,
):
  | {
      ok: true;
      project: WorldloomProject;
    }
  | {
      ok: false;
      error: string;
    } {
  try {
    const parsed =
      JSON.parse(text) as unknown;

    return migrateProject(parsed);
  } catch {
    return {
      ok: false,

      error:
        "The selected file is not valid JSON.",
    };
  }
}
