import { nanoid } from "nanoid";
import type { EditScope, GlobalDesignPreference, LevelVariant, ManualOverride, RoomEdit, RoomNode, RuleAdjustment, StrokeInterpretationOverride, VariantRuleOverride, WorldloomProject } from "../types";
import { calculateIntentFit } from "../validator/calculateIntentFit";
import { validateReachability } from "../validator/validateReachability";
import { roomFromSnapshot } from "./captureRoomEdit";
import { repairAfterEdit } from "./repairAfterEdit";

function recalcVariant(variant: LevelVariant, project: WorldloomProject): LevelVariant {
  const repaired = repairAfterEdit(variant);
  const validation = validateReachability(repaired.rooms, repaired.edges);
  const intentFitBreakdown = calculateIntentFit(repaired, project.strokes);
  return { ...repaired, validation, intentFitBreakdown, intentFit: intentFitBreakdown.total, modified: true };
}

function applyAfter(room: RoomNode, edit: RoomEdit, manual = false): RoomNode {
  const updated = roomFromSnapshot(edit.after, room);
  return { ...updated, manual: manual || room.manual, locked: edit.after.locked ?? room.locked };
}

function adjustmentFor(edit: RoomEdit): RuleAdjustment {
  if (edit.property === "intensity" || edit.property === "encounterLevel") return { property: "encounterIntensity", operation: "set", value: edit.after.intensity };
  if (edit.property === "resourceLevel") return { property: "resourceDensity", operation: "set", value: edit.after.resourceLevel ?? 0.5 };
  if (edit.property === "size") return { property: "roomWidth", operation: "scale", value: Math.max(0.5, edit.after.width / Math.max(1, edit.before.width)) };
  return { property: "roomSpacing", operation: "increase", value: Math.hypot(edit.after.x - edit.before.x, edit.after.y - edit.before.y) };
}

function applyRoomAdjustment(room: RoomNode, edit: RoomEdit): RoomNode {
  if (room.locked && room.id !== edit.roomId) return room;
  if (edit.property === "size") {
    const widthScale = edit.after.width / Math.max(1, edit.before.width);
    const heightScale = edit.after.height / Math.max(1, edit.before.height);
    return { ...room, width: Math.max(30, room.width * widthScale), height: Math.max(26, room.height * heightScale) };
  }
  if (edit.property === "intensity") return { ...room, intensity: edit.after.intensity, encounterLevel: edit.after.encounterLevel ?? edit.after.intensity };
  if (edit.property === "role") return { ...room, role: edit.after.role };
  if (edit.property === "position") {
    const dx = edit.after.x - edit.before.x;
    const dy = edit.after.y - edit.before.y;
    return { ...room, x: room.x + dx * 0.5, y: room.y + dy * 0.5 };
  }
  return room;
}

function updateVariant(project: WorldloomProject, variant: LevelVariant, edit: RoomEdit, matcher: (room: RoomNode) => boolean, manual = false): LevelVariant {
  const rooms = variant.rooms.map((room) => matcher(room) ? (room.id === edit.roomId ? applyAfter(room, edit, manual) : applyRoomAdjustment(room, edit)) : room);
  return recalcVariant({ ...variant, rooms }, project);
}

function sourceConstraintIds(project: WorldloomProject, edit: RoomEdit): string[] {
  const variant = project.variants.find((item) => item.id === edit.variantId);
  const room = variant?.rooms.find((item) => item.id === edit.roomId);
  return room?.sourceConstraintIds ?? [];
}

function sourceStrokeId(project: WorldloomProject, edit: RoomEdit): string | null {
  const variant = project.variants.find((item) => item.id === edit.variantId);
  const room = variant?.rooms.find((item) => item.id === edit.roomId);
  return room?.sourceStrokeIds[0] ?? null;
}

function variantWithEditedRoom(project: WorldloomProject, edit: RoomEdit): LevelVariant | null {
  return project.variants.find((variant) => variant.id === edit.variantId) ?? null;
}

export function applyEdit(project: WorldloomProject, edit: RoomEdit, scope: EditScope): WorldloomProject {
  const constraintsForEdit = sourceConstraintIds(project, edit);
  const sourceVariant = variantWithEditedRoom(project, edit);
  if (!sourceVariant) return project;
  const sourceRoom = sourceVariant.rooms.find((room) => room.id === edit.roomId);
  if (!sourceRoom) return project;
  let next = { ...project };

  if (scope === "instance") {
    const override: ManualOverride = { id: `MO-${nanoid(5)}`, variantId: edit.variantId, roomId: edit.roomId, locked: edit.after.locked ?? true, properties: roomFromSnapshot(edit.after, sourceRoom), sourceEditId: edit.id };
    next = { ...next, manualOverrides: [...next.manualOverrides, override] };
    next.variants = next.variants.map((variant) => variant.id === edit.variantId ? updateVariant(next, variant, edit, (room) => room.id === edit.roomId, true) : variant);
  }

  if (scope === "variant-rule") {
    const override: VariantRuleOverride = { id: `VRO-${nanoid(5)}`, variantId: edit.variantId, strategy: sourceVariant.strategy, sourceConstraintIds: constraintsForEdit, adjustments: [adjustmentFor(edit)], sourceEditId: edit.id };
    next = { ...next, variantRuleOverrides: [...next.variantRuleOverrides, override] };
    next.variants = next.variants.map((variant) => variant.id === edit.variantId ? updateVariant(next, variant, edit, (room) => room.id === edit.roomId || room.role === sourceRoom.role || room.sourceConstraintIds.some((id) => constraintsForEdit.includes(id))) : variant);
  }

  if (scope === "source-intent") {
    const strokeId = sourceStrokeId(next, edit);
    const override: StrokeInterpretationOverride | null = strokeId ? { id: `SIO-${nanoid(5)}`, strokeId, disabledConstraintTargets: [], weightOverrides: {}, preferredValueOverrides: { encounter_intensity: edit.after.intensity }, note: `Created from ${edit.property} edit on ${edit.roomId}.`, sourceEditId: edit.id } : null;
    next = { ...next, strokeInterpretationOverrides: override ? [...next.strokeInterpretationOverrides, override] : next.strokeInterpretationOverrides };
    next.constraints = next.constraints.map((constraint) => constraintsForEdit.includes(constraint.id) && (constraint.target === "encounter_intensity" || constraint.target === "spatial_openness" || constraint.target === "recovery") ? { ...constraint, preferredValue: constraint.target === "spatial_openness" && edit.after.width > edit.before.width ? Math.min(1, constraint.preferredValue + 0.18) : edit.after.intensity, userAdjusted: true } : constraint);
    next.variants = next.variants.map((variant) => variant.rooms.some((room) => room.sourceConstraintIds.some((id) => constraintsForEdit.includes(id))) ? updateVariant(next, variant, edit, (room) => room.id === edit.roomId || room.sourceConstraintIds.some((id) => constraintsForEdit.includes(id))) : variant);
  }

  if (scope === "all-variants") {
    const preference: GlobalDesignPreference = { id: `GDP-${nanoid(5)}`, targetRoomRole: sourceRoom.role, adjustment: adjustmentFor(edit), enabled: true, sourceEditId: edit.id };
    next = { ...next, globalDesignPreferences: [...next.globalDesignPreferences, preference] };
    next.variants = next.variants.map((variant) => updateVariant(next, variant, edit, (room) => room.role === sourceRoom.role));
  }

  const appliedEdit: RoomEdit = { ...edit, scope, status: "applied" };
  return { ...next, editHistory: [...next.editHistory, appliedEdit], metadata: { ...next.metadata, updatedAt: Date.now() } };
}