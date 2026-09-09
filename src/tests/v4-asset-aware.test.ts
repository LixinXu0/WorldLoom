import { describe, expect, it } from "vitest";
import { mockAssetLibrary } from "../assets/mockAssetLibrary";
import { useWorldloomStore } from "../store/useWorldloomStore";
import { createEmptyProject } from "../examples/exampleProject";
import { exportProject, importProjectJson } from "../core/serialization/projectJson";

function resetStore() {
  useWorldloomStore.setState({
    project: createEmptyProject(),
    selected: null,
    editorMode: "intent",
    editorSubmode: "inspect",
    researchLog: [],
    comparisonResult: null,
  });
}

describe("V4 asset-aware composition workflow", () => {
  it("exposes the required mock production asset library", () => {
    expect(mockAssetLibrary.map((asset) => asset.name)).toEqual(expect.arrayContaining(["Watchtower", "Barricade", "Stone Stair", "Enemy Shrine", "Reward Chest", "Gate", "Bridge", "Healing Shrine"]));
    expect(mockAssetLibrary.find((asset) => asset.id === "watchtower")?.candidateRoles).toContain("elevated landmark");
  });

  it("runs Demo A through hypothesis, clarification, commit, edit plan, and apply without generating rooms", () => {
    resetStore();
    const store = useWorldloomStore.getState();
    store.setResearchMode("c2-ai-negotiable");
    store.loadV4DemoScene("high-ground");
    useWorldloomStore.getState().interpretTogether();

    const hypothesis = useWorldloomStore.getState().project.compositionHypothesis;
    expect(hypothesis?.summary).toBe("I think this is a defended high-ground encounter reached from the stair.");
    expect(hypothesis?.clarificationRequests[0]?.question).toBe("Is the Reward Chest part of this encounter, or a separate optional reward?");

    const requestId = hypothesis!.clarificationRequests[0].id;
    useWorldloomStore.getState().answerCompositionClarification(requestId, "chest-separate-reward");
    const towerId = useWorldloomStore.getState().project.sketchState.assetInstances.find((asset) => asset.assetDefinitionId === "watchtower")!.id;
    useWorldloomStore.getState().toggleAssetLock(towerId);
    const beforeIds = useWorldloomStore.getState().project.sketchState.assetInstances.map((asset) => asset.id).sort();

    useWorldloomStore.getState().commitComposition();
    useWorldloomStore.getState().generateAssetPlan();
    const plan = useWorldloomStore.getState().project.assetEditPlan;
    expect(plan?.operations.some((operation) => operation.type === "preserve" && operation.assetId === towerId)).toBe(true);
    expect(plan?.operations.some((operation) => operation.type === "assignRole" && operation.role === "encounter source")).toBe(true);
    expect(plan?.operations.some((operation) => operation.type === "connect" && operation.relation === "approach_route")).toBe(true);

    useWorldloomStore.getState().applyAssetPlan();
    const project = useWorldloomStore.getState().project;
    expect(project.sketchState.assetInstances.map((asset) => asset.id).sort()).toEqual(beforeIds);
    expect(project.variants).toEqual([]);
    expect(project.appliedAssetEditPlans).toHaveLength(1);
  });

  it("serializes V4 assets, utterances, composition intent, and edit plans", () => {
    resetStore();
    useWorldloomStore.getState().loadV4DemoScene("high-ground");
    useWorldloomStore.getState().interpretTogether();
    useWorldloomStore.getState().commitComposition();
    useWorldloomStore.getState().generateAssetPlan();
    const imported = importProjectJson(exportProject(useWorldloomStore.getState().project));
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.project.version).toBe("5.0.0");
      expect(imported.project.sketchState.assetInstances.length).toBe(5);
      expect(imported.project.committedCompositionIntent?.assetInstanceIds.length).toBeGreaterThan(0);
      expect(imported.project.assetEditPlan?.operations.length).toBeGreaterThan(0);
    }
  });

  it("uses freehand raw strokes as the default primitive before geometric or design interpretation", () => {
    resetStore();
    expect(useWorldloomStore.getState().activeTool).toBe("pen");
    const store = useWorldloomStore.getState();
    store.beginRawStroke({ x: 100, y: 100, pressure: 0.4, pointerType: "pen" });
    store.appendRawStrokePoint({ x: 150, y: 80, pressure: 0.5 });
    store.appendRawStrokePoint({ x: 190, y: 120, pressure: 0.6 });
    store.appendRawStrokePoint({ x: 112, y: 106, pressure: 0.5 });
    store.completeRawStroke();

    const project = useWorldloomStore.getState().project;
    expect(project.sketchState.rawStrokes).toHaveLength(1);
    expect(project.sketchState.rawStrokes[0].points[0]).toMatchObject({ x: 100, y: 100, pressure: 0.4 });
    expect(project.sketchState.gestureCandidates[0].kind).toBe("closed_loop");
    expect(project.compositionHypothesis).toBeNull();
  });

  it("interprets selected raw strokes with nearby asset context without moving assets in pen mode", () => {
    resetStore();
    const store = useWorldloomStore.getState();
    store.placeAssetInstance("watchtower", { x: 180, y: 160, time: 1 });
    store.placeAssetInstance("barricade", { x: 240, y: 190, time: 1 });
    const beforePositions = useWorldloomStore.getState().project.sketchState.assetInstances.map((asset) => ({ id: asset.id, x: asset.position.x, y: asset.position.y }));
    store.beginRawStroke({ x: 150, y: 130, pointerType: "mouse" });
    store.appendRawStrokePoint({ x: 270, y: 130 });
    store.appendRawStrokePoint({ x: 270, y: 230 });
    store.appendRawStrokePoint({ x: 150, y: 230 });
    store.appendRawStrokePoint({ x: 150, y: 130 });
    store.completeRawStroke();
    const rawId = useWorldloomStore.getState().project.sketchState.rawStrokes[0].id;
    const assetIds = useWorldloomStore.getState().project.sketchState.assetInstances.map((asset) => asset.id);
    useWorldloomStore.getState().selectSketchIds([rawId, ...assetIds]);
    useWorldloomStore.getState().interpretTogether();

    const project = useWorldloomStore.getState().project;
    expect(project.sketchState.assetInstances.map((asset) => ({ id: asset.id, x: asset.position.x, y: asset.position.y }))).toEqual(beforePositions);
    expect(project.sketchState.utterances.at(-1)?.rawStrokeIds).toContain(rawId);
    expect(project.sketchState.utterances.at(-1)?.assetInstanceIds).toEqual(expect.arrayContaining(assetIds));
  });

  it("undo and save/load preserve raw stroke semantics predictably", () => {
    resetStore();
    useWorldloomStore.getState().beginRawStroke({ x: 20, y: 20, pointerType: "mouse" });
    useWorldloomStore.getState().appendRawStrokePoint({ x: 80, y: 80 });
    useWorldloomStore.getState().completeRawStroke();
    expect(useWorldloomStore.getState().project.sketchState.rawStrokes).toHaveLength(1);

    const imported = importProjectJson(exportProject(useWorldloomStore.getState().project));
    expect(imported.ok).toBe(true);
    if (imported.ok) expect(imported.project.sketchState.rawStrokes[0].points).toHaveLength(2);

    useWorldloomStore.getState().undo();
    expect(useWorldloomStore.getState().project.sketchState.rawStrokes).toHaveLength(0);
  });
});
