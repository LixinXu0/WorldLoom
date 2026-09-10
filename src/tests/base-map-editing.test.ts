import { beforeEach, describe, expect, it } from "vitest";
import { createEmptyProject } from "../examples/exampleProject";
import { exportProject, importProjectJson } from "../core/serialization/projectJson";
import { useWorldloomStore } from "../store/useWorldloomStore";

describe("2D Base Map Editing", () => {
  beforeEach(() => useWorldloomStore.setState({ project: createEmptyProject(), selected: null, gameplaySelectionId: null, focusRequest: null, activeTool: "select", undoHistory: [], redoHistory: [] }));

  it("keeps surface, accessibility, and collision state independent", () => {
    const grassId = useWorldloomStore.getState().addBaseMapSurface({ geometry: "stroke", operation: "paint", points: [{ x: 50, y: 50 }, { x: 400, y: 300 }], materialId: "grass", textureReference: "procedural://grass", brushSize: 96, materialScale: 1 });
    useWorldloomStore.getState().addBaseMapSurface({ geometry: "stroke", operation: "paint", points: [{ x: 80, y: 220 }, { x: 520, y: 220 }], materialId: "dirt", textureReference: "procedural://dirt", brushSize: 48, materialScale: 1 });
    useWorldloomStore.getState().addAccessibilityZone({ geometry: "stroke", points: [{ x: 70, y: 70 }, { x: 700, y: 420 }], state: "walkable", brushSize: 150 });
    useWorldloomStore.getState().addAccessibilityZone({ geometry: "stroke", points: [{ x: 650, y: 100 }], state: "blocked", brushSize: 90 });
    useWorldloomStore.getState().addCollisionShape({ geometry: [{ x: 300, y: 80 }, { x: 300, y: 430 }], type: "line", blocksMovement: true });
    useWorldloomStore.getState().addCollisionShape({ geometry: [{ x: 600, y: 170 }, { x: 760, y: 180 }, { x: 720, y: 310 }], type: "polygon", blocksMovement: true });

    const before = useWorldloomStore.getState().project.baseMap;
    const accessibility = structuredClone(before.accessibilityZones);
    const collisions = structuredClone(before.collisions);
    useWorldloomStore.getState().updateBaseMapSurface(grassId, { materialId: "stone", textureReference: "procedural://stone" });
    const after = useWorldloomStore.getState().project.baseMap;

    expect(after.surfaces.find((surface) => surface.id === grassId)?.materialId).toBe("stone");
    expect(after.accessibilityZones).toEqual(accessibility);
    expect(after.collisions).toEqual(collisions);
  });

  it("visibility toggles preserve layer data and undo restores edits", () => {
    useWorldloomStore.getState().addAccessibilityZone({ geometry: "stroke", points: [{ x: 20, y: 20 }], state: "blocked", brushSize: 50 });
    useWorldloomStore.getState().addCollisionShape({ geometry: [{ x: 10, y: 10 }, { x: 100, y: 100 }], type: "line", blocksMovement: true });
    const data = structuredClone(useWorldloomStore.getState().project.baseMap);
    useWorldloomStore.getState().setMapLayerVisible("accessibilityVisible", false);
    useWorldloomStore.getState().setMapLayerVisible("collisionVisible", false);
    useWorldloomStore.getState().setMapLayerVisible("accessibilityVisible", true);
    useWorldloomStore.getState().setMapLayerVisible("collisionVisible", true);
    expect(useWorldloomStore.getState().project.baseMap).toEqual(data);

    useWorldloomStore.getState().undo();
    expect(useWorldloomStore.getState().project.baseMap.collisions).toHaveLength(0);
    expect(useWorldloomStore.getState().project.baseMap.accessibilityZones).toHaveLength(1);
  });

  it("round-trips all three base-map layers through project JSON", () => {
    useWorldloomStore.getState().addBaseMapSurface({ geometry: "fill", operation: "paint", points: [], materialId: "sand", textureReference: "procedural://sand", brushSize: 64, materialScale: 1.2 });
    useWorldloomStore.getState().addAccessibilityZone({ geometry: "stroke", points: [{ x: 20, y: 20 }], state: "walkable", brushSize: 64 });
    useWorldloomStore.getState().addCollisionShape({ geometry: [{ x: 10, y: 10 }, { x: 100, y: 20 }, { x: 80, y: 90 }], type: "polygon", blocksMovement: true });
    const result = importProjectJson(exportProject(useWorldloomStore.getState().project));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.baseMap.surfaces).toHaveLength(1);
      expect(result.project.baseMap.accessibilityZones[0].state).toBe("walkable");
      expect(result.project.baseMap.collisions[0].type).toBe("polygon");
    }
  });

  it("hands the Selected Element panel back to existing asset selection", () => {
    useWorldloomStore.getState().addBaseMapSurface({ geometry: "stroke", operation: "paint", points: [{ x: 20, y: 20 }], materialId: "grass", textureReference: "procedural://grass", brushSize: 40, materialScale: 1 });
    expect(useWorldloomStore.getState().selected?.kind).toBe("base-surface");
    useWorldloomStore.getState().placeAssetInstance("barricade", { x: 200, y: 200, time: 1 });
    expect(useWorldloomStore.getState().selected?.kind).toBe("asset");
    expect(useWorldloomStore.getState().project.sketchSelection.ids).toHaveLength(1);
  });

  it("focuses an asset and opens it as the selected element in one action", () => {
    useWorldloomStore.getState().placeAssetInstance("door", { x: 640, y: 360, time: 1 });
    const door = useWorldloomStore.getState().project.sketchState.assetInstances[0];
    useWorldloomStore.setState({ selected: null, gameplaySelectionId: "unrelated", focusRequest: null });

    useWorldloomStore.getState().focusAssetInstance(door.id);

    const state = useWorldloomStore.getState();
    expect(state.project.sketchSelection.ids).toEqual([door.id]);
    expect(state.selected).toEqual({ kind: "asset", id: door.id });
    expect(state.gameplaySelectionId).toBeNull();
    expect(state.activeTool).toBe("select");
    expect(state.focusRequest?.assetId).toBe(door.id);
  });

  it("creates, selects, and moves gameplay editing elements", () => {
    useWorldloomStore.getState().createGameplayElement("player_spawn", { x: 240, y: 180 });
    useWorldloomStore.getState().createGameplayElement("npc_patrol_route", { x: 400, y: 300 });
    let state = useWorldloomStore.getState();
    expect(state.project.gameplaySemanticLayer?.elements).toHaveLength(2);
    expect(state.selected).toEqual({ kind: "gameplay", id: state.gameplaySelectionId! });

    const patrol = state.project.gameplaySemanticLayer!.elements.find((element) => element.type === "npc_patrol_route")!;
    const originalWaypoints = structuredClone(patrol.waypoints!);
    useWorldloomStore.getState().moveGameplayElement(patrol.id, { x: patrol.position.x + 60, y: patrol.position.y - 25 });
    state = useWorldloomStore.getState();
    const moved = state.project.gameplaySemanticLayer!.elements.find((element) => element.id === patrol.id)!;
    expect(moved.waypoints?.[0]).toEqual({ x: originalWaypoints[0].x + 60, y: originalWaypoints[0].y - 25 });
    expect(moved.waypoints?.at(-1)).toEqual({ x: originalWaypoints.at(-1)!.x + 60, y: originalWaypoints.at(-1)!.y - 25 });
  });

  it("builds the validation graph with start, goal, and a reachable route", () => {
    const startId = useWorldloomStore.getState().addGameplayNode({ type: "start", label: "Start", position: { x: 160, y: 260 }, requirement: "mandatory" });
    const goalId = useWorldloomStore.getState().addGameplayNode({ type: "goal", label: "Goal", position: { x: 900, y: 260 }, requirement: "mandatory" });
    useWorldloomStore.getState().addGameplayRoute({ type: "main_route", sourceNodeId: startId, targetNodeId: goalId, requirement: "mandatory" });
    useWorldloomStore.getState().validateGameplay();

    const gameplay = useWorldloomStore.getState().project.sharedLevelDesignState.gameplay;
    expect(gameplay.graph.nodes.map((node)=>node.type)).toEqual(["start", "goal"]);
    expect(gameplay.graph.routes).toHaveLength(1);
    expect(gameplay.validation?.valid).toBe(true);
    expect(gameplay.validation?.conflicts).toHaveLength(0);
  });

  it("synchronizes passable and blocking overrides for a door", () => {
    useWorldloomStore.getState().placeAssetInstance("door", { x: 200, y: 200, time: 1 });
    const door = useWorldloomStore.getState().project.sketchState.assetInstances[0];
    expect(door.movementBehavior).toBe("passable");
    expect(useWorldloomStore.getState().project.baseMap.collisions).toHaveLength(0);

    useWorldloomStore.getState().setAssetMovementBehavior(door.id, "blocking");
    expect(useWorldloomStore.getState().project.baseMap.collisions).toMatchObject([{ source: "asset-derived", sourceAssetId: door.id }]);
    expect(useWorldloomStore.getState().project.baseMap.accessibilityZones).toMatchObject([{ state: "blocked", source: "asset-derived", sourceAssetId: door.id }]);

    useWorldloomStore.getState().setAssetMovementBehavior(door.id, "passable");
    expect(useWorldloomStore.getState().project.baseMap.collisions).toHaveLength(0);
    expect(useWorldloomStore.getState().project.baseMap.accessibilityZones).toHaveLength(0);
  });

  it("moves and removes only a castle's derived footprint", () => {
    useWorldloomStore.getState().addCollisionShape({ geometry: [{ x: 10, y: 10 }, { x: 100, y: 10 }], type: "line", blocksMovement: true });
    const manual = structuredClone(useWorldloomStore.getState().project.baseMap.collisions[0]);
    useWorldloomStore.getState().placeAssetInstance("castle", { x: 300, y: 240, time: 1 });
    const castle = useWorldloomStore.getState().project.sketchState.assetInstances[0];
    const before = useWorldloomStore.getState().project.baseMap.collisions.find((shape) => shape.sourceAssetId === castle.id)!;
    expect(castle.movementBehavior).toBe("blocking");

    useWorldloomStore.getState().moveAssetInstance(castle.id, 45, -20);
    const after = useWorldloomStore.getState().project.baseMap.collisions.find((shape) => shape.sourceAssetId === castle.id)!;
    expect(after.geometry[0]).toEqual({ x: before.geometry[0].x + 45, y: before.geometry[0].y - 20 });
    expect(useWorldloomStore.getState().project.baseMap.collisions.find((shape) => shape.id === manual.id)).toEqual(manual);

    useWorldloomStore.getState().deleteAssetInstance(castle.id);
    expect(useWorldloomStore.getState().project.baseMap.collisions).toEqual([manual]);
    expect(useWorldloomStore.getState().project.baseMap.accessibilityZones.filter((zone) => zone.sourceAssetId === castle.id)).toHaveLength(0);
  });

  it("preserves movement overrides and manual accessibility through serialization", () => {
    useWorldloomStore.getState().addAccessibilityZone({ geometry: "stroke", points: [{ x: 20, y: 20 }, { x: 500, y: 300 }], state: "walkable", brushSize: 160 });
    useWorldloomStore.getState().placeAssetInstance("castle", { x: 250, y: 200, time: 1 });
    const castle = useWorldloomStore.getState().project.sketchState.assetInstances[0];
    useWorldloomStore.getState().setAssetMovementBehavior(castle.id, "passable");
    const result = importProjectJson(exportProject(useWorldloomStore.getState().project));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.sketchState.assetInstances[0].movementBehavior).toBe("passable");
      expect(result.project.baseMap.collisions).toHaveLength(0);
      expect(result.project.baseMap.accessibilityZones).toMatchObject([{ state: "walkable", source: "manual" }]);
    }
  });

  it("keeps surface and manual accessibility independent from asset restrictions", () => {
    useWorldloomStore.getState().addBaseMapSurface({ geometry: "fill", operation: "paint", points: [], materialId: "grass", textureReference: "procedural://grass", brushSize: 64, materialScale: 1 });
    useWorldloomStore.getState().addAccessibilityZone({ geometry: "stroke", points: [{ x: 20, y: 200 }, { x: 800, y: 200 }], state: "walkable", brushSize: 180 });
    const surface = structuredClone(useWorldloomStore.getState().project.baseMap.surfaces);
    const manualAccess = structuredClone(useWorldloomStore.getState().project.baseMap.accessibilityZones);
    useWorldloomStore.getState().placeAssetInstance("castle", { x: 300, y: 200, time: 1 });
    expect(useWorldloomStore.getState().project.baseMap.surfaces).toEqual(surface);
    expect(useWorldloomStore.getState().project.baseMap.accessibilityZones.filter((zone) => zone.source === "manual")).toEqual(manualAccess);
    expect(useWorldloomStore.getState().project.baseMap.accessibilityZones.some((zone) => zone.source === "asset-derived" && zone.state === "blocked")).toBe(true);
  });
});
