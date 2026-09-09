import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  addGameplayNode,
  addGameplayRelation,
  addGameplayRoute,
  createGameplayNode,
  createGameplayRelation,
  createGameplayRoute,
  removeGameplayNode,
  updateGameplayNode,
  updateGameplayRoute,
} from "../core/gameplay/gameplayGraph";

import {
  createEmptyGameplayGraph,
  type GameplayGraph,
} from "../core/gameplay/types";

import {
  buildMainPath,
} from "../core/generator/buildTopology";

import {
  migrateProject,
} from "../core/migration/migrateProject";

import {
  exportProject,
  importProjectJson,
} from "../core/serialization/projectJson";

import {
  createEmptyProject,
} from "../examples/exampleProject";

import {
  useWorldloomStore,
} from "../store/useWorldloomStore";

function graphWithStartAndGoal(): GameplayGraph {
  let graph =
    createEmptyGameplayGraph();

  graph = addGameplayNode(
    graph,
    createGameplayNode({
      id: "start",
      type: "start",
      label: "Player Start",
      position: {
        x: 80,
        y: 280,
      },
      requirement: "mandatory",
    }),
  );

  graph = addGameplayNode(
    graph,
    createGameplayNode({
      id: "goal",
      type: "goal",
      label: "Goal",
      position: {
        x: 880,
        y: 280,
      },
      requirement: "mandatory",
    }),
  );

  return graph;
}

