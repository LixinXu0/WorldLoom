import type { ConstraintConflict, GameplayConstraint, LevelVariant, Point, Stroke } from "../types";
import type { AuthoringIntentFragment, SketchState } from "../sketch/types";

export type InterpretationMode = "rule-based" | "ai";
export type ResearchMode =
  | "c1-ai-opaque"
  | "c2-ai-negotiable"
  | "c3-ai-negotiable-conventions"
  | "legacy-rule-based"
  | "c1-rule-based"
  | "c2-ai-opaque"
  | "c3-ai-negotiable";

export type IntentEffectName =
  | "encounterIntensity"
  | "spatialOpenness"
  | "visibility"
  | "resourceDensity"
  | "recovery"
  | "branching";

export type IntentEffects = Partial<Record<IntentEffectName, number>>;

export type RegionRef = { x: number; y: number; radius: number };

export type FlowIntent = {
  id: string;
  kind: "flow";
  sourceStrokeIds: string[];
  trajectory: Point[];
  width: number;
  priority: number;
};

export type BranchIntent = {
  id: string;
  kind: "branch";
  sourceStrokeIds: string[];
  trajectory: Point[];
  optionality: number;
  reconnectPreference?: number;
  shortcutBias?: number;
  risk?: number;
};

export type ExperienceIntent = {
  id: string;
  kind: "experience";
  sourceStrokeIds: string[];
  semanticLabel: "pressure" | "relief";
  spatialScope: Point[] | RegionRef;
  intensity: number;
  effects: IntentEffects;
};

export type AuthoringIntent = FlowIntent | BranchIntent | ExperienceIntent;

export type AuthoringIR = {
  id: string;
  intents: AuthoringIntent[];
};

export type InterpretationAlternative = {
  id: string;
  label: string;
  semanticSummary: string;
  effects: IntentEffects;
};

export type IntentInterpretation = {
  id: string;
  sourceStrokeIds: string[];
  semanticSummary: string;
  confidence: number;
  effects: IntentEffects;
  alternatives: InterpretationAlternative[];
  conflict?: string;
};

export type LevelContext = {
  activeVariantId?: string | null;
  workingVariantId?: string | null;
  variants?: LevelVariant[];
};

export type InterpretationMetadata = {
  interpreterMode: InterpretationMode;
  interpreterVersion: string;
  createdAt: number;
  sourceStrokeIds: string[];
  textInstruction?: string;
  confidence?: number;
  rationale?: string;
  selectedAlternativeId?: string;
  manuallyAdjusted: boolean;
};

export type IntentInterpretationInput = {
  strokes: Stroke[];
  sketchState?: SketchState;
  textInstruction?: string;
  currentLevelContext?: LevelContext;
  existingIntent?: AuthoringIR;
};

export type ClarificationOption = {
  id: string;
  label: string;
  answerValue: string;
};

export type ClarificationRequest = {
  id: string;
  targetSketchIds: string[];
  reason: "semantic_ambiguity" | "stroke_text_conflict" | "high_impact" | "possible_convention" | "low_confidence";
  question: string;
  options?: ClarificationOption[];
  allowFreeText: boolean;
};

export type ClarificationAnswer = {
  requestId: string;
  optionId?: string;
  freeText?: string;
  answeredAt: number;
};

export type ConventionProposal = {
  sketchIds: string[];
  inferredMeaning: AuthoringIntentFragment;
  matchedConventionId?: string;
  proposalType: "new_convention" | "reuse_existing" | "possible_revision";
  humanReadableLabel: string;
};

export type CandidateIntentInterpretation = IntentInterpretationResult & {
  id: string;
  status: "candidate" | "clarifying" | "accepted" | "rejected" | "committed";
  clarificationRequests: ClarificationRequest[];
  clarificationAnswers: ClarificationAnswer[];
  candidateConvention?: ConventionProposal;
};

export type CommittedAuthoringIR = {
  id: string;
  sourceCandidateId: string;
  committedAt: number;
  authoringIntent: AuthoringIR;
};

export type IntentInterpretationResult = {
  mode: InterpretationMode;
  interpretations: IntentInterpretation[];
  authoringIntent: AuthoringIR;
  derivedConstraints: GameplayConstraint[];
  conflicts: ConstraintConflict[];
  clarificationRequests?: ClarificationRequest[];
  candidateConvention?: ConventionProposal;
  metadata: InterpretationMetadata;
};

export interface IntentInterpreter {
  id: string;
  name: string;
  interpret(input: IntentInterpretationInput): Promise<IntentInterpretationResult>;
}
