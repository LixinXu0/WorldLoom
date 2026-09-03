import type { AuthoringIntentFragment } from "../sketch/types";
import type { SketchPatternSignature } from "../sketch/types";

export type ConventionScope = "session" | "project" | "personal";

export type ConventionEntry = {
  id: string;
  patternSignature: SketchPatternSignature;
  semanticMeaning: AuthoringIntentFragment;
  humanReadableLabel: string;
  exampleSketchIds: string[];
  scope: ConventionScope;
  confidence: number;
  confirmations: number;
  corrections: number;
  createdAt: number;
  updatedAt: number;
  enabled: boolean;
};
