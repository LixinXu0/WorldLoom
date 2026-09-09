export type GameplayNodeType =
  | "start"
  | "goal"
  | "encounter"
  | "objective"
  | "reward"
  | "gate"
  | "trigger"
  | "checkpoint"
  | "branch"
  | "boss";

export type GameplayRelationType =
  | "leads_to"
  | "requires"
  | "unlocks"
  | "triggers"
  | "rewards"
  | "blocks"
  | "reconnects";

export type GameplayRouteType =
  | "main_route"
  | "optional_route"
  | "shortcut"
  | "return_path"
  | "gated_route";

export type GameplayRequirement = "optional" | "mandatory";

export type GameplayPoint = {
  x: number;
  y: number;
};

export type GameplayNode = {
  id: string;
  type: GameplayNodeType;
  label: string;
  description?: string;
  position: GameplayPoint;
  requirement: GameplayRequirement;
  sourceObjectIds: string[];
  sourceAssetIds: string[];
};

export type GameplayRelation = {
  id: string;
  type: GameplayRelationType;
  sourceNodeId: string;
  targetNodeId: string;
  requirement: GameplayRequirement;
  description?: string;
};

export type GameplayRoute = {
  id: string;
  type: GameplayRouteType;
  sourceNodeId: string;
  targetNodeId: string;
  requirement: GameplayRequirement;
  controlPointIds: string[];
  sourceStrokeIds: string[];
  description?: string;
};

export type GameplayGraph = {
  schemaVersion: "1.0";
  nodes: GameplayNode[];
  relations: GameplayRelation[];
  routes: GameplayRoute[];
};

export function createEmptyGameplayGraph(): GameplayGraph {
  return {
    schemaVersion: "1.0",
    nodes: [],
    relations: [],
    routes: [],
  };
}
