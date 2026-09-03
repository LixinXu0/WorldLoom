import { nanoid } from "nanoid";
import { assetById } from "../../assets/mockAssetLibrary";
import type { AssetEditPlan, AssetEditOperation, CompositionIntent } from "./types";
import type { SketchState } from "../sketch/types";

export function commitCompositionIntent(hypothesis: import("./types").AssetCompositionHypothesis, sketch: SketchState): CompositionIntent {
  return {
    id: `COMP-${nanoid(6)}`,
    assetInstanceIds: hypothesis.assetRoles.map((role) => role.assetInstanceId),
    assignedRoles: Object.fromEntries(hypothesis.assetRoles.map((role) => [role.assetInstanceId, role.proposedRole])),
    spatialRelations: hypothesis.spatialRelations,
    gameplayRelations: hypothesis.gameplayRelations,
    experientialGoals: hypothesis.experientialGoals,
    preservationRules: sketch.assetInstances.filter((asset) => asset.locked || asset.preserve || hypothesis.preservationSuggestions.includes(asset.id)).map((asset) => ({
      assetInstanceId: asset.id,
      preserve: true,
      lockPosition: Boolean(asset.locked || asset.preserve),
      doNotDuplicate: Boolean(asset.doNotDuplicate),
      doNotReplace: Boolean(asset.doNotReplace),
    })),
    missingNeeds: hypothesis.missingNeeds,
    editScope: "selected-composition",
    provenance: { utteranceId: hypothesis.utteranceId, interpretationId: hypothesis.id, annotationIds: [] },
    committedAt: Date.now(),
  };
}

export function generateAssetEditPlan(intent: CompositionIntent, sketch: SketchState): AssetEditPlan {
  const preserved = new Set(intent.preservationRules.filter((rule) => rule.preserve || rule.lockPosition).map((rule) => rule.assetInstanceId));
  const operations: AssetEditOperation[] = [];
  for (const assetId of intent.assetInstanceIds) {
    const instance = sketch.assetInstances.find((asset) => asset.id === assetId);
    if (!instance) continue;
    const definition = assetById(instance.assetDefinitionId);
    const role = intent.assignedRoles[assetId] ?? definition?.candidateRoles[0] ?? "composition element";
    if (preserved.has(assetId)) {
      operations.push({ id: `AOP-${nanoid(5)}`, type: "preserve", assetId, lockPosition: true, doNotDuplicate: instance.doNotDuplicate, doNotReplace: instance.doNotReplace });
    }
    operations.push({ id: `AOP-${nanoid(5)}`, type: "assignRole", assetId, role });
    if (!preserved.has(assetId) && (instance.assetDefinitionId === "barricade" || instance.assetDefinitionId === "enemy_shrine")) {
      operations.push({
        id: `AOP-${nanoid(5)}`,
        type: "move",
        assetId,
        position: { ...instance.position, x: instance.position.x + (instance.assetDefinitionId === "barricade" ? -16 : 10), y: instance.position.y + 6, time: Date.now() },
        reason: "Tighten the defended encounter composition while preserving asset identity.",
      });
    }
  }
  for (const relation of intent.gameplayRelations) {
    if (relation.targetId) operations.push({ id: `AOP-${nanoid(5)}`, type: "connect", sourceId: relation.sourceId, targetId: relation.targetId, relation: relation.relation });
  }
  const previewSummary = operations.map((operation) => {
    if (operation.type === "preserve") return `Keep ${operation.assetId} preserved`;
    if (operation.type === "move") return `Move ${operation.assetId} slightly`;
    if (operation.type === "assignRole") return `Role ${operation.assetId} -> ${operation.role}`;
    if (operation.type === "connect") return `Relation ${operation.sourceId} -> ${operation.targetId} = ${operation.relation}`;
    return `${operation.type} operation`;
  });

  return { id: `PLAN-${nanoid(6)}`, sourceCompositionIntentId: intent.id, operations, previewSummary, status: "preview", createdAt: Date.now() };
}

export function applyAssetEditPlan(sketch: SketchState, plan: AssetEditPlan): SketchState {
  const moved = new Map(plan.operations.filter((operation): operation is Extract<AssetEditOperation, { type: "move" }> => operation.type === "move").map((operation) => [operation.assetId, operation.position]));
  const roles = new Map(plan.operations.filter((operation): operation is Extract<AssetEditOperation, { type: "assignRole" }> => operation.type === "assignRole").map((operation) => [operation.assetId, operation.role]));
  const preserved = new Set(plan.operations.filter((operation) => operation.type === "preserve").map((operation) => operation.assetId));
  return {
    ...sketch,
    assetInstances: sketch.assetInstances.map((asset) => ({
      ...asset,
      position: moved.get(asset.id) ?? asset.position,
      roleAssignments: roles.has(asset.id) ? Array.from(new Set([...asset.roleAssignments, roles.get(asset.id)!])) : asset.roleAssignments,
      preserve: asset.preserve || preserved.has(asset.id),
      locked: asset.locked || preserved.has(asset.id),
    })),
  };
}
