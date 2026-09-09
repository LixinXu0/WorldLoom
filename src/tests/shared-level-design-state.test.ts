import { beforeEach, describe, expect, it } from "vitest";

import {
  addGameplayNode,
  createGameplayNode,
} from "../core/gameplay/gameplayGraph";
import { createEmptyGameplayGraph } from "../core/gameplay/types";
import { migrateProject } from "../core/migration/migrateProject";
import {
  exportProject,
  importProjectJson,
} from "../core/serialization/projectJson";
import {
  createEmptySharedLevelDesignState,
  synchronizeSharedLevelDesignState,
  updateExperienceLayer,
  updateGameplayLayer,
  updateSceneLayer,
  updateSpatialLayer,
} from "../core/shared-state/sharedLevelDesignState";
import type {
  SharedExperienceGoal,
  SharedSceneElement,
  SharedSpatialConstraint,
} from "../core/shared-state/types";
import { createEmptyProject } from "../examples/exampleProject";
import { useDoodleInterpretationStore } from "../store/useDoodleInterpretationStore";
import { useWorldloomStore } from "../store/useWorldloomStore";

const fixedTime = 1_725_000_000_000;

const sceneElement: SharedSceneElement = {
  id: "scene-tower",
  type: "asset",
  name: "Tower",
  assetDefinitionId: "tower-01",
  transform: {
    position: { x: 240, y: 180 },
    rotation: 0,
    scale: 1,
  },
  semanticRoles: ["landmark"],
  preserved: true,
  status: "committed",
  provenance: {
    source: "user",
    sourceIds: ["asset-tower"],
    updatedAt: fixedTime,
  },
};

const spatialConstraint: SharedSpatialConstraint = {
  id: "spatial-tower-position",
  targetElementId: "scene-tower",
  property: "position",
  mode: "exact",
  value: { x: 240, y: 180 },
  enabled: true,
  status: "committed",
  provenance: {
    source: "user",
    sourceIds: ["asset-tower"],
    updatedAt: fixedTime,
  },
};

const experienceGoal: SharedExperienceGoal = {
  id: "experience-climax",
  dimension: "climax",
  description: "The boss encounter should be the final climax.",
  intensity: 0.9,
  order: 3,
  targetGameplayNodeIds: ["boss"],
  status: "committed",
  provenance: {
    source: "mixed",
    sourceIds: ["interpretation-1"],
    updatedAt: fixedTime,
  },
};

function gameplayGraphWithStart() {
  return addGameplayNode(
    createEmptyGameplayGraph(),
    createGameplayNode({
      id: "start",
      type: "start",
      label: "Player Start",
      position: { x: 80, y: 280 },
      requirement: "mandatory",
    }),
  );
}

function resetStores(): void {
  useWorldloomStore.setState({
    project: createEmptyProject(),
    selected: null,
    undoHistory: [],
    redoHistory: [],
    researchLog: [],
  });

  useDoodleInterpretationStore.setState({
    confirmedDoodles: [],
    finalMapUnderstanding: null,
    worldSetting: "",
  });
}

