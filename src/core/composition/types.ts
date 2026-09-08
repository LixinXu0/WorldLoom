import type { ClarificationAnswer, ClarificationRequest } from "../intent/types";
import type { Point } from "../types";
import type { AssetAwareVisualUtterance, Bounds } from "../sketch/types";

export type AssetCompositionAlternative = {
  id: string;
  summary: string;
  rationale: string;
  name?: string;
  description?: string;
  semanticType?: string;
  confidence?: number;
  dimensions?: Record<string, number>;
};

export type AssetCompositionHypothesis = {
  id: string;
  utteranceId: string;
  summary: string;
  confidence: number;
  assetRoles: {
    assetInstanceId: string;
    proposedRole: string;
    confidence: number;
  }[];
  spatialRelations: {
    sourceId: string;
    relation: string;
    targetId: string;
  }[];
  gameplayRelations: {
    sourceId: string;
    relation: string;
    targetId?: string;
  }[];
  experientialGoals: string[];
  preservationSuggestions: string[];
  missingNeeds: {
    type: string;
    reason: string;
  }[];
  alternatives: AssetCompositionAlternative[];
  clarificationRecommended: boolean;
  clarificationRequests: ClarificationRequest[];
  clarificationAnswers: ClarificationAnswer[];
  conventionMatchedId?: string;
  status: "candidate" | "clarifying" | "committed";
};

export type CompositionRelation = {
  sourceId: string;
  relation: string;
  targetId?: string;
};

export type PreservationRule = {
  assetInstanceId: string;
  preserve: boolean;
  lockPosition?: boolean;
  doNotDuplicate?: boolean;
  doNotReplace?: boolean;
};

export type MissingNeed = {
  type: string;
  reason: string;
};

export type CompositionIntent = {
  id: string;
  assetInstanceIds: string[];
  assignedRoles: Record<string, string>;
  spatialRelations: CompositionRelation[];
  gameplayRelations: CompositionRelation[];
  experientialGoals: string[];
  preservationRules: PreservationRule[];
  missingNeeds: MissingNeed[];
  editScope: string;
  provenance: {
    utteranceId: string;
    interpretationId: string;
    annotationIds: string[];
  };
  committedAt: number;
};

export type AssetEditOperation =
  | { id: string; type: "place"; assetId: string; position: Point }
  | { id: string; type: "move"; assetId: string; position: Point; reason: string }
  | { id: string; type: "rotate"; assetId: string; rotation: number; reason: string }
  | { id: string; type: "connect"; sourceId: string; targetId: string; relation: string }
  | { id: string; type: "group"; assetIds: string[]; groupId: string; label: string }
  | { id: string; type: "assignRole"; assetId: string; role: string }
  | { id: string; type: "bind"; sourceId: string; targetId: string; binding: string }
  | { id: string; type: "preserve"; assetId: string; lockPosition?: boolean; doNotDuplicate?: boolean; doNotReplace?: boolean }
  | { id: string; type: "duplicate"; sourceAssetId: string; newAssetId: string; position: Point }
  | { id: string; type: "replace"; assetId: string; replacementAssetDefinitionId: string }
  | { id: string; type: "remove"; assetId: string };

export type AssetEditPlan = {
  id: string;
  sourceCompositionIntentId: string;
  operations: AssetEditOperation[];
  previewSummary: string[];
  status: "preview" | "applied" | "rejected";
  createdAt: number;
  appliedAt?: number;
};

export type AssetAwareSceneState = {
  utterance: AssetAwareVisualUtterance;
  bounds: Bounds;
};
