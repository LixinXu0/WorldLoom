import { nanoid } from "nanoid";

export type ResearchEventType =
  | "session_started"
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
  | "generation_requested"
  | "variant_generated"
  | "variant_selected"
  | "edit_applied"
  | "edit_scope_selected"
  | "undo"
  | "redo"
  | "playtest_started"
  | "playtest_finished"
  | "feedback_submitted"
  | "sketch_object_created"
  | "sketch_object_moved"
  | "relation_created"
  | "relation_deleted"
  | "group_created"
  | "interpretation_candidate_created"
  | "clarification_triggered"
  | "clarification_shown"
  | "clarification_answered"
  | "clarification_skipped"
  | "intent_committed"
  | "convention_proposed"
  | "convention_confirmed"
  | "convention_rejected"
  | "convention_reused"
  | "convention_corrected"
  | "repair_started"
  | "repair_layer_selected"
  | "repair_completed"
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
  | "relation_changed"
  | "composition_interpretation_requested"
  | "composition_hypothesis_returned"
  | "asset_role_proposed"
  | "asset_role_corrected"
  | "composition_committed"
  | "level_state_finalized"
  | "structural_conflict_detected"
  | "generation_started"
  | "generation_contract_ready"
  | "edit_plan_generated"
  | "edit_plan_modified"
  | "edit_plan_applied"
  | "edit_plan_rejected"
  | "convention_detected"
  | "convention_conflict"
  | "freehand_stroke_started"
  | "freehand_stroke_completed"
  | "freehand_stroke_deleted"
  | "sketch_mark_deleted"
  | "sketch_object_deleted"
  | "sketch_annotation_deleted"
  | "sketch_episode_started"
  | "sketch_episode_completed"
  | "gesture_candidate_generated"
  | "interpret_selection_requested"
  | "ai_marker_created"
  | "ai_card_created"
  | "ai_card_moved"
  | "marker_moved"
  | "marker_deleted"
  | "ai_question_generated"
  | "ai_question_reopened"
  | "interpretation_committed"
  | "constraint_note_created";

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

export function createResearchEvent(sessionId: string, projectId: string, eventType: ResearchEventType, payload: Record<string, unknown> = {}, timestamp = Date.now()): ResearchEvent {
  return { eventId: `RE-${nanoid(8)}`, timestamp, sessionId, projectId, eventType, payload };
}

export function exportResearchLog(events: ResearchEvent[]): string {
  return JSON.stringify({ version: "1.0.0", exportedAt: Date.now(), events }, null, 2);
}
