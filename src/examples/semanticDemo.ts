import { createEmptyProject } from "./exampleProject";
import type { RawStroke } from "../core/sketch/types";
import type { SketchSemantic } from "../core/sketch/semanticStyles";
import type { ResearchEventType } from "../research/interactionLogger";

export const demoTrace: Array<{ eventType: ResearchEventType; label: string; time: string }> = [
  { eventType: "freehand_stroke_completed", label: "You drew a loop", time: "10:42" },
  { eventType: "composition_hypothesis_returned", label: "AI proposed encounter interpretation", time: "10:43" },
  { eventType: "clarification_shown", label: "Optional bypass questioned", time: "10:45" },
  { eventType: "convention_conflict", label: "Potential conflict detected", time: "10:48" },
  { eventType: "asset_locked", label: "Bridge constraint accepted", time: "10:50" },
];

export function createSemanticDemoProject() {
  const project = createEmptyProject();
  const now = Date.now();
  const assets: Array<[string, number, number]> = [
    ["watchtower", 320, 160],
    ["barricade", 400, 250],
    ["enemy_shrine", 490, 300],
    ["stone_stair", 250, 275],
    ["reward_chest", 330, 310],
    ["bridge", 515, 310],
    ["gate", 680, 320],
  ];

  project.name = "Ancient Ruins · Semantic demo";
  project.sketchState.assetInstances = assets.map(([id, x, y]) => ({
    id: `demo-${id}`,
    assetDefinitionId: id,
    position: { x, y, time: now },
    rotation: 0,
    scale: 1,
    locked: false,
    preserve: id === "bridge",
    roleAssignments: [],
    createdAt: now,
  }));

  const stroke = (id: string, semanticStyle: SketchSemantic, points: number[][]): RawStroke => ({
    id,
    semanticStyle,
    points: points.map(([x, y], index) => ({ x, y, t: now + index })),
    createdAt: now,
  });

  project.sketchState.rawStrokes = [
    stroke("demo-main", "main-route", [[255, 295], [273, 266], [284, 243], [276, 224], [292, 202], [309, 194]]),
    stroke("demo-optional", "optional-path", [[255, 295], [217, 305], [213, 332], [261, 355], [334, 358], [385, 346], [433, 330], [478, 315]]),
    stroke("demo-region", "region-contour", [[273, 129], [321, 108], [368, 133], [377, 186], [349, 212], [299, 216], [265, 186], [273, 129]]),
    stroke("demo-danger", "conflict-zone", [[626, 284], [682, 270], [727, 301], [728, 348], [682, 375], [627, 359], [610, 320], [626, 284]]),
    stroke("demo-bypass", "uncertain-bypass", [[530, 355], [564, 334], [588, 305], [594, 272], [575, 248]]),
    stroke("demo-note", "note-arrow", [[221, 238], [234, 244], [239, 259]]),
  ];

  project.sketchState.annotations = [
    { id: "demo-label-tower", targetId: "demo-watchtower", text: "high ground overlooks area", createdAt: now },
    { id: "demo-label-chest", targetId: "demo-reward_chest", text: "optional side path?", createdAt: now },
    { id: "demo-label-gate", targetId: "demo-gate", text: "enemy stronghold", createdAt: now },
  ];
  project.sketchState.semanticItems = [
    { id: "demo-question", kind: "question", targetId: "demo-enemy_shrine", text: "This branch bypasses the encounter. Should it remain optional?", source: "demo", offset: { x: 120, y: -125 } },
    { id: "demo-reading", kind: "reading", targetId: "demo-barricade", text: "Possible local challenge zone with a bonus reward.", source: "demo", offset: { x: 10, y: -70 } },
    { id: "demo-constraint", kind: "constraint", targetId: "demo-bridge", text: "Bridge: exact asset, approximate placement.", source: "demo", offset: { x: 70, y: -110 } },
    { id: "demo-uncertainty", kind: "uncertainty", targetId: "demo-reward_chest", text: "Optional side path? Reward placement is unresolved.", source: "demo", offset: { x: -66, y: 0 } },
    { id: "demo-conflict", kind: "conflict", targetId: "demo-gate", text: "Enemy stronghold: check whether this gate blocks the main approach.", source: "demo", offset: { x: 48, y: 18 } },
  ];
  project.sketchState.relations = [
    { id: "demo-approach-relation", sourceId: "demo-stone_stair", targetId: "demo-watchtower", relationType: "connects", directed: true },
  ];
  project.sketchSelection.ids = ["demo-watchtower"];
  return project;
}
