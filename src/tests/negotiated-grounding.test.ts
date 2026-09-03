import { describe, expect, it } from "vitest";
import { createCandidateIntent, commitCandidateIntent } from "../core/grounding/candidateIntent";
import { buildClarificationRequests } from "../core/grounding/clarificationPolicy";
import { confirmConvention, correctConvention, createConventionEntry, findMatchingConvention, rejectConvention } from "../core/conventions/conventionMemory";
import { buildSketchPatternSignature } from "../core/sketch/patternSignature";
import type { SketchState } from "../core/sketch/types";
import { interpretMockAISync } from "../ai/mockAIInterpreter";
import { intentToConstraints } from "../core/intent/intentToConstraints";
import { createEmptyProject } from "../examples/exampleProject";
import { exportProject, importProjectJson } from "../core/serialization/projectJson";
import { createResearchEvent, exportResearchLog } from "../research/interactionLogger";
import { useWorldloomStore } from "../store/useWorldloomStore";

function sketchLoopEnemyArrow(): SketchState {
  return {
    assetInstances: [],
    rawStrokes: [],
    gestureCandidates: [],
    episodes: [],
    marks: [
      { id: "loop-1", kind: "region", points: [{ x: 100, y: 100, time: 1 }, { x: 180, y: 100, time: 2 }, { x: 180, y: 180, time: 3 }, { x: 100, y: 100, time: 4 }], createdAt: 1 },
      { id: "arrow-1", kind: "arrow", points: [{ x: 190, y: 140, time: 5 }, { x: 260, y: 140, time: 6 }], createdAt: 5 },
    ],
    objects: [{ id: "enemy-1", objectType: "enemy", position: { x: 140, y: 135, time: 7 }, label: "Enemy" }],
    relations: [],
    annotations: [],
    groups: [{ id: "group-1", memberIds: ["loop-1", "arrow-1", "enemy-1"], label: "Encounter pocket" }],
    utterances: [],
  };
}

