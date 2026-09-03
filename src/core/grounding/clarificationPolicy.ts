import type { CandidateIntentInterpretation, ClarificationRequest, IntentInterpretation } from "../intent/types";
import type { SketchState } from "../sketch/types";

export type ClarificationPolicyConfig = {
  lowConfidenceThreshold: number;
};

const defaultConfig: ClarificationPolicyConfig = { lowConfidenceThreshold: 0.55 };

function requestForLowConfidence(interpretation: IntentInterpretation): ClarificationRequest | null {
  if (interpretation.confidence >= defaultConfig.lowConfidenceThreshold) return null;
  return {
    id: `clarify-low-${interpretation.id}`,
    targetSketchIds: interpretation.sourceStrokeIds,
    reason: "low_confidence",
    question: "I am not confident about this meaning. Which interpretation should I use?",
    options: interpretation.alternatives.map((alternative) => ({ id: alternative.id, label: alternative.label, answerValue: alternative.semanticSummary })),
    allowFreeText: true,
  };
}

function requestForConflict(interpretation: IntentInterpretation): ClarificationRequest | null {
  if (!interpretation.conflict) return null;
  return {
    id: `clarify-conflict-${interpretation.id}`,
    targetSketchIds: interpretation.sourceStrokeIds,
    reason: "stroke_text_conflict",
    question: interpretation.conflict,
    options: [
      { id: "prefer-stroke", label: "Prefer stroke", answerValue: "prefer-stroke" },
      { id: "prefer-language", label: "Prefer language", answerValue: "prefer-language" },
      { id: "blend", label: "Blend", answerValue: "blend" },
    ],
    allowFreeText: true,
  };
}

function requestForAmbiguousSketch(sketch: SketchState | undefined): ClarificationRequest[] {
  if (!sketch) return [];
  const requests: ClarificationRequest[] = [];
  const regionMarks = sketch.marks.filter((mark) => mark.kind === "region" || mark.kind === "symbol");
  for (const mark of regionMarks) {
    requests.push({
      id: `clarify-region-${mark.id}`,
      targetSketchIds: [mark.id],
      reason: "semantic_ambiguity",
      question: "Does this region mean combat area, recovery area, landmark, or something else?",
      options: [
        { id: "combat-area", label: "Combat area", answerValue: "combat" },
        { id: "recovery-area", label: "Recovery area", answerValue: "relief" },
        { id: "landmark-region", label: "Landmark region", answerValue: "landmark" },
      ],
      allowFreeText: true,
    });
  }
  const arrowMarks = sketch.marks.filter((mark) => mark.kind === "arrow");
  for (const mark of arrowMarks) {
    requests.push({
      id: `clarify-arrow-${mark.id}`,
      targetSketchIds: [mark.id],
      reason: "high_impact",
      question: "Is this arrow player flow or a relationship between sketch objects?",
      options: [
        { id: "player-flow", label: "Player flow", answerValue: "flow" },
        { id: "object-relation", label: "Object relation", answerValue: "relation" },
      ],
      allowFreeText: true,
    });
  }
  return requests;
}

export function buildClarificationRequests(candidate: Omit<CandidateIntentInterpretation, "clarificationRequests">, sketch?: SketchState, config: ClarificationPolicyConfig = defaultConfig): ClarificationRequest[] {
  const requests = [
    ...candidate.interpretations.flatMap((interpretation) => [requestForConflict(interpretation), interpretation.confidence < config.lowConfidenceThreshold ? requestForLowConfidence(interpretation) : null]),
    ...requestForAmbiguousSketch(sketch),
  ].filter((request): request is ClarificationRequest => Boolean(request));
  const seen = new Set<string>();
  return requests.filter((request) => {
    if (seen.has(request.id)) return false;
    seen.add(request.id);
    return true;
  });
}
