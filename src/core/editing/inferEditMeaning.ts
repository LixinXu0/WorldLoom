import type { ConstraintTarget, EditInterpretation, GameplayConstraint, ProposedChange, RoomEdit, RoomNode, Stroke, StrokeType } from "../types";

function sourceTargets(room: RoomNode, constraints: GameplayConstraint[]): Set<ConstraintTarget> {
  return new Set(room.sourceConstraintIds.map((id) => constraints.find((constraint) => constraint.id === id)?.target).filter((target): target is ConstraintTarget => Boolean(target)));
}

function sourceStrokeTypes(room: RoomNode, strokes: Stroke[]): Set<StrokeType> {
  return new Set(room.sourceStrokeIds.map((id) => strokes.find((stroke) => stroke.id === id)?.type).filter((type): type is StrokeType => Boolean(type)));
}

function change(entityType: ProposedChange["entityType"], entityId: string, property: string, before: unknown, after: unknown): ProposedChange {
  return { entityType, entityId, property, before, after };
}

export function inferEditMeaning(edit: RoomEdit, room: RoomNode, constraints: GameplayConstraint[], strokes: Stroke[]): EditInterpretation[] {
  const interpretations: EditInterpretation[] = [];
  const targets = sourceTargets(room, constraints);
  const strokeTypes = sourceStrokeTypes(room, strokes);
  const areaBefore = edit.before.width * edit.before.height;
  const areaAfter = edit.after.width * edit.after.height;
  const areaDelta = areaAfter - areaBefore;
  const intensityDelta = edit.after.intensity - edit.before.intensity;
  const moved = Math.hypot(edit.after.x - edit.before.x, edit.after.y - edit.before.y);
  const primaryConstraint = room.sourceConstraintIds[0] ?? "local";

  interpretations.push({
    id: `${edit.id}-instance`,
    label: "Keep this as a local exception",
    description: "Preserve this room edit only in the working variant without changing constraints or strokes.",
    confidence: 0.72,
    target: "room-instance",
    proposedChanges: [change("room", room.id, edit.property, edit.before, edit.after)],
    recommendedScope: "instance",
  });

  if (edit.property === "size" || Math.abs(areaDelta) > 160) {
    if (areaDelta > 0 && strokeTypes.has("pressure")) {
      interpretations.push({
        id: `${edit.id}-pressure-combat`,
        label: "Keep pressure, reduce spatial compression",
        description: "This wider pressure-sourced room suggests pressure should be expressed more through encounters than cramped space.",
        confidence: 0.82,
        target: "constraint",
        proposedChanges: [change("constraint", primaryConstraint, "spatial_openness", "compressed", "more-open")],
        recommendedScope: "source-intent",
      });
      interpretations.push({
        id: `${edit.id}-larger-arenas`,
        label: "Prefer larger combat arenas here",
        description: "Apply a variant-level rule to similar combat rooms generated from the same source.",
        confidence: 0.68,
        target: "variant-override",
        proposedChanges: [change("variant-rule", edit.variantId, "roomWidth", edit.before.width, edit.after.width)],
        recommendedScope: "variant-rule",
      });
    }
    if (areaDelta > 0 && (strokeTypes.has("relief") || targets.has("recovery"))) {
      interpretations.push({
        id: `${edit.id}-relief-open`,
        label: "Make relief spaces more prominent",
        description: "Relief-sourced rooms should read as larger, more open recovery areas.",
        confidence: 0.8,
        target: "global-preference",
        proposedChanges: [change("global-preference", room.role, "roomWidth", edit.before.width, edit.after.width)],
        recommendedScope: "all-variants",
      });
    }
    if (areaDelta < 0 && strokeTypes.has("pressure")) {
      interpretations.push({
        id: `${edit.id}-pressure-compress`,
        label: "Express pressure through spatial compression",
        description: "The smaller room reinforces a spatial-pressure interpretation for this source.",
        confidence: 0.84,
        target: "constraint",
        proposedChanges: [change("constraint", primaryConstraint, "spatial_openness", "open", "compressed")],
        recommendedScope: "source-intent",
      });
    }
  }

  if (edit.property === "role" && edit.before.role !== edit.after.role) {
    if (edit.before.role === "combat" && edit.after.role === "relief") {
      interpretations.push({
        id: `${edit.id}-combat-to-relief`,
        label: "Lower combat and add recovery",
        description: "This role change reduces encounter pressure and increases recovery/resource expression in the source region.",
        confidence: 0.86,
        target: "constraint",
        proposedChanges: [change("constraint", primaryConstraint, "encounter_intensity", "higher", "lower"), change("constraint", primaryConstraint, "recovery", "lower", "higher")],
        recommendedScope: "source-intent",
      });
    } else {
      interpretations.push({
        id: `${edit.id}-role-rule`,
        label: "Adjust this variant's room role mapping",
        description: "Apply this role choice to similar rooms in the current strategy.",
        confidence: 0.64,
        target: "variant-override",
        proposedChanges: [change("variant-rule", edit.variantId, "role", edit.before.role, edit.after.role)],
        recommendedScope: "variant-rule",
      });
    }
  }

  if (edit.property === "intensity" || Math.abs(intensityDelta) > 0.05) {
    interpretations.push({
      id: `${edit.id}-intensity`,
      label: intensityDelta > 0 ? "Raise encounter intensity" : "Reduce encounter intensity",
      description: "Update encounter expression for the source constraint while preserving room provenance.",
      confidence: 0.78,
      target: "constraint",
      proposedChanges: [change("constraint", primaryConstraint, "encounter_intensity", edit.before.intensity, edit.after.intensity)],
      recommendedScope: "source-intent",
    });
  }

  if (edit.property === "position" || moved > 12) {
    interpretations.push({
      id: `${edit.id}-move-region`,
      label: "Shift realization region",
      description: "The room moved away from its generated position; similar source rooms can follow only if you broaden the scope.",
      confidence: Math.min(0.82, 0.45 + moved / 160),
      target: "variant-override",
      proposedChanges: [change("variant-rule", edit.variantId, "roomSpacing", edit.before, edit.after)],
      recommendedScope: "variant-rule",
    });
  }

  return interpretations.slice(0, 4);
}