describe("Gameplay structure", () => {
  beforeEach(() => {
    useWorldloomStore.setState({
      project: createEmptyProject(),
      selected: null,
      undoHistory: [],
      redoHistory: [],
      researchLog: [],
    });
  });

  it(
    "creates a new project with an empty Gameplay Graph",
    () => {
      const project =
        createEmptyProject();

      expect(project.version).toBe(
        "5.0.0",
      );

      expect(
        project.gameplayGraph,
      ).toEqual({
        schemaVersion: "1.0",
        nodes: [],
        relations: [],
        routes: [],
      });
    },
  );

  it(
    "creates and updates gameplay nodes",
    () => {
      let graph =
        graphWithStartAndGoal();

      graph = addGameplayNode(
        graph,
        createGameplayNode({
          id: "reward",
          type: "reward",
          label: "Rare Reward",

          position: {
            x: 420,
            y: 390,
          },

          requirement: "optional",

          sourceObjectIds: [
            "sketch-reward",
          ],
        }),
      );

      graph = updateGameplayNode(
        graph,
        "reward",
        {
          label: "Bonus Reward",
          requirement: "mandatory",
        },
      );

      expect(
        graph.nodes,
      ).toHaveLength(3);

      expect(
        graph.nodes.find(
          (node) =>
            node.id === "reward",
        ),
      ).toMatchObject({
        type: "reward",
        label: "Bonus Reward",
        requirement: "mandatory",

        sourceObjectIds: [
          "sketch-reward",
        ],
      });
    },
  );

  it(
    "stores gameplay relations and their requirements",
    () => {
      let graph =
        graphWithStartAndGoal();

      graph = addGameplayRelation(
        graph,
        createGameplayRelation({
          id: "start-leads-goal",
          type: "leads_to",
          sourceNodeId: "start",
          targetNodeId: "goal",
          requirement: "mandatory",
        }),
      );

      expect(
        graph.relations[0],
      ).toMatchObject({
        type: "leads_to",
        sourceNodeId: "start",
        targetNodeId: "goal",
        requirement: "mandatory",
      });
    },
  );

  it(
    "stores and updates route type and Optional/Mandatory independently",
    () => {
      let graph =
        graphWithStartAndGoal();

      graph = addGameplayRoute(
        graph,
        createGameplayRoute({
          id: "route-1",
          type: "optional_route",
          sourceNodeId: "start",
          targetNodeId: "goal",
          requirement: "optional",

          sourceStrokeIds: [
            "stroke-1",
          ],
        }),
      );

      graph = updateGameplayRoute(
        graph,
        "route-1",
        {
          type: "shortcut",
          requirement: "mandatory",
        },
      );

      expect(
        graph.routes[0],
      ).toMatchObject({
        type: "shortcut",
        requirement: "mandatory",

        sourceStrokeIds: [
          "stroke-1",
        ],
      });
    },
  );

  it(
    "rejects relations and routes that reference missing nodes",
    () => {
      const graph =
        graphWithStartAndGoal();

      expect(() =>
        addGameplayRelation(
          graph,
          createGameplayRelation({
            type: "requires",
            sourceNodeId: "goal",
            targetNodeId:
              "missing-objective",
            requirement: "mandatory",
          }),
        ),
      ).toThrow(
        "Gameplay node does not exist",
      );

      expect(() =>
        addGameplayRoute(
          graph,
          createGameplayRoute({
            type: "main_route",
            sourceNodeId:
              "missing-start",
            targetNodeId: "goal",
            requirement: "mandatory",
          }),
        ),
      ).toThrow(
        "Gameplay node does not exist",
      );
    },
  );

  it(
    "removes connected relations and routes when a node is deleted",
    () => {
      let graph =
        graphWithStartAndGoal();

      graph = addGameplayRelation(
        graph,
        createGameplayRelation({
          id: "relation-1",
          type: "leads_to",
          sourceNodeId: "start",
          targetNodeId: "goal",
          requirement: "mandatory",
        }),
      );

      graph = addGameplayRoute(
        graph,
        createGameplayRoute({
          id: "route-1",
          type: "main_route",
          sourceNodeId: "start",
          targetNodeId: "goal",
          requirement: "mandatory",
        }),
      );

      graph = removeGameplayNode(
        graph,
        "goal",
      );

      expect(
        graph.nodes.map(
          (node) => node.id,
        ),
      ).toEqual([
        "start",
      ]);

      expect(
        graph.relations,
      ).toEqual([]);

      expect(
        graph.routes,
      ).toEqual([]);
    },
  );

  it(
    "exports and imports the complete Gameplay Graph",
    () => {
      let graph =
        graphWithStartAndGoal();

      graph = addGameplayRoute(
        graph,
        createGameplayRoute({
          id: "main-route",
          type: "main_route",
          sourceNodeId: "start",
          targetNodeId: "goal",
          requirement: "mandatory",
        }),
      );

      const project = {
        ...createEmptyProject(),
        gameplayGraph: graph,
      };

      const imported =
        importProjectJson(
          exportProject(project),
        );

      expect(imported.ok).toBe(true);

      if (imported.ok) {
        expect(
          imported.project.version,
        ).toBe("5.0.0");

        expect(
          imported.project
            .gameplayGraph,
        ).toEqual(graph);
      }
    },
  );

  it(
    "adds an empty Gameplay Graph when importing an older project",
    () => {
      const migration =
        migrateProject({
          version: "4.0.0",
          strokes: [],
          seed: 42,
        });

      expect(
        migration.ok,
      ).toBe(true);

      if (migration.ok) {
        expect(
          migration.project.version,
        ).toBe("5.0.0");

        expect(
          migration.project
            .gameplayGraph,
        ).toEqual(
          createEmptyGameplayGraph(),
        );
      }
    },
  );

  it(
    "uses the mandatory main route for generated topology",
    () => {
      let graph =
        graphWithStartAndGoal();

      graph = addGameplayNode(
        graph,
        createGameplayNode({
          id: "objective",
          type: "objective",
          label: "Activate Shrine",

          position: {
            x: 450,
            y: 220,
          },

          requirement: "mandatory",
        }),
      );

      graph = addGameplayRoute(
        graph,
        createGameplayRoute({
          id: "main-a",
          type: "main_route",
          sourceNodeId: "start",
          targetNodeId: "objective",
          requirement: "mandatory",
        }),
      );

      graph = addGameplayRoute(
        graph,
        createGameplayRoute({
          id: "main-b",
          type: "gated_route",
          sourceNodeId: "objective",
          targetNodeId: "goal",
          requirement: "mandatory",
        }),
      );

      graph = addGameplayRoute(
        graph,
        createGameplayRoute({
          id: "optional-shortcut",
          type: "optional_route",
          sourceNodeId: "start",
          targetNodeId: "goal",
          requirement: "optional",
        }),
      );

      const topology =
        buildMainPath(
          [],
          [],
          960,
          560,
          graph,
        );

      expect(
        topology.map(
          (node) =>
            node.sourceGameplayNodeId,
        ),
      ).toEqual([
        "start",
        "objective",
        "goal",
      ]);

      expect(
        topology[2]
          .incomingGameplayRouteType,
      ).toBe("gated_route");
    },
  );

  it(
    "provides Store actions for nodes, relations, and routes",
    () => {
      const store =
        useWorldloomStore.getState();

      const startId =
        store.addGameplayNode({
          id: "store-start",
          type: "start",
          label: "Start",

          position: {
            x: 100,
            y: 280,
          },

          requirement: "mandatory",
        });

      const goalId =
        useWorldloomStore
          .getState()
          .addGameplayNode({
            id: "store-goal",
            type: "goal",
            label: "Goal",

            position: {
              x: 860,
              y: 280,
            },

            requirement:
              "mandatory",
          });

      const relationId =
        useWorldloomStore
          .getState()
          .addGameplayRelation({
            id: "store-relation",
            type: "leads_to",
            sourceNodeId: startId,
            targetNodeId: goalId,
            requirement:
              "mandatory",
          });

      const routeId =
        useWorldloomStore
          .getState()
          .addGameplayRoute({
            id: "store-route",
            type: "main_route",
            sourceNodeId: startId,
            targetNodeId: goalId,
            requirement:
              "mandatory",
          });

      const graph =
        useWorldloomStore
          .getState()
          .project
          .gameplayGraph;

      expect(
        graph.nodes,
      ).toHaveLength(2);

      expect(
        relationId,
      ).toBe("store-relation");

      expect(
        routeId,
      ).toBe("store-route");

      expect(
        graph.relations,
      ).toHaveLength(1);

      expect(
        graph.routes,
      ).toHaveLength(1);

      expect(
        useWorldloomStore
          .getState()
          .undoHistory.length,
      ).toBeGreaterThan(0);
    },
  );
});