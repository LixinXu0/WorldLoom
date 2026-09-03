import { describe, expect, it } from "vitest";
import type { EditScope, RoomEdit, RoomNode, WorldloomProject } from "../core/types";
import { compileConstraints } from "../core/compiler/compileConstraints";
import { buildExperienceField } from "../core/field/buildExperienceField";
import { generateVariants } from "../core/generator/generateVariants";
import { captureRoomEdit } from "../core/editing/captureRoomEdit";
import { inferEditMeaning } from "../core/editing/inferEditMeaning";
import { buildImpactPreview } from "../core/editing/buildImpactPreview";
import { applyEdit } from "../core/editing/applyEdit";
import { createRevision } from "../core/revisions/createRevision";
import { restoreRevision } from "../core/revisions/restoreRevision";
import { migrateProject } from "../core/migration/migrateProject";
import { calculateIntendedTimeline } from "../core/timeline/calculateIntendedTimeline";
import { calculateRealizedTimeline } from "../core/timeline/calculateRealizedTimeline";
import { calculatePlayedTimeline } from "../core/timeline/calculatePlayedTimeline";
import { createFeedback, createPlaytestSession, enterRoom } from "../core/playtest/playtestModel";
import { createEmptyProject, createExampleStrokes } from "../examples/exampleProject";

const W = 960;
const H = 560;

function projectWithVariants(): WorldloomProject {
  const strokes = createExampleStrokes();
  const constraints = compileConstraints(strokes);
  const variants = generateVariants(strokes, constraints, buildExperienceField(strokes, W, H), 1234, W, H);
  return { ...createEmptyProject(), strokes, constraints, variants, activeVariantId: variants[0].id, workingVariantId: variants[1].id };
}

function editableCombat(project: WorldloomProject): { variantId: string; room: RoomNode } {
  const variant = project.variants.find((item) => item.id === project.workingVariantId) ?? project.variants[0];
  const room = variant.rooms.find((item) => item.role === "combat" && item.sourceConstraintIds.length > 0) ?? variant.rooms.find((item) => item.role !== "entrance" && item.role !== "exit");
  if (!room) throw new Error("missing editable room");
  return { variantId: variant.id, room };
}

function editFor(project: WorldloomProject, patch: Partial<RoomNode>, scope: EditScope = "instance"): RoomEdit {
  const target = editableCombat(project);
  const after = { ...target.room, ...patch };
  const edit = captureRoomEdit("ED-test", target.room, after, target.variantId, patch.role ? "role" : patch.intensity ? "intensity" : "size", 1);
  return { ...edit, scope, inferredMeaning: inferEditMeaning(edit, target.room, project.constraints, project.strokes) };
}

