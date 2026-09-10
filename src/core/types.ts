import type { AuthoringIR, CandidateIntentInterpretation, CommittedAuthoringIR, InterpretationMode, IntentInterpretationResult, ResearchMode } from "./intent/types";
import type { ConventionEntry } from "./conventions/types";
import type { AssetCompositionHypothesis, AssetEditPlan, CompositionIntent } from "./composition/types";
import type { SketchSelection, SketchState } from "./sketch/types";
import type { GameplayGraph } from "./gameplay/types";
import type { SharedLevelDesignState } from "./shared-state/types";
import type { PlayableGenerationContract } from "./contract/types";

export type Point = { x: number; y: number; pressure?: number; time: number };
export type StrokeType = "flow" | "pressure" | "relief" | "branch";
export type Stroke = {
  id: string;
  type: StrokeType;
  points: Point[];
  width: number;
  intensity: number;
  enabled: boolean;
  createdAt: number;
};
export type FieldCell = {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  pressure: number;
  relief: number;
  branchPotential: number;
};
export type ConstraintTarget =
  | "main_path"
  | "encounter_intensity"
  | "spatial_openness"
  | "resource_density"
  | "visibility"
  | "branching"
  | "recovery";
export type GameplayConstraint = {
  id: string;
  sourceStrokeIds: string[];
  sourceInterpretationIds?: string[];
  target: ConstraintTarget;
  region: { x: number; y: number; radius: number };
  preferredValue: number;
  weight: number;
  hard: boolean;
  enabled: boolean;
  explanation: string;
  userAdjusted?: boolean;
};
export type ConstraintConflict = {
  id: string;
  type:
    | "pressure_relief_overlap"
    | "opposed_intensity"
    | "branch_far_from_flow"
    | "disconnected_flow"
    | "entry_relief_only"
    | "anchor_pressure";
  constraintIds: string[];
  strokeIds: string[];
  severity: "info" | "warning" | "error";
  message: string;
  suggestedResolutions: string[];
};
export type RoomRole =
  | "entrance"
  | "transition"
  | "combat"
  | "reward"
  | "relief"
  | "junction"
  | "exit";
