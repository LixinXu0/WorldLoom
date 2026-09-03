import type { ResearchEvent } from "./interactionLogger";

export type ResearchMetrics = {
  interpretation_accept_rate: number;
  interpretation_adjustment_rate: number;
  alternative_selection_rate: number;
  recompile_count: number;
  undo_count: number;
  redo_count: number;
  variant_rejection_count: number;
  local_edit_count: number;
  manual_override_count: number;
  source_intent_revision_count: number;
  all_variant_edit_count: number;
  time_to_first_compile: number | null;
  time_in_interpretation: number | null;
  time_to_variant_selection: number | null;
  total_task_time: number | null;
  time_to_first_composition: number | null;
  time_to_committed_composition: number | null;
  clarifications_per_task: number;
  clarification_time: number | null;
  asset_role_correction_rate: number;
  composition_mismatch_rate: number;
  edit_plan_modification_rate: number;
  preservation_constraint_use: number;
  convention_reuse_rate: number;
  number_of_manual_asset_moves_after_apply: number;
  repair_layer_distribution: Record<string, number>;
};

function count(events: ResearchEvent[], type: ResearchEvent["eventType"]): number {
  return events.filter((event) => event.eventType === type).length;
}

function first(events: ResearchEvent[], type: ResearchEvent["eventType"]): ResearchEvent | undefined {
  return events.find((event) => event.eventType === type);
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(3));
}

export function calculateResearchMetrics(events: ResearchEvent[]): ResearchMetrics {
  const compileCount = count(events, "compile_requested");
  const returnedCount = count(events, "interpretation_returned");
  const acceptedCount = count(events, "interpretation_accepted");
  const adjustedCount = count(events, "interpretation_adjusted");
  const alternativeCount = count(events, "interpretation_alternative_selected");
  const sessionStart = first(events, "session_started")?.timestamp ?? events[0]?.timestamp;
  const firstCompile = first(events, "compile_requested")?.timestamp;
  const firstReturned = first(events, "interpretation_returned")?.timestamp;
  const firstVariant = first(events, "variant_selected")?.timestamp;
  const firstComposition = first(events, "composition_interpretation_requested")?.timestamp;
  const committedComposition = first(events, "composition_committed")?.timestamp;
  const firstClarification = first(events, "clarification_shown")?.timestamp;
  const answeredClarification = first(events, "clarification_answered")?.timestamp;
  const lastEvent = events.at(-1)?.timestamp;
  const planApplied = first(events, "edit_plan_applied")?.timestamp;
  const repairEvents = events.filter((event) => event.eventType === "repair_layer_selected");
  const repairLayerDistribution = Object.fromEntries(repairEvents.map((event) => String(event.payload.layer)).filter(Boolean).map((layer) => [layer, repairEvents.filter((event) => event.payload.layer === layer).length]));
  const assetMovesAfterApply = planApplied ? events.filter((event) => event.eventType === "asset_moved" && event.timestamp > planApplied).length : 0;

  return {
    interpretation_accept_rate: rate(acceptedCount, returnedCount),
    interpretation_adjustment_rate: rate(adjustedCount, returnedCount),
    alternative_selection_rate: rate(alternativeCount, returnedCount),
    recompile_count: Math.max(0, compileCount - 1),
    undo_count: count(events, "undo"),
    redo_count: count(events, "redo"),
    variant_rejection_count: count(events, "variant_selected") > 1 ? count(events, "variant_selected") - 1 : 0,
    local_edit_count: events.filter((event) => event.eventType === "edit_applied" && event.payload.scope === "instance").length,
    manual_override_count: events.filter((event) => event.eventType === "edit_applied" && event.payload.scope === "instance").length,
    source_intent_revision_count: events.filter((event) => event.eventType === "edit_applied" && event.payload.scope === "source-intent").length,
    all_variant_edit_count: events.filter((event) => event.eventType === "edit_applied" && event.payload.scope === "all-variants").length,
    time_to_first_compile: sessionStart && firstCompile ? firstCompile - sessionStart : null,
    time_in_interpretation: firstCompile && firstReturned ? firstReturned - firstCompile : null,
    time_to_variant_selection: sessionStart && firstVariant ? firstVariant - sessionStart : null,
    total_task_time: sessionStart && lastEvent ? lastEvent - sessionStart : null,
    time_to_first_composition: sessionStart && firstComposition ? firstComposition - sessionStart : null,
    time_to_committed_composition: sessionStart && committedComposition ? committedComposition - sessionStart : null,
    clarifications_per_task: count(events, "clarification_shown"),
    clarification_time: firstClarification && answeredClarification ? answeredClarification - firstClarification : null,
    asset_role_correction_rate: rate(count(events, "asset_role_corrected"), count(events, "asset_role_proposed")),
    composition_mismatch_rate: rate(count(events, "repair_layer_selected"), count(events, "composition_hypothesis_returned")),
    edit_plan_modification_rate: rate(count(events, "edit_plan_modified"), count(events, "edit_plan_generated")),
    preservation_constraint_use: count(events, "asset_locked"),
    convention_reuse_rate: rate(count(events, "convention_reused"), count(events, "convention_detected") + count(events, "convention_confirmed")),
    number_of_manual_asset_moves_after_apply: assetMovesAfterApply,
    repair_layer_distribution: repairLayerDistribution,
  };
}