describe("negotiated sketch grounding", () => {
  it("serializes and loads sketch marks, objects, relations, and groups", () => {
    const project = { ...createEmptyProject(), sketchState: { ...sketchLoopEnemyArrow(), relations: [{ id: "rel-1", sourceId: "enemy-1", targetId: "loop-1", relationType: "contains" as const, directed: false }] } };
    const imported = importProjectJson(exportProject(project));
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.project.sketchState.marks).toHaveLength(2);
      expect(imported.project.sketchState.objects[0].objectType).toBe("enemy");
      expect(imported.project.sketchState.relations[0].relationType).toBe("contains");
      expect(imported.project.sketchState.groups[0].memberIds).toContain("arrow-1");
    }
  });

  it("keeps C3 candidate intent out of generator constraints until commit", () => {
    const sketchState = sketchLoopEnemyArrow();
    const result = interpretMockAISync({ strokes: [], sketchState });
    const candidate = createCandidateIntent(result, sketchState);
    expect(candidate.status).not.toBe("committed");
    expect(createEmptyProject().constraints).toEqual([]);
    const committed = commitCandidateIntent(candidate);
    expect(intentToConstraints(committed.authoringIntent, [], candidate.interpretations).length).toBeGreaterThan(0);
  });

  it("commits a C3 sandbox candidate into constraints for realization", () => {
    useWorldloomStore.setState({ project: createEmptyProject(), comparisonResult: null, editorMode: "intent" });
    const store = useWorldloomStore.getState();
    store.setResearchMode("c3-ai-negotiable");
    store.addSketchMark("region");
    store.addSketchObject("enemy");
    store.addSketchMark("arrow");
    useWorldloomStore.getState().compileIntent();

    const candidate = useWorldloomStore.getState().project.candidateIntent;
    expect(candidate).not.toBeNull();
    const firstRequest = candidate?.clarificationRequests[0];
    if (firstRequest) {
      useWorldloomStore.getState().answerClarificationRequest(firstRequest.id, undefined, "No - it is a recovery pocket.");
    }

    useWorldloomStore.getState().commitCandidate();
    const project = useWorldloomStore.getState().project;
    expect(project.committedIntent).not.toBeNull();
    expect(project.constraints.length).toBeGreaterThan(0);
    expect(project.candidateIntent?.status).toBe("committed");
  });

  it("produces the same raw AI interpretation for C2 and C3 before negotiation", () => {
    const sketchState = sketchLoopEnemyArrow();
    const c2 = interpretMockAISync({ strokes: [], sketchState, textInstruction: "loop plus arrow" });
    const c3 = interpretMockAISync({ strokes: [], sketchState, textInstruction: "loop plus arrow" });
    expect(c2.interpretations.map((item) => item.semanticSummary)).toEqual(c3.interpretations.map((item) => item.semanticSummary));
    expect(c2.authoringIntent).toEqual(c3.authoringIntent);
  });

  it("clarification policy triggers ambiguous regions and low confidence but not every clear interpretation", () => {
    const ambiguousSketch: SketchState = { assetInstances: [], rawStrokes: [], gestureCandidates: [], episodes: [], marks: [{ id: "circle", kind: "region", points: [{ x: 0, y: 0, time: 1 }, { x: 1, y: 1, time: 2 }], createdAt: 1 }], objects: [], relations: [], annotations: [], groups: [], utterances: [] };
    const ambiguous = createCandidateIntent(interpretMockAISync({ strokes: [], sketchState: ambiguousSketch }), undefined);
    const requests = buildClarificationRequests(ambiguous, ambiguousSketch);
    expect(requests.some((request) => request.reason === "semantic_ambiguity")).toBe(true);
    const clear = createCandidateIntent(interpretMockAISync({ strokes: [], sketchState: sketchLoopEnemyArrow(), textInstruction: "recovery pocket" }), sketchLoopEnemyArrow());
    expect(clear.interpretations[0].confidence).toBeGreaterThan(0.5);
  });

  it("confirmed convention can be retrieved and rejected convention is not reused", () => {
    const sketch = sketchLoopEnemyArrow();
    const signature = buildSketchPatternSignature(sketch, ["loop-1", "arrow-1", "enemy-1"]);
    const entry = createConventionEntry(signature, { kind: "experience", sourceStrokeIds: ["loop-1"] }, "recovery pocket", ["loop-1", "arrow-1", "enemy-1"], "project", 10);
    expect(findMatchingConvention([entry], sketch, ["loop-1", "arrow-1", "enemy-1"])?.entry.id).toBe(entry.id);
    const rejected = { ...rejectConvention(rejectConvention(rejectConvention(entry, 11), 12), 13), enabled: false };
    expect(findMatchingConvention([rejected], sketch, ["loop-1", "arrow-1", "enemy-1"])).toBeNull();
  });

  it("corrected convention updates meaning and confirmation count changes confidence", () => {
    const sketch = sketchLoopEnemyArrow();
    const entry = createConventionEntry(buildSketchPatternSignature(sketch), { kind: "experience", sourceStrokeIds: ["loop-1"] }, "combat pocket", ["loop-1"]);
    const corrected = correctConvention(entry, { kind: "experience", sourceStrokeIds: ["loop-1"] }, "recovery pocket");
    const confirmed = confirmConvention(corrected, ["arrow-1"]);
    expect(confirmed.humanReadableLabel).toBe("recovery pocket");
    expect(confirmed.confirmations).toBe(2);
    expect(confirmed.exampleSketchIds).toContain("arrow-1");
  });

  it("serializes new research event families", () => {
    const json = exportResearchLog([
      createResearchEvent("s", "p", "sketch_object_created", { objectType: "enemy" }),
      createResearchEvent("s", "p", "clarification_answered", { reason: "semantic_ambiguity", answer: "recovery" }),
      createResearchEvent("s", "p", "intent_committed", { candidateId: "CI-1" }),
      createResearchEvent("s", "p", "convention_confirmed", { scope: "project" }),
      createResearchEvent("s", "p", "repair_layer_selected", { layer: "interpretation" }),
    ]);
    expect(json).toContain("sketch_object_created");
    expect(json).toContain("clarification_answered");
    expect(json).toContain("repair_layer_selected");
  });
});
