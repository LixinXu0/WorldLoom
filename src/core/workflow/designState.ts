import { nanoid } from "nanoid";
import type { PlayableGenerationContract, StructuralIssue, WorldloomProject } from "../types";

export function dimensionsFromHypothesis(hypothesis: WorldloomProject["compositionHypothesis"]) {
  const summary = `${hypothesis?.summary ?? ""} ${hypothesis?.assetRoles.map((role) => role.proposedRole).join(" ") ?? ""}`.toLowerCase();
  const values: Record<string, number> = {
    grouping_combat: /combat|encounter|enemy|defen/.test(summary) ? 0.78 : 0.32,
    local_regional: /regional|global|landmark/.test(summary) ? 0.68 : 0.32,
    detour_main_route: /main|approach|route/.test(summary) ? 0.72 : 0.28,
    optional_mandatory: /optional|detour/.test(summary) ? 0.22 : 0.6,
    decorative_functional: /functional|encounter|reward|gate/.test(summary) ? 0.8 : 0.38,
    low_risk_high_risk: /enemy|combat|danger|conflict/.test(summary) ? 0.72 : 0.3,
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { proposed: value, value, adjusted: false }]));
}

export function validateDesignState(project: WorldloomProject): StructuralIssue[] {
  const issues: StructuralIssue[] = [];
  const assets = project.sketchState.assetInstances;
  const hasRoute = project.sketchState.rawStrokes.some((stroke) => !stroke.deleted) || project.sketchState.marks.some((mark) => mark.kind === "path" || mark.kind === "arrow");
  if (assets.length === 0) issues.push({ id: "missing-start", severity: "error", message: "Start is missing: place at least one scene element to define the playable space." });
  if (!hasRoute) issues.push({ id: "missing-route", severity: "warning", message: "No route is defined between the start and goal." });
  if (project.sketchState.relations.some((relation) => /gates|blocks/.test(relation.relationType)) && !assets.some((asset) => asset.assetDefinitionId === "gate")) issues.push({ id: "missing-gate", severity: "error", message: "A gate dependency is referenced, but no gate asset is present." });
  const optionalTargets = project.sketchState.relations.filter((relation) => /optional|leads/.test(relation.relationType)).map((relation) => relation.targetId);
  if (optionalTargets.some((target) => target && project.committedCompositionIntent?.assetInstanceIds.includes(target))) issues.push({ id: "optional-mandatory", severity: "warning", message: "An optional branch contains a committed progression element." });
  return issues;
}

export function buildGenerationContract(project: WorldloomProject): PlayableGenerationContract {
  return {
    id: `CONTRACT-${nanoid(7)}`,
    spatial_constraints: [
      ...project.sketchState.relations.map((relation) => ({ sourceId: relation.sourceId, targetId: relation.targetId, relation: relation.relationType })),
      ...project.sketchState.annotations.map((annotation) => ({ targetId: annotation.targetId, note: annotation.text })),
    ],
    gameplay_constraints: project.constraints,
    experience_constraints: project.committedCompositionIntent?.experientialGoals ?? [],
    asset_constraints: project.sketchState.assetInstances.map((asset) => ({ id: asset.id, assetDefinitionId: asset.assetDefinitionId, position: asset.position, preserve: Boolean(asset.preserve || asset.locked), roles: asset.roleAssignments })),
    provenance: [{ type: "worldloom-design-state", projectId: project.projectId, timestamp: Date.now() }],
    createdAt: Date.now(),
    status: "ready",
  };
}
