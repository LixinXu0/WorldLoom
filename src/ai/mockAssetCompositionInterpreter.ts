import { nanoid } from "nanoid";
import { assetById } from "../assets/mockAssetLibrary";
import type { ConventionEntry } from "../core/conventions/types";
import type { AssetCompositionHypothesis } from "../core/composition/types";
import type { ClarificationRequest } from "../core/intent/types";
import type { AssetAwareVisualUtterance, SketchState } from "../core/sketch/types";

function hasAsset(sketch: SketchState, utterance: AssetAwareVisualUtterance, definitionId: string): boolean {
  return sketch.assetInstances.some((asset) => utterance.assetInstanceIds.includes(asset.id) && asset.assetDefinitionId === definitionId);
}

function firstAsset(sketch: SketchState, definitionId: string): string | undefined {
  return sketch.assetInstances.find((asset) => asset.assetDefinitionId === definitionId)?.id;
}

export function interpretAssetComposition(sketch: SketchState, utterance: AssetAwareVisualUtterance, conventions: ConventionEntry[] = []): AssetCompositionHypothesis {
  const hasTower = hasAsset(sketch, utterance, "watchtower");
  const hasBarricade = hasAsset(sketch, utterance, "barricade");
  const hasStair = hasAsset(sketch, utterance, "stone_stair");
  const hasShrine = hasAsset(sketch, utterance, "enemy_shrine");
  const hasChestAnywhere = sketch.assetInstances.some((asset) => asset.assetDefinitionId === "reward_chest");
  const hasGate = hasAsset(sketch, utterance, "gate");
  const hasHealing = hasAsset(sketch, utterance, "healing_shrine");
  const hasBridge = hasAsset(sketch, utterance, "bridge");
  const hasLoop = sketch.marks.some((mark) => utterance.markIds.includes(mark.id) && (mark.kind === "loop" || mark.kind === "region"));
  const hasRawLoop = sketch.gestureCandidates.some((gesture) => utterance.gestureCandidateIds.includes(gesture.id) && gesture.kind === "closed_loop");
  const hasRawArrow = sketch.gestureCandidates.some((gesture) => utterance.gestureCandidateIds.includes(gesture.id) && gesture.kind === "arrow_like");
  const matchedConvention = conventions.find((entry) => entry.enabled && /encounter|recovery|detour/i.test(entry.humanReadableLabel));
  const assetRoles = utterance.assetInstanceIds.map((assetInstanceId) => {
    const instance = sketch.assetInstances.find((asset) => asset.id === assetInstanceId);
    const definition = instance ? assetById(instance.assetDefinitionId) : undefined;
    return { assetInstanceId, proposedRole: definition?.candidateRoles[0] ?? "composition element", confidence: 0.72 };
  });
  const clarificationRequests: ClarificationRequest[] = [];
  let summary = "I think this composition arranges existing assets into a local gameplay beat.";
  let experientialGoals = ["preserve asset identity", "clarify composition before edits"];
  let confidence = matchedConvention ? 0.86 : 0.72;

  if (hasTower && hasBarricade && hasStair && hasShrine && (hasLoop || hasRawLoop)) {
    summary = "I think this is a defended high-ground encounter reached from the stair.";
    experientialGoals = ["defended high-ground encounter", "approach pressure", "optional reward outside combat group"];
    confidence = matchedConvention ? 0.9 : 0.84;
    const chestId = firstAsset(sketch, "reward_chest");
    if (hasChestAnywhere && chestId && !utterance.assetInstanceIds.includes(chestId)) {
      clarificationRequests.push({
        id: `CLR-${nanoid(5)}`,
        targetSketchIds: [chestId],
        reason: "high_impact",
        question: "Is the Reward Chest part of this encounter, or a separate optional reward?",
        options: [
          { id: "chest-separate-reward", label: "Separate optional reward", answerValue: "separate optional reward" },
          { id: "chest-post-combat", label: "Post-combat reward", answerValue: "post-combat reward" },
        ],
        allowFreeText: false,
      });
    }
  } else if (hasGate && hasHealing && hasBridge && hasLoop) {
    summary = "I think this is a protected recovery pocket after traversal.";
    experientialGoals = ["protected recovery pocket", "threshold after traversal"];
    confidence = 0.82;
  } else if (hasBridge && hasAsset(sketch, utterance, "reward_chest") && hasBarricade) {
    summary = "I think this is an optional risky reward detour.";
    experientialGoals = ["optional detour", "risk before reward"];
    confidence = 0.8;
  }

  return {
    id: `ACH-${nanoid(6)}`,
    utteranceId: utterance.id,
    summary,
    confidence,
    assetRoles: assetRoles.map((role) => {
      const instance = sketch.assetInstances.find((asset) => asset.id === role.assetInstanceId);
      if (instance?.assetDefinitionId === "watchtower") return { ...role, proposedRole: "elevated landmark", confidence: 0.9 };
      if (instance?.assetDefinitionId === "barricade") return { ...role, proposedRole: "defensive cover", confidence: 0.86 };
      if (instance?.assetDefinitionId === "enemy_shrine") return { ...role, proposedRole: "encounter source", confidence: 0.88 };
      if (instance?.assetDefinitionId === "stone_stair") return { ...role, proposedRole: "approach connector", confidence: 0.82 };
      if (instance?.assetDefinitionId === "reward_chest") return { ...role, proposedRole: "optional reward", confidence: 0.78 };
      return role;
    }),
    spatialRelations: sketch.relations.filter((relation) => utterance.relationIds.includes(relation.id)).map((relation) => ({ sourceId: relation.sourceId, relation: relation.relationType, targetId: relation.targetId })),
    gameplayRelations: hasStair && hasTower && (hasRawArrow || sketch.relations.length > 0) ? [{ sourceId: firstAsset(sketch, "stone_stair") ?? "stair", relation: "approach_route", targetId: firstAsset(sketch, "watchtower") }] : [],
    experientialGoals,
    preservationSuggestions: hasTower ? [firstAsset(sketch, "watchtower") ?? "watchtower"] : [],
    missingNeeds: hasStair && hasTower ? [] : [{ type: "relation", reason: "The approach relation may need a connector or annotation." }],
    alternatives: [
      { id: "alt-encounter", summary: "Defended high-ground encounter", rationale: "Tower, barricade, shrine, and loop cluster together." },
      { id: "alt-landmark", summary: "Visual landmark cluster", rationale: "The connection could be scenic rather than traversal." },
    ],
    clarificationRecommended: clarificationRequests.length > 0 || confidence < 0.78,
    clarificationRequests,
    clarificationAnswers: [],
    conventionMatchedId: matchedConvention?.id,
    status: clarificationRequests.length > 0 ? "clarifying" : "candidate",
  };
}
