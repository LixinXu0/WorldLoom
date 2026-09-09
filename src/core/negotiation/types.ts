import type {
  GameplayGraph,
  GameplayNode,
  GameplayRelation,
  GameplayRoute,
} from "../gameplay/types";

import type {
  GameplayInterpretationChoice,
  GameplayInterpretationDimension,
  GameplayNegotiationState,
  SharedGameplayCandidate,
  SharedProvenance,
  SharedStateStatus,
} from "../shared-state/types";

export type MandatorynessValue =
  | "optional"
  | "mandatory";

export type RewardFunctionValue =
  | "bonus"
  | "progression_critical"
  | "post_combat"
  | "none";

export type RouteFunctionValue =
  | "detour"
  | "shortcut"
  | "main_progression"
  | "return_path"
  | "gated_route";

export type EncounterFunctionValue =
  | "obstacle"
  | "climax"
  | "optional_challenge"
  | "mandatory_challenge"
  | "none";

export type ProgressionRoleValue =
  | "optional_support"
  | "mandatory_progression"
  | "gate_requirement"
  | "reconnect"
  | "none";

export type GameplayDimensionValueMap = {
  mandatoryness:
    MandatorynessValue;

  reward_function:
    RewardFunctionValue;

  route_function:
    RouteFunctionValue;

  encounter_function:
    EncounterFunctionValue;

  progression_role:
    ProgressionRoleValue;
};

export type TypedGameplayInterpretationChoice<
  TDimension extends
    GameplayInterpretationDimension =
      GameplayInterpretationDimension,
> = Omit<
  GameplayInterpretationChoice,
  "dimension" | "value"
> & {
  dimension: TDimension;

  value:
    GameplayDimensionValueMap[
      TDimension
    ];
};

export type GameplayNegotiationContext = {
  sourceSceneElementIds: string[];
  sourceSketchIds: string[];
  sourceGameplayNodeIds: string[];

  userInstruction?: string;
  worldSetting?: string;

  currentGraph: GameplayGraph;
};

export type GameplayCandidateDraft = {
  label: string;
  summary: string;
  rationale: string;
  confidence: number;

  choices:
    GameplayInterpretationChoice[];

  proposedNodes:
    GameplayNode[];

  proposedRelations:
    GameplayRelation[];

  proposedRoutes:
    GameplayRoute[];
};

export type CreateGameplayCandidateInput =
  GameplayCandidateDraft & {
    id?: string;

    context:
      GameplayNegotiationContext;

    provenance?:
      Partial<SharedProvenance>;
  };

export type GameplayCandidatePatch =
  Partial<
    Pick<
      SharedGameplayCandidate,
      | "label"
      | "summary"
      | "rationale"
      | "confidence"
      | "choices"
      | "proposedNodes"
      | "proposedRelations"
      | "proposedRoutes"
    >
  >;

export type GameplayCandidateSelection = {
  candidateId: string;
  selectedAt: number;

  selectedBy:
    | "user"
    | "ai";
};

export type GameplayCandidateCommitment = {
  candidateId: string;
  committedAt: number;

  committedBy:
    | "user"
    | "system";

  resultingGraph:
    GameplayGraph;
};

export type GameplayNegotiationSessionStatus =
  | "idle"
  | "candidates_ready"
  | "candidate_selected"
  | "committed"
  | "cancelled";

export type GameplayNegotiationSession = {
  id: string;

  status:
    GameplayNegotiationSessionStatus;

  context:
    GameplayNegotiationContext;

  state:
    GameplayNegotiationState;

  selection:
    GameplayCandidateSelection | null;

  commitment:
    GameplayCandidateCommitment | null;

  createdAt: number;
  updatedAt: number;
};

export type GameplayCandidateResult = {
  candidates:
    SharedGameplayCandidate[];

  generatedAt: number;

  source:
    | "ai"
    | "rule_based"
    | "mixed";
};

export type GameplayCandidateDecision = {
  candidateId: string;

  status: Extract<
    SharedStateStatus,
    "committed" | "rejected"
  >;

  decidedAt: number;
  note?: string;
};

export type {
  GameplayInterpretationChoice,
  GameplayInterpretationDimension,
  GameplayNegotiationState,
  SharedGameplayCandidate,
};