import type {
  GameplayGraph,
  GameplayNode,
  GameplayRelation,
  GameplayRoute,
} from "../gameplay/types";

import type {
  ExperienceDimension,
  SceneElementType,
  SharedBounds,
  SharedPoint,
  SharedSpatialConstraint,
  SharedTransform,
  SpatialConstraintMode,
  SpatialConstraintProperty,
  SpatialConstraintValue,
  SpatialTolerance,
} from "../shared-state/types";

export type GenerationContractStatus =
  | "draft"
  | "ready"
  | "generated"
  | "invalid";

export type GenerationContractSource = {
  projectId?: string;
  sharedStateRevision: number;
  compiledAt: number;
};

export type ContractCanvas = {
  width: number;
  height: number;
};

export type ContractSceneElement = {
  id: string;
  type: SceneElementType;
  name: string;
  description?: string;
  assetDefinitionId?: string;
  sourceRef?: string;
  transform?: SharedTransform;
  bounds?: SharedBounds;
  semanticRoles: string[];
  preserve: boolean;
};

export type SceneGenerationContract = {
  worldSetting: string;
  canvas: ContractCanvas;
  backgroundElementId?: string;
  elements: ContractSceneElement[];
};

export type ContractConstraintBase = {
  id: string;
  targetElementId: string;
  property: SpatialConstraintProperty;
  value?: SpatialConstraintValue;
  unit?: string;
  preserveOnRegeneration: boolean;
  sourceConstraintId: string;
};

export type ExactContractConstraint =
  ContractConstraintBase & {
    mode: "exact";
  };

export type ApproximateContractConstraint =
  ContractConstraintBase & {
    mode: "approximate";
    tolerance: number | SpatialTolerance;
  };

export type FreeContractConstraint =
  ContractConstraintBase & {
    mode: "free";
    generativeFreedom: number;
  };

export type ContractSpatialConstraint =
  | ExactContractConstraint
  | ApproximateContractConstraint
  | FreeContractConstraint;

export type SpatialGenerationContract = {
  exact: ExactContractConstraint[];
  approximate: ApproximateContractConstraint[];
  free: FreeContractConstraint[];
};

export type ContractGameplayNode =
  GameplayNode & {
    preserve: boolean;
  };

export type ContractGameplayRelation =
  GameplayRelation & {
    preserve: boolean;
  };

export type ContractGameplayRoute =
  GameplayRoute & {
    preserve: boolean;
    controlPoints?: SharedPoint[];
  };

export type ContractExperienceGoal = {
  id: string;
  dimension: ExperienceDimension;
  description: string;
  intensity?: number;
  weight: number;
  order?: number;
  region?: SharedBounds;
  targetGameplayNodeIds: string[];
  required: boolean;
};

export type GameplayGenerationContract = {
  graphSchemaVersion:
    GameplayGraph["schemaVersion"];

  nodes: ContractGameplayNode[];
  relations: ContractGameplayRelation[];
  routes: ContractGameplayRoute[];

  experienceGoals:
    ContractExperienceGoal[];

  requireReachableGoal: boolean;

  requireReachableMandatoryNodes:
    boolean;

  allowDeadlocks: boolean;
};

export type RegenerationScope = {
  mode: "full" | "local";

  targetElementIds: string[];

  targetGameplayNodeIds: string[];

  lockedElementIds: string[];

  lockedGameplayNodeIds: string[];
};

export type GenerationContractIssue = {
  id: string;

  severity:
    | "warning"
    | "error";

  layer:
    | "scene"
    | "spatial"
    | "gameplay";

  message: string;
  entityIds: string[];
};

export type PlayableGenerationContract = {
  schemaVersion: "1.0";

  id: string;
  status: GenerationContractStatus;

  source: GenerationContractSource;

  seed: number;

  scene: SceneGenerationContract;

  spatial: SpatialGenerationContract;

  gameplay: GameplayGenerationContract;

  regeneration: RegenerationScope;

  issues: GenerationContractIssue[];
};

export function isExactContractConstraint(
  constraint: ContractSpatialConstraint,
): constraint is ExactContractConstraint {
  return constraint.mode === "exact";
}

export function isApproximateContractConstraint(
  constraint: ContractSpatialConstraint,
): constraint is ApproximateContractConstraint {
  return constraint.mode === "approximate";
}

export function isFreeContractConstraint(
  constraint: ContractSpatialConstraint,
): constraint is FreeContractConstraint {
  return constraint.mode === "free";
}

export function getContractConstraintMode(
  constraint: SharedSpatialConstraint,
): SpatialConstraintMode {
  return constraint.mode;
}