describe("Shared Level Design State", () => {
  beforeEach(resetStores);

  it("initializes all four layers", () => {
    const state = createEmptySharedLevelDesignState(
      createEmptyGameplayGraph(),
      fixedTime,
    );

    expect(state).toEqual({
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
        graph: createEmptyGameplayGraph(),
      },
      experience: {
        goals: [],
        summary: "",
      },
      updatedAt: fixedTime,
    });
  });

  it("updates Scene, Spatial, Gameplay, and Experience independently", () => {
    let state = createEmptySharedLevelDesignState(
      createEmptyGameplayGraph(),
      fixedTime,
    );

    state = updateSceneLayer(
      state,
      {
        worldSetting: "A flooded archipelago",
        elements: [sceneElement],
      },
      fixedTime + 1,
    );

    state = updateSpatialLayer(
      state,
      { constraints: [spatialConstraint] },
      fixedTime + 2,
    );

    state = updateGameplayLayer(
      state,
      gameplayGraphWithStart(),
      fixedTime + 3,
    );

    state = updateExperienceLayer(
      state,
      {
        goals: [experienceGoal],
        summary: "Orientation followed by a final climax.",
      },
      fixedTime + 4,
    );

    expect(state.revision).toBe(4);
    expect(state.scene.elements).toEqual([sceneElement]);
    expect(state.spatial.constraints).toEqual([spatialConstraint]);
    expect(state.gameplay.graph.nodes[0].id).toBe("start");
    expect(state.experience.goals).toEqual([experienceGoal]);
    expect(state.updatedAt).toBe(fixedTime + 4);
  });

  it("synchronizes all four layers in one revision", () => {
    const state = createEmptySharedLevelDesignState(
      createEmptyGameplayGraph(),
      fixedTime,
    );
    const graph = gameplayGraphWithStart();

    const synchronized = synchronizeSharedLevelDesignState(
      state,
      {
        scene: {
          worldSetting: "Ocean world",
          elements: [sceneElement],
        },
        spatial: {
          constraints: [spatialConstraint],
        },
        gameplay: {
          graph,
        },
        experience: {
          goals: [experienceGoal],
          summary: "Calm exploration followed by a climax.",
        },
      },
      fixedTime + 1,
    );

    expect(synchronized.revision).toBe(1);
    expect(synchronized.scene.worldSetting).toBe("Ocean world");
    expect(synchronized.spatial.constraints).toHaveLength(1);
    expect(synchronized.gameplay.graph).toEqual(graph);
    expect(synchronized.experience.goals).toHaveLength(1);
  });

  it("keeps the legacy Gameplay Graph synchronized with the shared layer", () => {
    const graph = gameplayGraphWithStart();

    useWorldloomStore.getState().updateSharedGameplay(graph);

    const project = useWorldloomStore.getState().project;

    expect(project.gameplayGraph).toEqual(graph);
    expect(project.sharedLevelDesignState.gameplay.graph).toEqual(graph);
    expect(project.sharedLevelDesignState.revision).toBe(1);
  });

  it("synchronizes confirmed doodles and world setting into Scene", () => {
    const doodleStore = useDoodleInterpretationStore.getState();

    doodleStore.setWorldSetting("A quiet ocean world");
    doodleStore.confirmDoodle({
      imageDataUrl: "data:image/png;base64,test",
      aiSummary: "A stone tower landmark",
      selectedLabel: "Tower",
      selectedDescription: "A preserved tower near the coast.",
      source: "qwen_candidate",
      boundingBox: {
        x: 100,
        y: 120,
        width: 80,
        height: 100,
      },
    });

    const understanding =
      useDoodleInterpretationStore.getState().confirmOverallMap();
    const scene =
      useWorldloomStore.getState().project.sharedLevelDesignState.scene;

    expect(understanding).not.toBeNull();
    expect(scene.worldSetting).toBe("A quiet ocean world");
    expect(scene.elements).toHaveLength(1);
    expect(scene.elements[0]).toMatchObject({
      type: "doodle",
      name: "Tower",
      description: "A preserved tower near the coast.",
      status: "committed",
      preserved: true,
    });
    expect(JSON.stringify(scene)).not.toContain("data:image/png");
  });

  it("exports and imports all four layers", () => {
    const store = useWorldloomStore.getState();
    const graph = gameplayGraphWithStart();

    store.synchronizeSharedState({
      scene: {
        worldSetting: "Mountain fortress",
        elements: [sceneElement],
      },
      spatial: {
        constraints: [spatialConstraint],
      },
      gameplay: {
        graph,
      },
      experience: {
        goals: [experienceGoal],
        summary: "Rising tension and climax.",
      },
    });

    const exported = exportProject(
      useWorldloomStore.getState().project,
    );
    const imported = importProjectJson(exported);

    expect(imported.ok).toBe(true);

    if (imported.ok) {
      const shared = imported.project.sharedLevelDesignState;

      expect(shared.scene.worldSetting).toBe("Mountain fortress");
      expect(shared.scene.elements).toEqual([sceneElement]);
      expect(shared.spatial.constraints).toEqual([spatialConstraint]);
      expect(shared.gameplay.graph).toEqual(graph);
      expect(shared.experience.goals).toEqual([experienceGoal]);
      expect(imported.project.gameplayGraph).toEqual(
        shared.gameplay.graph,
      );
    }
  });

  it("migrates V4 assets, locks, gameplay, and experience data", () => {
    const graph = gameplayGraphWithStart();

    const result = migrateProject({
      version: "4.0.0",
      seed: 42,
      strokes: [],
      metadata: {
        canvasWidth: 960,
        canvasHeight: 560,
        updatedAt: fixedTime,
      },
      gameplayGraph: graph,
      sketchState: {
        assetInstances: [
          {
            id: "legacy-tower",
            assetDefinitionId: "tower-01",
            position: { x: 300, y: 200, time: fixedTime },
            rotation: 15,
            scale: 1,
            locked: true,
            preserve: true,
            roleAssignments: ["landmark"],
            createdAt: fixedTime,
          },
        ],
        rawStrokes: [],
        gestureCandidates: [],
        episodes: [],
        marks: [],
        objects: [],
        relations: [],
        annotations: [],
        groups: [],
        utterances: [],
      },
      committedCompositionIntent: {
        id: "legacy-composition",
        experientialGoals: ["Rising tension before the climax"],
      },
    });

    expect(result.ok).toBe(true);

    if (result.ok) {
      const shared = result.project.sharedLevelDesignState;

      expect(shared.scene.elements[0]).toMatchObject({
        id: "legacy-tower",
        type: "asset",
        preserved: true,
      });
      expect(
        shared.spatial.constraints.map(
          (constraint) => constraint.property,
        ),
      ).toEqual(expect.arrayContaining(["identity", "position"]));
      expect(shared.gameplay.graph).toEqual(graph);
      expect(shared.experience.goals[0]).toMatchObject({
        dimension: "tension",
        description: "Rising tension before the climax",
      });
    }
  });
});
