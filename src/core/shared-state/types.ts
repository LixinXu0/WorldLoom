import type {
  GameplayGraph,
  GameplayNode,
  GameplayRelation,
  GameplayRoute,
} from "../gameplay/types";

export type SharedStateStatus =
  | "candidate"
  | "committed"
  | "rejected"
  | "superseded";

export type SharedStateSource =
  | "user"
  | "ai"
  | "mixed"
  | "imported"
  | "system";

export type SharedPoint = {
  x: number;
  y: number;
};

export type SharedBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SharedTransform = {
  position: SharedPoint;
  rotation: number;
  scale: number;
};

export type SharedProvenance = {
  source: SharedStateSource;
  sourceIds: string[];
  explanation?: string;
  model?: string;
  createdAt?: number;
  updatedAt: number;
};

export type SceneElementType =
  | "asset"
  | "doodle"
  | "placeholder"
  | "terrain"
  | "geometry";

export type SharedSceneElement = {
  id: string;
  type: SceneElementType;
  name: string;
  description?: string;

  assetDefinitionId?: string;
  sourceRef?: string;

  transform?: SharedTransform;
  bounds?: SharedBounds;

  semanticRoles: string[];
  preserved: boolean;
  status: SharedStateStatus;
  provenance: SharedProvenance;
};

export type SceneLayer = {
  worldSetting: string;
  elements: SharedSceneElement[];
  backgroundElementId?: string;
};

export type SpatialConstraintMode =
  | "exact"
  | "approximate"
  | "free";

export type SpatialConstraintProperty =
  | "identity"
  | "position"
  | "rotation"
  | "scale"
  | "footprint"
  | "width"
  | "depth"
  | "height"
  | "geometry"
  | "material"
  | "transform"
  | "spatial_relation";

export type SpatialConstraintValue =
  | string
  | number
  | boolean
  | SharedPoint
  | SharedBounds
  | number[]
  | string[]
  | Record<string, unknown>;

export type SpatialToleranceKind =
  | "absolute"
  | "range"
  | "radius"
  | "region"
  | "angular";

export type SpatialTolerance = {
  kind: SpatialToleranceKind;
  value?: number;
  minimum?: number;
  maximum?: number;
  region?: SharedBounds;
  unit?: string;
};

export type SharedSpatialConstraint = {
  id: string;
  targetElementId: string;
  property: SpatialConstraintProperty;
  mode: SpatialConstraintMode;
  value?: SpatialConstraintValue;
  tolerance?: number | SpatialTolerance;
  unit?: string;

  /**
   * 0 表示完全锁定，1 表示完全由 AI 决定。
   */
  generativeFreedom?: number;

  preserveOnRegeneration?: boolean;
  enabled: boolean;
  status: SharedStateStatus;
  provenance: SharedProvenance;
};

export type SpatialConstraintObservation = {
  constraintId: string;
  expected?: SpatialConstraintValue;
  observed?: SpatialConstraintValue;
  distance?: number;
  passed: boolean;
  explanation?: string;
};

export type SpatialLayer = {
  constraints: SharedSpatialConstraint[];

  /**
   * 最近一次生成后的约束检查结果。
   */
  lastObservations?:
    SpatialConstraintObservation[];
};

export type GameplayInterpretationDimension =
  | "mandatoryness"
  | "reward_function"
  | "route_function"
  | "encounter_function"
  | "progression_role";

export type GameplayInterpretationChoice = {
  dimension:
    GameplayInterpretationDimension;

  value: string;
  explanation?: string;
};

export type SharedGameplayCandidate = {
  id: string;
  label: string;
  summary: string;
  rationale: string;
  confidence: number;

  sourceSceneElementIds: string[];
  sourceSketchIds: string[];

  choices:
    GameplayInterpretationChoice[];

  proposedNodes: GameplayNode[];
  proposedRelations:
    GameplayRelation[];
  proposedRoutes: GameplayRoute[];

  status: SharedStateStatus;
  provenance: SharedProvenance;
};

export type GameplayConflictType =
  | "missing_start"
  | "missing_goal"
  | "unreachable_goal"
  | "unreachable_mandatory_node"
  | "dangling_reference"
  | "cyclic_dependency"
  | "gate_objective_deadlock"
  | "false_optionality"
  | "mandatory_node_bypass"
  | "unreachable_reward";

export type GameplayValidationConflict = {
  id: string;
  type: GameplayConflictType;

  severity:
    | "info"
    | "warning"
    | "error";

  message: string;

  nodeIds: string[];
  relationIds: string[];
  routeIds: string[];

  suggestedRepairIds: string[];
};

export type GameplayValidationResult = {
  id: string;
  valid: boolean;
  validatorVersion: string;
  checkedAt: number;

  reachableNodeIds: string[];
  mandatoryNodeIds: string[];

  conflicts:
    GameplayValidationConflict[];
};

export type GameplayRepairOperationType =
  | "add_node"
  | "update_node"
  | "remove_node"
  | "add_relation"
  | "update_relation"
  | "remove_relation"
  | "add_route"
  | "update_route"
  | "remove_route";

export type GameplayRepairOperation = {
  id: string;
  type: GameplayRepairOperationType;
  entityId: string;

  before?: unknown;
  after?: unknown;
};

export type GameplayRepairProposal = {
  id: string;
  conflictId: string;
  label: string;
  description: string;

  operations:
    GameplayRepairOperation[];

  status:
    | "proposed"
    | "applied"
    | "rejected";

  createdAt: number;
  appliedAt?: number;

  provenance: SharedProvenance;
};

export type GameplayNegotiationState = {
  candidates:
    SharedGameplayCandidate[];

  selectedCandidateId:
    string | null;

  committedCandidateIds:
    string[];
};

export type GameplayLayer = {
  graph: GameplayGraph;

  /**
   * 暂时设为可选，兼容此前已经保存的共享状态。
   */
  negotiation?:
    GameplayNegotiationState;

  validation?:
    GameplayValidationResult | null;

  repairs?:
    GameplayRepairProposal[];
};

export type ExperienceDimension =
  | "orientation"
  | "pacing"
  | "pressure"
  | "relief"
  | "tension"
  | "challenge"
  | "exploration"
  | "choice"
  | "climax";

export type SharedExperienceGoal = {
  id: string;
  dimension: ExperienceDimension;
  description: string;

  intensity?: number;
  weight?: number;
  order?: number;

  region?: SharedBounds;

  targetGameplayNodeIds:
    string[];

  required?: boolean;
  status: SharedStateStatus;
  provenance: SharedProvenance;
};

export type ExperienceLayer = {
  goals: SharedExperienceGoal[];
  summary: string;
};

export type SharedLevelDesignState = {
  schemaVersion:
    | "1.0"
    | "1.1";

  revision: number;

  scene: SceneLayer;
  spatial: SpatialLayer;
  gameplay: GameplayLayer;
  experience: ExperienceLayer;

  updatedAt: number;
};