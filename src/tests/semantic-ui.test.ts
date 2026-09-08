import { describe, it, expect } from "vitest";
import { createSemanticDemoProject } from "../examples/semanticDemo";
import { semanticItemsFor,traceSemantic } from "../core/sketch/semanticPresentation";
import { sketchStyles,strokeStyle } from "../core/sketch/semanticStyles";
import { exportProject,importProjectJson } from "../core/serialization/projectJson";
import { useWorldloomStore } from "../store/useWorldloomStore";
import { createEmptyProject } from "../examples/exampleProject";

describe("Semantic presentation",()=>{
  it("provides all six stroke semantics and all local card types without model output",()=>{
    const project=createSemanticDemoProject();
    expect(project.compositionHypothesis).toBeNull();
    expect(new Set(project.sketchState.rawStrokes.map(s=>s.semanticStyle))).toEqual(new Set(Object.keys(sketchStyles)));
    expect(semanticItemsFor(project).map(n=>n.kind)).toEqual(expect.arrayContaining(["question","reading","constraint","uncertainty","conflict"]));
    const restored=importProjectJson(exportProject(project));
    expect(restored.ok).toBe(true); if(!restored.ok)throw new Error(restored.error);
    expect(restored.project.sketchState.semanticItems).toEqual(project.sketchState.semanticItems);
    expect(restored.project.sketchState.rawStrokes).toEqual(project.sketchState.rawStrokes);
  });
  it("captures brush choice per stroke and preserves it through undo/redo",()=>{
    useWorldloomStore.setState({project:createEmptyProject(),undoHistory:[],redoHistory:[],draftRawStrokeId:null});
    const store=useWorldloomStore.getState();
    store.setSketchSemantic("optional-path"); store.beginRawStroke({x:20,y:30}); store.appendRawStrokePoint({x:80,y:60});store.completeRawStroke();
    store.setSketchSemantic("conflict-zone");
    expect(useWorldloomStore.getState().project.sketchState.rawStrokes[0].semanticStyle).toBe("optional-path");
    store.undo();expect(useWorldloomStore.getState().project.sketchState.rawStrokes).toHaveLength(0);
    store.redo();expect(useWorldloomStore.getState().project.sketchState.rawStrokes[0].semanticStyle).toBe("optional-path");
    expect(strokeStyle(undefined).dash).toBeUndefined();
  });
  it("maps trace events to their semantic meanings",()=>{
    expect(traceSemantic("composition_hypothesis_returned")).toBe("interpretation");
    expect(traceSemantic("relation_changed")).toBe("spatial");
    expect(traceSemantic("clarification_shown")).toBe("question");
    expect(traceSemantic("convention_conflict")).toBe("conflict");
    expect(traceSemantic("asset_locked")).toBe("confirmed");
    expect(traceSemantic("asset_unlocked")).toBe("spatial");
  });
  it("does not leak local hypotheses into the opaque research condition",()=>{
    const project=createSemanticDemoProject();project.researchMode="c1-ai-opaque";
    expect(semanticItemsFor(project)).toEqual([]);
  });
});
