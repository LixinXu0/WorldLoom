import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildExperienceField,
} from "../core/field/buildExperienceField";

import {
  compileConstraints,
} from "../core/compiler/compileConstraints";

import {
  generateVariants,
} from "../core/generator/generateVariants";

import type {
  GameplayGraph,
} from "../core/gameplay/types";

import {
  createEmptySharedLevelDesignState,
  updateGameplayLayer,
  updateSceneLayer,
  updateSpatialLayer,
} from "../core/shared-state/sharedLevelDesignState";

import type {
  SharedSceneElement,
} from "../core/shared-state/types";

import {
  createSpatialConstraint,
  evaluateSpatialConstraint,
  setSpatialConstraintMode,
} from "../core/constraints/spatialConstraintModel";

import {
  createGameplayNegotiationSession,
  generateDefaultGameplayCandidates,
  selectGameplayCandidate,
  commitGameplayCandidate,
} from "../core/negotiation/gameplayInterpretation";

import {
  buildPlayableGenerationContract,
} from "../core/contract/buildPlayableGenerationContract";

import {
  validateGameplayGraph,
} from "../core/validator/validateGameplayGraph";

import {
  applyGameplayRepairs,
  generateGameplayRepairProposals,
} from "../core/validator/repairGameplayGraph";

import {
  createExampleStrokes,
} from "../examples/exampleProject";


const W = 960;
const H = 560;
const fixedTime = 1_725_000_000_000;


function playableGraph(): GameplayGraph {
  return {
    schemaVersion: "1.0",

    nodes: [
      {
        id: "start",
        type: "start",
        label: "Start",
        position: {
          x: 100,
          y: 280,
        },
        requirement: "mandatory",
        sourceObjectIds: [],
        sourceAssetIds: [],
      },
      {
        id: "branch",
        type: "branch",
        label: "Branch",
        position: {
          x: 420,
          y: 280,
        },
        requirement: "optional",
        sourceObjectIds: [
          "scene-branch",
        ],
        sourceAssetIds: [],
      },
      {
        id: "goal",
        type: "goal",
        label: "Goal",
        position: {
          x: 820,
          y: 280,
        },
        requirement: "mandatory",
        sourceObjectIds: [],
        sourceAssetIds: [],
      },
    ],

    relations: [],

    routes: [
      {
        id: "route-start-branch",
        type: "main_route",
        sourceNodeId: "start",
        targetNodeId: "branch",
        requirement: "mandatory",
        controlPointIds: [],
        sourceStrokeIds: [],
      },
      {
        id: "route-branch-goal",
        type: "main_route",
        sourceNodeId: "branch",
        targetNodeId: "goal",
        requirement: "mandatory",
        controlPointIds: [],
        sourceStrokeIds: [],
      },
    ],
  };
}


function brokenGraph(): GameplayGraph {
  return {
    schemaVersion: "1.0",

    nodes: [
      {
        id: "start",
        type: "start",
        label: "Start",
        position: {
          x: 100,
          y: 280,
        },
        requirement: "mandatory",
        sourceObjectIds: [],
        sourceAssetIds: [],
      },
      {
        id: "objective",
        type: "objective",
        label: "Objective",
        position: {
          x: 420,
          y: 280,
        },
        requirement: "mandatory",
        sourceObjectIds: [],
        sourceAssetIds: [],
      },
    ],

    relations: [],

    routes: [
      {
        id: "route-start-objective",
        type: "main_route",
        sourceNodeId: "start",
        targetNodeId: "objective",
        requirement: "mandatory",
        controlPointIds: [],
        sourceStrokeIds: [],
      },
    ],
  };
}


const sceneElement: SharedSceneElement = {
  id: "scene-branch",
  type: "asset",
  name: "Branch Landmark",

  transform: {
    position: {
      x: 420,
      y: 280,
    },
    rotation: 0,
    scale: 1,
  },

  semanticRoles: [
    "branch",
  ],

  preserved: false,
  status: "committed",

  provenance: {
    source: "user",
    sourceIds: [
      "scene-branch",
    ],
    updatedAt: fixedTime,
  },
};


