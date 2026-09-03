import { nanoid } from "nanoid";
import type { AuthoringIR, CandidateIntentInterpretation, ClarificationAnswer, CommittedAuthoringIR, IntentInterpretationResult } from "../intent/types";
import type { SketchState } from "../sketch/types";
import { buildClarificationRequests } from "./clarificationPolicy";

export function createCandidateIntent(result: IntentInterpretationResult, sketch?: SketchState): CandidateIntentInterpretation {
  const base = {
    ...result,
    id: `CI-${nanoid(6)}`,
    status: "candidate" as const,
    clarificationRequests: [] as CandidateIntentInterpretation["clarificationRequests"],
    clarificationAnswers: [] as ClarificationAnswer[],
  };
  const clarificationRequests = result.clarificationRequests ?? buildClarificationRequests(base, sketch);
  return { ...base, clarificationRequests, status: clarificationRequests.length > 0 ? "clarifying" : "candidate" };
}

export function answerClarification(candidate: CandidateIntentInterpretation, answer: ClarificationAnswer): CandidateIntentInterpretation {
  return { ...candidate, clarificationAnswers: [...candidate.clarificationAnswers, answer], status: "candidate" };
}

export function commitCandidateIntent(candidate: CandidateIntentInterpretation, authoringIntent: AuthoringIR = candidate.authoringIntent): CommittedAuthoringIR {
  return { id: `COM-${nanoid(6)}`, sourceCandidateId: candidate.id, committedAt: Date.now(), authoringIntent };
}
