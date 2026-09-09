import { nanoid } from "nanoid";

export type ResearchEventType =
  | "session_started"

  // Sketch / authoring
  | "stroke_created"
  | "stroke_modified"
  | "stroke_deleted"
  | "text_instruction_changed"
  | "interpretation_mode_selected"
  | "compile_requested"
  | "interpretation_returned"
  | "interpretation_accepted"
  | "interpretation_adjusted"
  | "interpretation_alternative_selected"
  | "interpretation_rejected"

  // Generation
  | "generation_requested"
  | "variant_generated"
  | "variant_selected"
  | "local_regeneration_requested"
  | "local_regeneration_completed"

  // Editing
  | "edit_applied"
  | "edit_scope_selected"
  | "undo"
  | "redo"

  // Playtest
  | "playtest_started"
  | "playtest_finished"
  | "feedback_submitted"

  // Sketch objects / relations
  | "sketch_object_created"
  | "sketch_object_moved"
  | "relation_created"
  | "relation_deleted"
  | "relation_changed"
  | "group_created"

  // Interpretation
  | "interpretation_candidate_created"
  | "clarification_triggered"
  | "clarification_shown"
  | "clarification_answered"
  | "clarification_skipped"
  | "intent_committed"

  // Gameplay negotiation
  | "gameplay_candidate_generated"
  | "gameplay_candidate_selected"
  | "gameplay_candidate_committed"
  | "gameplay_candidate_rejected"
  | "gameplay_candidate_changed"

  // Spatial constraints
  | "spatial_constraint_created"
  | "spatial_constraint_updated"
  | "spatial_constraint_committed"
  | "spatial_constraint_removed"
  | "spatial_constraint_mode_changed"
  | "spatial_constraint_tolerance_changed"

  // Gameplay validation
  | "gameplay_validation_requested"
  | "gameplay_validation_completed"
  | "gameplay_conflict_detected"

  // Gameplay repair
  | "gameplay_repair_generated"
  | "gameplay_repair_selected"
  | "gameplay_repair_applied"
  | "gameplay_repair_rejected"

  // Conventions / repair
  | "convention_proposed"
  | "convention_confirmed"
  | "convention_rejected"
  | "convention_reused"
  | "convention_corrected"
  | "repair_started"
  | "repair_layer_selected"
  | "repair_completed"

  // Assets
  | "asset_dragged_from_library"
  | "asset_instance_created"
  | "asset_moved"
  | "asset_rotated"
  | "asset_locked"
  | "asset_unlocked"
  | "asset_duplicated"
  | "asset_deleted"
  | "assets_grouped"
  | "assets_ungrouped"

  // Composition
  | "composition_interpretation_requested"
  | "composition_hypothesis_returned"
  | "asset_role_proposed"
  | "asset_role_corrected"
  | "composition_committed"
  | "edit_plan_generated"
  | "edit_plan_modified"
  | "edit_plan_applied"
  | "edit_plan_rejected"

  // Convention inference
  | "convention_detected"
  | "convention_conflict"

  // Freehand sketch
  | "freehand_stroke_started"
  | "freehand_stroke_completed"
  | "freehand_stroke_deleted"
  | "sketch_episode_started"
  | "sketch_episode_completed"
  | "gesture_candidate_generated"
  | "interpret_selection_requested";

export type ResearchEvent = {
  eventId: string;
  timestamp: number;
  sessionId: string;
  projectId: string;
  eventType: ResearchEventType;
  payload: Record<string, unknown>;
};

export function createResearchSessionId(): string {
  return `RS-${nanoid(8)}`;
}

export function createResearchEvent(
  sessionId: string,
  projectId: string,
  eventType: ResearchEventType,
  payload: Record<string, unknown> = {},
  timestamp = Date.now(),
): ResearchEvent {
  return {
    eventId: `RE-${nanoid(8)}`,
    timestamp,
    sessionId,
    projectId,
    eventType,
    payload,
  };
}

export function exportResearchLog(
  events: ResearchEvent[],
): string {
  return JSON.stringify(
    {
      version: "1.1.0",
      exportedAt: Date.now(),
      events,
    },
    null,
    2,
  );
}