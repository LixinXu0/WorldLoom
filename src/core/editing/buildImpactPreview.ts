import type { EditScope, ImpactPreview, LevelVariant, RoomEdit, RoomNode, RouteEdge, WorldloomProject } from "../types";

function sharesSource(room: RoomNode, sourceIds: string[]): boolean {
  return sourceIds.length > 0 && room.sourceConstraintIds.some((id) => sourceIds.includes(id));
}

function adjacentEdges(roomId: string, edges: RouteEdge[]): string[] {
  return edges.filter((edge) => edge.from === roomId || edge.to === roomId).map((edge) => edge.id);
}

export function affectedRoomsForScope(project: WorldloomProject, edit: RoomEdit, scope: EditScope): { variantIds: string[]; roomIds: string[]; edgeIds: string[]; constraintIds: string[] } {
  const variant = project.variants.find((item) => item.id === edit.variantId);
  const sourceRoom = variant?.rooms.find((room) => room.id === edit.roomId);
  const sourceConstraintIds = sourceRoom?.sourceConstraintIds ?? [];
  if (!variant || !sourceRoom) return { variantIds: [], roomIds: [], edgeIds: [], constraintIds: [] };
  if (scope === "instance") {
    return { variantIds: [variant.id], roomIds: [sourceRoom.id], edgeIds: adjacentEdges(sourceRoom.id, variant.edges), constraintIds: [] };
  }
  if (scope === "variant-rule") {
    const rooms = variant.rooms.filter((room) => room.id === sourceRoom.id || sharesSource(room, sourceConstraintIds) || room.role === sourceRoom.role);
    return { variantIds: [variant.id], roomIds: rooms.map((room) => room.id), edgeIds: Array.from(new Set(rooms.flatMap((room) => adjacentEdges(room.id, variant.edges)))), constraintIds: sourceConstraintIds };
  }
  if (scope === "source-intent") {
    const variants = project.variants.filter((item) => item.rooms.some((room) => sharesSource(room, sourceConstraintIds)));
    const rooms = variants.flatMap((item) => item.rooms.filter((room) => sharesSource(room, sourceConstraintIds)).map((room) => room.id));
    const edges = variants.flatMap((item) => item.edges.filter((edge) => edge.sourceConstraintIds.some((id) => sourceConstraintIds.includes(id))).map((edge) => edge.id));
    return { variantIds: variants.map((item) => item.id), roomIds: Array.from(new Set(rooms)), edgeIds: Array.from(new Set(edges)), constraintIds: sourceConstraintIds };
  }
  const variants = project.variants;
  const rooms = variants.flatMap((item) => item.rooms.filter((room) => room.role === sourceRoom.role).map((room) => room.id));
  const edges = variants.flatMap((item) => item.edges.filter((edge) => edge.from === sourceRoom.id || edge.to === sourceRoom.id).map((edge) => edge.id));
  return { variantIds: variants.map((item) => item.id), roomIds: Array.from(new Set(rooms)), edgeIds: Array.from(new Set(edges)), constraintIds: sourceConstraintIds };
}

export function buildImpactPreview(project: WorldloomProject, edit: RoomEdit, scope: EditScope): ImpactPreview {
  const affected = affectedRoomsForScope(project, edit, scope);
  const beforeFit = project.variants.find((variant) => variant.id === edit.variantId)?.intentFit ?? 0;
  const sizeDelta = (edit.after.width * edit.after.height - edit.before.width * edit.before.height) / 1100;
  const intensityDelta = (edit.after.intensity - edit.before.intensity) * 8;
  const estimatedIntentFitDelta = Math.round(sizeDelta + intensityDelta);
  const validationRisks: string[] = [];
  if (edit.before.role === "entrance" || edit.before.role === "exit") validationRisks.push("Entrance and exit edits can affect route validity.");
  if (scope !== "instance" && affected.roomIds.length > 5) validationRisks.push("Several generated rooms will be repaired and revalidated.");
  if (edit.after.width < 30 || edit.after.height < 26) validationRisks.push("Room may become too small for clear traversal.");
  const verb = scope === "instance" ? "update one room" : scope === "variant-rule" ? "propagate within the working variant" : scope === "source-intent" ? "update source constraints and affected variants" : "apply a global design preference";
  return {
    editId: edit.id,
    affectedVariantIds: affected.variantIds,
    affectedRoomIds: affected.roomIds,
    affectedEdgeIds: affected.edgeIds,
    affectedConstraintIds: affected.constraintIds,
    willRegenerate: scope !== "instance",
    estimatedIntentFitDelta: beforeFit === 0 ? 0 : estimatedIntentFitDelta,
    validationRisks,
    summary: `This will ${verb}, touching ${affected.roomIds.length} room(s), ${affected.edgeIds.length} edge(s), and ${affected.constraintIds.length} constraint(s).`,
  };
}