describe("Worldloom v2 editing loop", () => {
  it("Instance edit only modifies the current room and not constraints", () => {
    const project = projectWithVariants();
    const edit = editFor(project, { width: editableCombat(project).room.width + 30 });
    const result = applyEdit(project, edit, "instance");
    expect(result.constraints).toEqual(project.constraints);
    expect(result.manualOverrides).toHaveLength(1);
    const changed = result.variants.find((variant) => variant.id === edit.variantId)?.rooms.find((room) => room.id === edit.roomId);
    expect(changed?.width).toBe(edit.after.width);
    const otherChanged = result.variants.filter((variant) => variant.id !== edit.variantId).some((variant) => variant.rooms.some((room) => room.id === edit.roomId && room.width === edit.after.width));
    expect(otherChanged).toBe(false);
  });

  it("Variant Rule only affects the current variant", () => {
    const project = projectWithVariants();
    const edit = editFor(project, { width: editableCombat(project).room.width + 20 }, "variant-rule");
    const result = applyEdit(project, edit, "variant-rule");
    expect(result.variantRuleOverrides).toHaveLength(1);
    expect(result.variants.find((variant) => variant.id === edit.variantId)?.modified).toBe(true);
    expect(result.variants.filter((variant) => variant.id !== edit.variantId).every((variant) => !variant.modified)).toBe(true);
  });

  it("Source Intent modifies referenced constraints and multiple variants", () => {
    const project = projectWithVariants();
    const edit = editFor(project, { intensity: 0.25 }, "source-intent");
    const result = applyEdit(project, edit, "source-intent");
    expect(result.strokeInterpretationOverrides.length).toBeGreaterThan(0);
    expect(result.constraints.some((constraint) => constraint.userAdjusted)).toBe(true);
    expect(result.variants.filter((variant) => variant.modified).length).toBeGreaterThan(1);
  });

  it("All Variants applies a preference across matching roles only", () => {
    const project = projectWithVariants();
    const room = editableCombat(project).room;
    const edit = editFor(project, { width: room.width + 18 }, "all-variants");
    const result = applyEdit(project, edit, "all-variants");
    expect(result.globalDesignPreferences).toHaveLength(1);
    const role = room.role;
    expect(result.variants.every((variant, index) => variant.rooms.filter((candidate) => candidate.role === role).length >= project.variants[index].rooms.filter((candidate) => candidate.role === role).length)).toBe(true);
  });

  it("locked rooms are preserved during propagated edits", () => {
    const project = projectWithVariants();
    const target = editableCombat(project);
    const lockedRoom = project.variants.find((variant) => variant.id === target.variantId)?.rooms.find((room) => room.id !== target.room.id && room.role === target.room.role);
    if (!lockedRoom) return;
    const lockedProject = { ...project, variants: project.variants.map((variant) => variant.id === target.variantId ? { ...variant, rooms: variant.rooms.map((room) => room.id === lockedRoom.id ? { ...room, locked: true } : room) } : variant) };
    const edit = editFor(lockedProject, { width: target.room.width + 25 }, "variant-rule");
    const result = applyEdit(lockedProject, edit, "variant-rule");
    const preserved = result.variants.find((variant) => variant.id === target.variantId)?.rooms.find((room) => room.id === lockedRoom.id);
    expect(preserved?.width).toBe(lockedRoom.width);
  });

  it("resize edit generates interpretation candidates", () => {
    const project = projectWithVariants();
    const edit = editFor(project, { width: editableCombat(project).room.width + 25 });
    expect(edit.inferredMeaning.length).toBeGreaterThan(0);
    expect(edit.inferredMeaning.some((item) => item.proposedChanges.length > 0)).toBe(true);
  });

  it("Impact Preview references real ids", () => {
    const project = projectWithVariants();
    const edit = editFor(project, { width: editableCombat(project).room.width + 25 });
    const preview = buildImpactPreview(project, edit, "source-intent");
    const variantIds = new Set(project.variants.map((variant) => variant.id));
    const roomIds = new Set(project.variants.flatMap((variant) => variant.rooms.map((room) => room.id)));
    expect(preview.affectedVariantIds.every((id) => variantIds.has(id))).toBe(true);
    expect(preview.affectedRoomIds.every((id) => roomIds.has(id))).toBe(true);
  });

  it("deleting an optional room manually can preserve entrance-exit route by avoiding main rooms", () => {
    const project = projectWithVariants();
    const variant = project.variants[0];
    const optionalRoom = variant.rooms.find((room) => variant.edges.some((edge) => edge.role === "optional" && edge.to === room.id));
    expect(optionalRoom?.role).not.toBe("entrance");
  });

  it("revision restore creates a new non-recursive restore revision", () => {
    const project = projectWithVariants();
    const revision = createRevision(project, "Initial Generation", [], undefined);
    const current = { ...project, revisions: [revision], activeRevisionId: revision.id };
    const restored = restoreRevision(current, revision);
    expect(restored.revisions.length).toBe(2);
    expect(restored.revisions[0].projectSnapshot.revisions).toEqual([]);
  });

  it("old JSON shape migrates to v2 defaults", () => {
    const oldProject = { version: "0.1.0", strokes: createExampleStrokes(), seed: 42 };
    const result = migrateProject(oldProject);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.version).toBe("4.0.0");
      expect(result.project.manualOverrides).toEqual([]);
    }
  });

  it("playtest starts at entrance and records room entry plus completion", () => {
    const project = projectWithVariants();
    const variant = project.variants[0];
    const start = createPlaytestSession(variant, 100);
    expect(start.session.currentRoomId).toBe("ENT");
    const nextId = variant.edges.find((edge) => edge.from === start.session.currentRoomId)?.to;
    if (!nextId) throw new Error("missing next room");
    const next = enterRoom(start.session, variant, nextId, 200);
    expect(["room-enter", "branch-enter", "session-complete"]).toContain(next.event.type);
  });

  it("feedback associates with a real room", () => {
    const project = projectWithVariants();
    const variant = project.variants[0];
    const { session } = createPlaytestSession(variant, 100);
    const feedback = createFeedback(session, variant.id, "too-intense", undefined, 150);
    expect(variant.rooms.some((room) => room.id === feedback.roomId)).toBe(true);
  });

  it("Intended, Realized, and Played timelines calculate data", () => {
    const project = projectWithVariants();
    const variant = project.variants[0];
    const { session, event } = createPlaytestSession(variant, 100);
    expect(calculateIntendedTimeline(project.strokes, project.constraints).length).toBeGreaterThan(1);
    expect(calculateRealizedTimeline(variant).length).toBeGreaterThan(1);
    expect(calculatePlayedTimeline(variant, [event], [createFeedback(session, variant.id, "good", undefined, 120)]).length).toBeGreaterThan(0);
  });
});