describe(
  "Playable generation workflow",
  () => {
    it(
      "generates, selects, and commits a gameplay interpretation candidate",
      () => {
        const graph =
          playableGraph();

        const context = {
          sourceSceneElementIds: [
            "scene-branch",
          ],

          sourceSketchIds: [],

          sourceGameplayNodeIds: [
            "branch",
          ],

          currentGraph:
            graph,
        };

        const result =
          generateDefaultGameplayCandidates(
            context,
            fixedTime,
          );

        expect(
          result.candidates,
        ).toHaveLength(3);

        let session =
          createGameplayNegotiationSession(
            context,
            result.candidates,
            fixedTime,
          );

        session =
          selectGameplayCandidate(
            session,
            result.candidates[0].id,
            "user",
            fixedTime + 1,
          );

        expect(
          session.state
            .selectedCandidateId,
        ).toBe(
          result.candidates[0].id,
        );

        session =
          commitGameplayCandidate(
            session,
            undefined,
            fixedTime + 2,
          );

        expect(
          session.status,
        ).toBe("committed");

        expect(
          session.commitment,
        ).not.toBeNull();

        expect(
          session.state
            .committedCandidateIds,
        ).toContain(
          result.candidates[0].id,
        );
      },
    );


    it(
      "normalizes exact, approximate, and free spatial constraints",
      () => {
        const exact =
          createSpatialConstraint(
            {
              id: "SC-exact",
              targetElementId:
                "scene-branch",
              property:
                "position",
              mode: "exact",
              value: {
                x: 420,
                y: 280,
              },
            },
            fixedTime,
          );

        const approximate =
          setSpatialConstraintMode(
            exact,
            "approximate",
            fixedTime + 1,
          );

        const free =
          setSpatialConstraintMode(
            exact,
            "free",
            fixedTime + 2,
          );

        expect(
          exact.generativeFreedom,
        ).toBe(0);

        expect(
          exact.preserveOnRegeneration,
        ).toBe(true);

        expect(
          approximate.tolerance,
        ).toBeDefined();

        expect(
          approximate.generativeFreedom,
        ).toBe(0.5);

        expect(
          free.generativeFreedom,
        ).toBe(1);

        expect(
          free.preserveOnRegeneration,
        ).toBe(false);

        expect(
          evaluateSpatialConstraint(
            approximate,
            {
              x: 430,
              y: 280,
            },
          ).passed,
        ).toBe(true);
      },
    );


    it(
      "compiles the three-layer Generation Contract with a local regeneration scope",
      () => {
        const graph =
          playableGraph();

        let state =
          createEmptySharedLevelDesignState(
            graph,
            fixedTime,
          );

        state =
          updateSceneLayer(
            state,
            {
              worldSetting:
                "Flooded ruins",

              elements: [
                sceneElement,
              ],
            },
            fixedTime + 1,
          );

        const exact =
          createSpatialConstraint(
            {
              id: "SC-position",
              targetElementId:
                "scene-branch",
              property:
                "position",
              mode: "exact",
              value: {
                x: 420,
                y: 280,
              },
            },
            fixedTime + 2,
          );

        const approximate =
          createSpatialConstraint(
            {
              id: "SC-rotation",
              targetElementId:
                "scene-branch",
              property:
                "rotation",
              mode:
                "approximate",
              value: 0,
              tolerance: 15,
            },
            fixedTime + 3,
          );

        const free =
          createSpatialConstraint(
            {
              id: "SC-scale",
              targetElementId:
                "scene-branch",
              property:
                "scale",
              mode: "free",
              value: 1,
            },
            fixedTime + 4,
          );

        state =
          updateSpatialLayer(
            state,
            {
              constraints: [
                exact,
                approximate,
                free,
              ],
            },
            fixedTime + 5,
          );

        state =
          updateGameplayLayer(
            state,
            {
              graph,
            },
            fixedTime + 6,
          );

        const contract =
          buildPlayableGenerationContract(
            state,
            {
              projectId:
                "test-project",

              seed: 4217,

              canvasWidth: W,
              canvasHeight: H,

              regenerationMode:
                "local",

              targetElementIds: [
                "scene-branch",
              ],

              targetGameplayNodeIds: [
                "branch",
              ],

              compiledAt:
                fixedTime + 7,
            },
          );

        expect(
          contract.scene
            .worldSetting,
        ).toBe(
          "Flooded ruins",
        );

        expect(
          contract.spatial.exact,
        ).toHaveLength(1);

        expect(
          contract.spatial
            .approximate,
        ).toHaveLength(1);

        expect(
          contract.spatial.free,
        ).toHaveLength(1);

        expect(
          contract.regeneration
            .mode,
        ).toBe("local");

        expect(
          contract.regeneration
            .targetElementIds,
        ).toContain(
          "scene-branch",
        );

        expect(
          contract.regeneration
            .targetGameplayNodeIds,
        ).toContain(
          "branch",
        );

        expect(
          contract.regeneration
            .lockedElementIds,
        ).toContain(
          "scene-branch",
        );
      },
    );


    it(
      "detects an invalid gameplay graph and repairs it locally",
      () => {
        const graph =
          brokenGraph();

        const validation =
          validateGameplayGraph(
            graph,
            {
              checkedAt:
                fixedTime,
            },
          );

        expect(
          validation.valid,
        ).toBe(false);

        expect(
          validation.conflicts.some(
            (conflict) =>
              conflict.type ===
              "missing_goal",
          ),
        ).toBe(true);

        const proposals =
          generateGameplayRepairProposals(
            graph,
            validation,
            fixedTime + 1,
          );

        expect(
          proposals.length,
        ).toBeGreaterThan(0);

        const repaired =
          applyGameplayRepairs(
            graph,
            proposals,
            fixedTime + 2,
          );

        expect(
          repaired.proposals.every(
            (proposal) =>
              proposal.status ===
              "applied",
          ),
        ).toBe(true);

        expect(
          repaired.graph.nodes.some(
            (node) =>
              node.type ===
              "goal",
          ),
        ).toBe(true);

        expect(
          repaired.validation
            .conflicts.some(
              (conflict) =>
                conflict.type ===
                "missing_goal",
            ),
        ).toBe(false);
      },
    );


    it(
      "preserves locked rooms during local regeneration",
      () => {
        const strokes =
          createExampleStrokes();

        const constraints =
          compileConstraints(
            strokes,
          );

        const cells =
          buildExperienceField(
            strokes,
            W,
            H,
          );

        const previousVariants =
          generateVariants(
            strokes,
            constraints,
            cells,
            4217,
            W,
            H,
          );

        const previous =
          previousVariants[0];

        const lockedRoom =
          previous.rooms.find(
            (room) =>
              room.role !==
                "entrance" &&
              room.role !==
                "exit",
          ) ??
          previous.rooms[0];

        expect(
          lockedRoom,
        ).toBeDefined();

        const movedX =
          lockedRoom.x + 73;

        const preparedPrevious =
          previousVariants.map(
            (variant) =>
              variant.id ===
              previous.id
                ? {
                    ...variant,

                    rooms:
                      variant.rooms.map(
                        (room) =>
                          room.id ===
                          lockedRoom.id
                            ? {
                                ...room,
                                x: movedX,
                                locked: true,
                              }
                            : room,
                      ),
                  }
                : variant,
          );

        const targetRoom =
          previous.rooms.find(
            (room) =>
              room.id !==
              lockedRoom.id,
          );

        const regenerated =
          generateVariants(
            strokes,
            constraints,
            cells,
            4217,
            W,
            H,
            {
              regeneration: {
                mode: "local",

                previousVariants:
                  preparedPrevious,

                targetRoomIds:
                  targetRoom
                    ? [
                        targetRoom.id,
                      ]
                    : [],

                lockedRoomIds: [
                  lockedRoom.id,
                ],
              },
            },
          );

        const regeneratedVariant =
          regenerated.find(
            (variant) =>
              variant.id ===
              previous.id,
          );

        const preserved =
          regeneratedVariant
            ?.rooms.find(
              (room) =>
                room.id ===
                lockedRoom.id,
            );

        expect(
          regeneratedVariant
            ?.modified,
        ).toBe(true);

        expect(
          regeneratedVariant
            ?.revisionCount,
        ).toBe(1);

        expect(
          preserved?.x,
        ).toBe(movedX);

        expect(
          preserved?.locked,
        ).toBe(true);
      },
    );
  },
);