export type RoomNode = {
  id: string;
  role: RoomRole;
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
  sourceStrokeIds: string[];
  sourceConstraintIds: string[];
  manual?: boolean;
  locked?: boolean;
  resourceLevel?: number;
  encounterLevel?: number;
};
export type RouteEdge = {
  id: string;
  from: string;
  to: string;
  role: "main" | "optional" | "return";
  risk: number;
  sourceStrokeIds: string[];
  sourceConstraintIds: string[];
};
export type ValidationResult = {
  reachable: boolean;
  entranceExitConnected: boolean;
  optionalBranchCount: number;
  deadEnds: string[];
  criticalPathLength: number;
  errors: string[];
  warnings: string[];
};
export type IntentFitBreakdown = {
  flow: number;
  pressure: number;
  relief: number;
  branch: number;
  total: number;
};
export type LevelVariant = {
  id: string;
  name: string;
  strategy: "spatial" | "combat" | "resource";
  seed: number;
  rooms: RoomNode[];
  edges: RouteEdge[];
  validation: ValidationResult;
  intentFit: number;
  intentFitBreakdown: IntentFitBreakdown;
  modified?: boolean;
  revisionCount?: number;
};
export type EditScope = "instance" | "variant-rule" | "source-intent" | "all-variants";
export type EditableRoomProperty = "position" | "size" | "role" | "intensity" | "locked" | "resourceLevel" | "encounterLevel";
export type RoomSnapshot = {
  roomId: string;
  variantId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  role: RoomRole;
  intensity: number;
  resourceLevel?: number;
  encounterLevel?: number;
  locked?: boolean;
};
export type ProposedChange = {
  entityType: "room" | "edge" | "constraint" | "stroke-interpretation" | "variant-rule" | "global-preference";
  entityId: string;
  property: string;
  before: unknown;
  after: unknown;
};
export type EditInterpretation = {
  id: string;
  label: string;
  description: string;
  confidence: number;
  target: "room-instance" | "variant-override" | "constraint" | "global-preference";
  proposedChanges: ProposedChange[];
  recommendedScope: EditScope;
};
export type RoomEdit = {
  id: string;
  roomId: string;
  variantId: string;
  property: EditableRoomProperty;
  before: RoomSnapshot;
  after: RoomSnapshot;
  scope: EditScope | null;
  inferredMeaning: EditInterpretation[];
  selectedInterpretationId: string | null;
  status: "draft" | "previewing" | "applied" | "reverted";
  createdAt: number;
};
export type RuleAdjustment = {
  property: "roomWidth" | "roomHeight" | "roomSpacing" | "encounterIntensity" | "resourceDensity" | "openness" | "branchLength";
  operation: "set" | "increase" | "decrease" | "scale";
  value: number;
};
export type ManualOverride = {
  id: string;
  variantId: string;
  roomId?: string;
  edgeId?: string;
  locked: boolean;
  properties: Partial<RoomNode>;
  sourceEditId: string;
};
export type VariantRuleOverride = {
  id: string;
  variantId: string;
  strategy: LevelVariant["strategy"];
  sourceConstraintIds: string[];
  region?: { x: number; y: number; radius: number };
  adjustments: RuleAdjustment[];
  sourceEditId: string;
};
export type GlobalDesignPreference = {
  id: string;
  targetRoomRole?: RoomRole;
  sourceConstraintTarget?: ConstraintTarget;
  adjustment: RuleAdjustment;
  enabled: boolean;
  sourceEditId: string;
};
export type StrokeInterpretationOverride = {
  id: string;
  strokeId: string;
  disabledConstraintTargets: ConstraintTarget[];
  weightOverrides: Partial<Record<ConstraintTarget, number>>;
  preferredValueOverrides: Partial<Record<ConstraintTarget, number>>;
  note: string;
  sourceEditId: string;
};
export type ImpactPreview = {
  editId: string;
  affectedVariantIds: string[];
  affectedRoomIds: string[];
  affectedEdgeIds: string[];
  affectedConstraintIds: string[];
  willRegenerate: boolean;
  estimatedIntentFitDelta: number;
  validationRisks: string[];
  summary: string;
};
export type ProjectSnapshot = Omit<WorldloomProject, "revisions"> & { revisions: [] };
export type DesignRevision = {
  id: string;
  parentRevisionId: string | null;
  label: string;
  timestamp: number;
  sourceEditIds: string[];
  projectSnapshot: ProjectSnapshot;
  activeVariantId: string | null;
  scope?: EditScope;
  affectedObjectCount: number;
  intentFitBefore?: number;
  intentFitAfter?: number;
  validationBefore?: boolean;
  validationAfter?: boolean;
};
export type PlaytestEvent = {
  id: string;
  sessionId: string;
  variantId: string;
  type: "session-start" | "room-enter" | "room-exit" | "branch-enter" | "branch-skip" | "backtrack" | "pause" | "feedback" | "session-complete";
  roomId?: string;
  edgeId?: string;
  timestamp: number;
  elapsedMs: number;
  pressureAtEvent?: number;
  reliefAtEvent?: number;
};
export type ExperienceFeedback = {
  id: string;
  sessionId: string;
  variantId: string;
  roomId: string | null;
  edgeId: string | null;
  category: "too-intense" | "too-calm" | "too-long" | "too-short" | "confusing" | "too-linear" | "weak-branch" | "good";
  note?: string;
  timestamp: number;
};
export type PlaytestSession = {
  id: string;
  variantId: string;
  startedAt: number;
  completedAt: number | null;
  currentRoomId: string | null;
  visitedRoomIds: string[];
};
export type TimelinePoint = {
  id: string;
  label: string;
  pressure: number;
  relief: number;
  role?: RoomRole;
  feedbackCategories?: ExperienceFeedback["category"][];
};
export type GameplaySemanticType = "player_spawn" | "enemy_stronghold" | "npc" | "npc_patrol_route";
export type GameplaySemanticPoint = { x: number; y: number };
export type GameplaySemanticElement = {
  id: string;
  type: GameplaySemanticType;
  name: string;
  description: string;
  sourceDoodleId: string;
  position: GameplaySemanticPoint;
  region: { width: number; height: number };
  startPoint?: GameplaySemanticPoint;
  endPoint?: GameplaySemanticPoint;
  direction?: "forward" | "reverse";
  waypoints?: GameplaySemanticPoint[];
};
export type GameplaySemanticLayer = {
  elements: GameplaySemanticElement[];
  locked: boolean;
};
export type BaseMapPoint = { x: number; y: number };
export type SurfaceMaterialId = "grass" | "dirt" | "stone" | "sand" | "water";
export type SurfaceData = {
  id: string;
  geometry: "stroke" | "fill";
  operation: "paint" | "erase";
  points: BaseMapPoint[];
  materialId: SurfaceMaterialId;
  textureReference: string;
  brushSize: number;
  materialScale: number;
};
export type AccessibilityZone = {
  id: string;
  geometry: "stroke" | "polygon";
  points: BaseMapPoint[];
  state: "walkable" | "blocked";
  brushSize: number;
  source: "manual" | "asset-derived";
  sourceAssetId?: string;
};
export type CollisionShape = {
  id: string;
  geometry: BaseMapPoint[];
  type: "line" | "polygon";
  blocksMovement: true;
  source: "manual" | "asset-derived";
  sourceAssetId?: string;
};
export type BaseMapState = {
  surfaces: SurfaceData[];
  accessibilityZones: AccessibilityZone[];
  collisions: CollisionShape[];
};
export type WorldloomProject = {
  version: string;
  name: string;
  projectId?: string;
  researchMode: ResearchMode;
  interpretationMode: InterpretationMode;
  textInstruction: string;
  gameplayGraph: GameplayGraph;
  sharedLevelDesignState: SharedLevelDesignState;
  sketchState: SketchState;
  sketchSelection: SketchSelection;
  candidateIntent: CandidateIntentInterpretation | null;
  committedIntent: CommittedAuthoringIR | null;
  authoringIntent: AuthoringIR | null;
  lastInterpretationResult: IntentInterpretationResult | null;
  compositionHypothesis: AssetCompositionHypothesis | null;
  committedCompositionIntent: CompositionIntent | null;
  assetEditPlan: AssetEditPlan | null;
  appliedAssetEditPlans: AssetEditPlan[];
  conventions: ConventionEntry[];
  repairHistory: Array<{ id: string; layer: "expression" | "interpretation" | "role_assignment" | "realization" | "propagation"; summary: string; createdAt: number }>;
  strokes: Stroke[];
  constraints: GameplayConstraint[];
  conflicts: ConstraintConflict[];
  variants: LevelVariant[];
  activeVariantId: string | null;
  workingVariantId?: string | null;
  seed: number;
  metadata: { canvasWidth: number; canvasHeight: number; updatedAt: number };
  manualOverrides: ManualOverride[];
  variantRuleOverrides: VariantRuleOverride[];
  globalDesignPreferences: GlobalDesignPreference[];
  strokeInterpretationOverrides: StrokeInterpretationOverride[];
  editHistory: RoomEdit[];
  revisions: DesignRevision[];
  activeRevisionId: string | null;
  playtestSessions: PlaytestSession[];
  playtestEvents: PlaytestEvent[];
  experienceFeedback: ExperienceFeedback[];
  baseMap: BaseMapState;
  wholeLevelState?: WholeLevelState;
  semanticDimensions?: Record<string, { proposed: number; value: number; adjusted: boolean }>;
  sharedDesignState?: SharedDesignState;
  validationIssues?: StructuralIssue[];
  generationContract?: PlayableGenerationContract;
  generatedOutput?: {
    status: "contract_ready" | "success" | "failed";
    scenePath?: string;
    generatedAssetCount?: number;
    generatedAt: number;
    message?: string;
  };
  hiddenSemanticItemIds?: string[];
  worldSetting?: { text: string; confirmed: boolean; confirmedAt?: number };
  sketchSubmission?: { status: "draft" | "submitted" | "interpreting" | "candidate" | "committed" | "failed"; submittedAt?: number; screenshot?: string; baselineCanvasState?: string; currentCanvasState?: string; newSketchDiff?: { changedPixelCount: number; boundingBox: unknown | null; strokeIds: string[] }; diff?: { changedPixelCount: number; boundingBox: unknown | null; strokeIds: string[] }; error?: string };
  mapUnderstandingLocked?: boolean;
  mapUnderstandingSnapshot?: unknown;
  mapLayers?: {
    baseMapVisible: boolean;
    editVisible: boolean;
    sketchVisible?: boolean;
    gameplayVisible: boolean;
    gameplayLocked?: boolean;
    baseMapUrl?: string;
    baseMapStatus?: "not_generated" | "generating" | "generated" | "failed";
    surfaceVisible?: boolean;
    accessibilityVisible?: boolean;
    collisionVisible?: boolean;
  };
  gameplaySemanticLayer?: GameplaySemanticLayer;
};
export type WholeLevelState = "editing" | "finalizing" | "needs_validation" | "ready_to_generate" | "generating" | "generated";
export type StructuralIssue = { id: string; severity: "warning" | "error"; message: string; sourceIds?: string[] };
export type SharedDesignState = { id: string; committedAssetIds: string[]; spatialConstraints: unknown[]; gameplayConstraints: GameplayConstraint[]; experienceConstraints: string[]; finalizedAt: number };
export type EditorMode = "intent" | "review" | "level" | "playtest";
export type EditorSubmode = "inspect" | "edit" | "compare" | "revisions";
export type Tool = "select" | "move" | "pen" | "path" | "loop" | "arrow" | "connector" | "annotation" | "group" | "ungroup" | StrokeType | "eraser" | "delete";
export type SelectedEntity =
  | { kind: "stroke"; id: string }
  | { kind: "asset"; id: string }
  | { kind: "gameplay"; id: string }
  | { kind: "constraint"; id: string }
  | { kind: "room"; variantId: string; id: string }
  | { kind: "gameplay-node"; id: string }
  | { kind: "gameplay-relation"; id: string }
  | { kind: "gameplay-route"; id: string }
  | { kind: "base-surface"; id: string }
  | { kind: "base-accessibility"; id: string }
  | { kind: "base-collision"; id: string }
  | null;
