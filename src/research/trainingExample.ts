import type { AuthoringIR, IntentInterpretationResult } from "../core/intent/types";
import type { LevelVariant, Stroke, WorldloomProject } from "../core/types";

export type TrainingExample = {
  sketchState: WorldloomProject["sketchState"];
  annotation: string;
  candidateInterpretation: WorldloomProject["candidateIntent"];
  clarification: { question: string; answer: string } | null;
  committedIntent: WorldloomProject["committedIntent"];
  conventionContext: WorldloomProject["conventions"];
  generatedLevel: LevelVariant | null;
  repairHistory: WorldloomProject["repairHistory"];
  compositionHypothesis: WorldloomProject["compositionHypothesis"];
  committedCompositionIntent: WorldloomProject["committedCompositionIntent"];
  assetEditPlan: WorldloomProject["assetEditPlan"];
  appliedAssetEditPlans: WorldloomProject["appliedAssetEditPlans"];
  sceneState: Pick<WorldloomProject, "seed" | "metadata">;
  strokes: Stroke[];
  textInstruction: string;
  ruleBasedInterpretation: IntentInterpretationResult | null;
  aiInterpretation: IntentInterpretationResult | null;
  humanSelectedInterpretation: IntentInterpretationResult | null;
  humanCorrections: unknown[];
  finalAuthoringIR: AuthoringIR | null;
  finalAcceptedVariant: LevelVariant | null;
};

export function buildTrainingExample(project: WorldloomProject, ruleBasedInterpretation: IntentInterpretationResult | null, aiInterpretation: IntentInterpretationResult | null): TrainingExample {
  const clarification = project.candidateIntent?.clarificationRequests[0];
  const answer = project.candidateIntent?.clarificationAnswers.find((item) => item.requestId === clarification?.id);
  return {
    sketchState: project.sketchState,
    annotation: project.textInstruction,
    candidateInterpretation: project.candidateIntent,
    clarification: clarification ? { question: clarification.question, answer: answer?.freeText ?? answer?.optionId ?? "" } : null,
    committedIntent: project.committedIntent,
    conventionContext: project.conventions,
    generatedLevel: project.variants.find((variant) => variant.id === project.workingVariantId) ?? null,
    repairHistory: project.repairHistory,
    compositionHypothesis: project.compositionHypothesis,
    committedCompositionIntent: project.committedCompositionIntent,
    assetEditPlan: project.assetEditPlan,
    appliedAssetEditPlans: project.appliedAssetEditPlans,
    sceneState: { seed: project.seed, metadata: project.metadata },
    strokes: project.strokes,
    textInstruction: project.textInstruction,
    ruleBasedInterpretation,
    aiInterpretation,
    humanSelectedInterpretation: project.lastInterpretationResult,
    humanCorrections: project.editHistory,
    finalAuthoringIR: project.authoringIntent,
    finalAcceptedVariant: project.variants.find((variant) => variant.id === project.workingVariantId) ?? null,
  };
}
