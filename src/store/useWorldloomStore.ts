
import type { SketchSemantic } from "../core/sketch/semanticStyles";
import { create } from "zustand";
import { nanoid } from "nanoid";
import type { AccessibilityZone, CollisionShape, EditableRoomProperty, EditScope, EditorMode, EditorSubmode, ExperienceFeedback, FieldCell, GameplayConstraint, GameplaySemanticElement, GameplaySemanticPoint, GameplaySemanticType, ImpactPreview, LevelVariant, PlaytestSession, Point, ProposedChange, RoomEdit, RoomNode, SelectedEntity, Stroke, StrokeType, SurfaceData, Tool, WorldloomProject, WholeLevelState, StructuralIssue } from "../core/types";
import type { ClarificationAnswer, InterpretationMode, IntentInterpretationResult, ResearchMode } from "../core/intent/types";
import type { AssetInstance, MovementBehavior, SketchMarkKind, SketchObjectType, SketchRelationType } from "../core/sketch/types";
import { defaultMovementBehavior, removeAssetMovement, synchronizeAssetMovement } from "../core/baseMap";
import type { SemanticItemKind } from "../core/sketch/semanticStyles";
import { mockAssetLibrary } from "../assets/mockAssetLibrary";
import type { AssetDefinition } from "../core/sketch/types";
import { createEmptyProject, createExampleStrokes } from "../examples/exampleProject";
import { simplifyStroke } from "../core/geometry/simplifyStroke";
import { buildExperienceField } from "../core/field/buildExperienceField";
import { compileConstraints } from "../core/compiler/compileConstraints";
import { detectConflicts } from "../core/compiler/detectConflicts";
import { generateVariants } from "../core/generator/generateVariants";
import { importProjectJson } from "../core/serialization/projectJson";
import { captureRoomEdit } from "../core/editing/captureRoomEdit";
import { inferEditMeaning } from "../core/editing/inferEditMeaning";
import { buildImpactPreview } from "../core/editing/buildImpactPreview";
import { applyEdit } from "../core/editing/applyEdit";
import { createRevision } from "../core/revisions/createRevision";
import { restoreRevision } from "../core/revisions/restoreRevision";
import { createFeedback, createPlaytestSession, enterRoom } from "../core/playtest/playtestModel";
import { interpretRuleBasedSync } from "../core/intent/ruleBasedInterpreter";
import { intentToConstraints } from "../core/intent/intentToConstraints";
import { interpretMockAISync } from "../ai/mockAIInterpreter";
import { createCandidateIntent, answerClarification, commitCandidateIntent } from "../core/grounding/candidateIntent";
import { createSketchStateFromStrokes } from "../core/sketch/adaptLegacyStrokes";
import { buildSketchPatternSignature } from "../core/sketch/patternSignature";
import { confirmConvention, createConventionEntry, findMatchingConvention, rejectConvention } from "../core/conventions/conventionMemory";
import { interpretAssetComposition } from "../ai/mockAssetCompositionInterpreter";
import { applyAssetEditPlan, commitCompositionIntent, generateAssetEditPlan } from "../core/composition/editPlan";
import { createUtteranceFromSelection } from "../core/composition/utterance";
import { boundsForRawStroke, classifyRawStrokeGesture, nearbyAssetsForStroke } from "../core/sketch/rawStrokeGeometry";
import { buildTrainingExample } from "../research/trainingExample";
import { calculateResearchMetrics, type ResearchMetrics } from "../research/metrics";
import { createResearchEvent, createResearchSessionId, exportResearchLog, type ResearchEvent } from "../research/interactionLogger";
import { requestModelInterpretation, requestGenerationContract } from "../ai/modelClient";
import { captureStrokeSnapshot } from "../core/image/canvasDiff";
import type { GameplayGraph, GameplayNode, GameplayRelation, GameplayRoute } from "../core/gameplay/types";
import {
  addGameplayNode as addNodeToGraph,
  addGameplayRelation as addRelationToGraph,
  addGameplayRoute as addRouteToGraph,
  createGameplayNode,
  createGameplayRelation,
  createGameplayRoute,
  removeGameplayNode as removeNodeFromGraph,
  removeGameplayRelation as removeRelationFromGraph,
  removeGameplayRoute as removeRouteFromGraph,
  updateGameplayNode as updateNodeInGraph,
  updateGameplayRelation as updateRelationInGraph,
  updateGameplayRoute as updateRouteInGraph,
  type CreateGameplayNodeInput,
  type CreateGameplayRelationInput,
  type CreateGameplayRouteInput,
} from "../core/gameplay/gameplayGraph";
import type {
  ExperienceLayer,
  GameplayLayer,
  GameplayRepairProposal,
  SceneLayer,
  SharedLevelDesignState,
  SharedSpatialConstraint,
  SpatialConstraintMode,
  SpatialLayer,
} from "../core/shared-state/types";
import type { GameplayCandidatePatch } from "../core/negotiation/types";
import type { LocalRegenerationOptions } from "../core/generator/generateVariants";
import {
  synchronizeSharedLevelDesignState,
  updateGameplayLayer,
  updateSceneLayer,
  updateSpatialLayer,
  updateExperienceLayer,
  setGameplayCandidates,
  selectGameplayCandidate as selectSharedGameplayCandidate,
  commitGameplayCandidate as commitSharedGameplayCandidate,
  setGameplayValidationResult,
  setGameplayRepairProposals,
  synchronizeGameplayRepairResult,
} from "../core/shared-state/sharedLevelDesignState";
import {
  createGameplayNegotiationSession,
  generateDefaultGameplayCandidates,
  updateGameplayCandidate as updateGameplayCandidateSession,
  selectGameplayCandidate as selectGameplayCandidateSession,
  rejectGameplayCandidate as rejectGameplayCandidateSession,
  commitGameplayCandidate as commitGameplayCandidateSession,
} from "../core/negotiation/gameplayInterpretation";
import {
  updateSpatialConstraintModel,
  setSpatialConstraintMode as setSpatialConstraintModelMode,
} from "../core/constraints/spatialConstraintModel";
import { validateGameplayGraph } from "../core/validator/validateGameplayGraph";
import {
  generateGameplayRepairProposals,
  applyGameplayRepair as applyGameplayRepairProposal,
} from "../core/validator/repairGameplayGraph";
import { buildPlayableGenerationContract } from "../core/contract/buildPlayableGenerationContract";
import type { PlayableGenerationContract } from "../core/contract/types";


function dimensionsFromHypothesis(
  hypothesis: WorldloomProject["compositionHypothesis"],
) {
  const summary = `${
    hypothesis?.summary ?? ""
  } ${
    hypothesis?.assetRoles
      .map((role) => role.proposedRole)
      .join(" ") ?? ""
  }`.toLowerCase();

  const values: Record<string, number> = {
    grouping_combat:
      /combat|encounter|enemy|defen/.test(summary)
        ? 0.78
        : 0.32,
    local_regional:
      /regional|global|landmark/.test(summary)
        ? 0.68
        : 0.32,
    detour_main_route:
      /main|approach|route/.test(summary)
        ? 0.72
        : 0.28,
    optional_mandatory:
      /optional|detour/.test(summary)
        ? 0.22
        : 0.6,
    decorative_functional:
      /functional|encounter|reward|gate/.test(summary)
        ? 0.8
        : 0.38,
    low_risk_high_risk:
      /enemy|combat|danger|conflict/.test(summary)
        ? 0.72
        : 0.3,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      {
        proposed: value,
        value,
        adjusted: false,
      },
    ]),
  );
}

function validateDesignStateCompat(
  project: WorldloomProject,
): StructuralIssue[] {
  const issues: StructuralIssue[] = [];

  const assets =
    project.sketchState.assetInstances;

  const hasRoute =
    project.sketchState.rawStrokes.some(
      (stroke) => !stroke.deleted,
    ) ||
    project.sketchState.marks.some(
      (mark) =>
        mark.kind === "path" ||
        mark.kind === "arrow",
    );

  if (assets.length === 0) {
    issues.push({
      id: "missing-start",
      severity: "error",
      message:
        "Start is missing: place at least one scene element to define the playable space.",
    });
  }

  if (!hasRoute) {
    issues.push({
      id: "missing-route",
      severity: "warning",
      message:
        "No route is defined between the start and goal.",
    });
  }

  const gameplayValidation =
    validateGameplayGraph(
      project.sharedLevelDesignState.gameplay.graph,
    );

  for (const conflict of
    gameplayValidation.conflicts) {
    issues.push({
      id: conflict.id,
      severity:
        conflict.severity === "error"
          ? "error"
          : "warning",
      message: conflict.message,
      sourceIds: [
        ...conflict.nodeIds,
        ...conflict.relationIds,
        ...conflict.routeIds,
      ],
    });
  }

  return issues;
}

function buildGenerationContractCompat(
  project: WorldloomProject,
): PlayableGenerationContract {
  return buildPlayableGenerationContract(
    project.sharedLevelDesignState,
    {
      projectId: project.projectId,
      seed: project.seed,
      canvasWidth:
        project.metadata.canvasWidth,
      canvasHeight:
        project.metadata.canvasHeight,
      regenerationMode: "full",
      lockedElementIds:
        project.sketchState.assetInstances
          .filter(
            (asset) =>
              asset.locked ||
              asset.preserve,
          )
          .map((asset) => asset.id),
    },
  );
}

export type WorldloomState = {
  project: WorldloomProject;
  activeTool: Tool;
  sketchSemantic: SketchSemantic;
  setSketchSemantic: (style: SketchSemantic) => void;
 
  wholeLevelState: WholeLevelState;
  modelStatus: "idle" | "loading" | "ready" | "error";
  modelError: string | null;
  modelSource: "model" | "local-fallback" | "demo";
  setSemanticDimension: (key: string, value: number) => void;
  finalizeDesignState: (force?: boolean) => void;
  validateDesignState: () => void;
  generateLevelContract: () => void;
  retryInterpretation: () => void;
  moveSemanticItem: (id: string, position: { x: number; y: number }, surface?: "card" | "marker") => void;
  hideSemanticItem: (id: string) => void;
  deleteSemanticItem: (id: string) => void;
  reassignSemanticItem: (id: string, targetId: string) => void;
  convertSemanticItem: (id: string, kind: SemanticItemKind) => void;
  createSemanticItem: (kind: SemanticItemKind, targetId: string, position?: { x: number; y: number }, text?: string) => void;
  setWorldSetting: (text: string) => void;
  confirmWorldSetting: () => void;
  submitSketch: () => void;
  clearUnsubmittedSketch: () => void;
  setMapLayerVisible: (layer: "baseMapVisible" | "editVisible" | "gameplayVisible" | "surfaceVisible" | "accessibilityVisible" | "collisionVisible", visible: boolean) => void;
  addBaseMapSurface: (surface: Omit<SurfaceData, "id">) => string;
  addAccessibilityZone: (zone: Omit<AccessibilityZone, "id" | "source"> & Partial<Pick<AccessibilityZone, "source">>) => string;
  addCollisionShape: (shape: Omit<CollisionShape, "id" | "source"> & Partial<Pick<CollisionShape, "source">>) => string;
  updateBaseMapSurface: (id: string, patch: Partial<Pick<SurfaceData, "materialId" | "materialScale" | "textureReference">>) => void;
  deleteBaseMapElement: (kind: "surface" | "accessibility" | "collision", id: string) => void;
  setAssetMovementBehavior: (assetInstanceId: string, behavior: MovementBehavior) => void;
  setAssetCollisionFootprintScale: (assetInstanceId: string, scale: number) => void;
  setGameplayLayerLocked: (locked: boolean) => void;
  gameplaySelectionId: string | null;
  focusRequest: { assetId: string; requestId: string } | null;
  focusAssetInstance: (assetInstanceId: string) => void;
  selectGameplayElement: (id: string | null) => void;
  createGameplayElement: (type: GameplaySemanticType, position: GameplaySemanticPoint, sourceDoodleId?: string) => void;
  updateGameplayElement: (id: string, patch: Partial<Omit<GameplaySemanticElement, "id" | "type">>) => void;
  moveGameplayElement: (id: string, position: GameplaySemanticPoint) => void;
  resizeGameplayElement: (id: string, region: GameplaySemanticElement["region"]) => void;
  deleteGameplayElement: (id: string) => void;
  addGameplayWaypoint: (id: string, point: GameplaySemanticPoint) => void;
  moveGameplayWaypoint: (id: string, index: number, point: GameplaySemanticPoint) => void;
  deleteGameplayWaypoint: (id: string, index: number) => void;
  reverseGameplayRoute: (id: string) => void;
  setMapBaseMapUrl: (url: string | undefined) => void;
  setGeneratedOutput: (output: NonNullable<WorldloomProject["generatedOutput"]>) => void;
  confirmMapUnderstanding: () => void;
  unlockMapUnderstanding: () => void;
  generationContract: PlayableGenerationContract | null;
  validationIssues: StructuralIssue[];
  selected: SelectedEntity;
  editorMode: EditorMode;
  editorSubmode: EditorSubmode;
  showField: boolean;
  brushWidth: number;
  brushIntensity: number;
  undoHistory: WorldloomProject[];
  redoHistory: WorldloomProject[];
  importError: string | null;
  draftRoomEdit: RoomEdit | null;
  pendingEditScope: EditScope;
  selectedEditInterpretation: string | null;
  impactPreview: ImpactPreview | null;
  playtestSession: PlaytestSession | null;
  onboardingDismissed: boolean;
  researchSessionId: string;
  researchLog: ResearchEvent[];
  comparisonResult: { ruleBased: IntentInterpretationResult; ai: IntentInterpretationResult } | null;
  assetLibrary: AssetDefinition[];
  draftRawStrokeId: string | null;
  setTool: (tool: Tool) => void;
  setMode: (mode: EditorMode) => void;
  setSubmode: (mode: EditorSubmode) => void;
  setResearchMode: (mode: ResearchMode) => void;
  setInterpretationMode: (mode: InterpretationMode) => void;
  setTextInstruction: (text: string) => void;
  addGameplayNode: (input: CreateGameplayNodeInput) => string;
  updateGameplayNode: (nodeId: string, patch: Partial<Omit<GameplayNode, "id">>) => void;
  deleteGameplayNode: (nodeId: string) => void;
  addGameplayRelation: (input: CreateGameplayRelationInput) => string | null;
  updateGameplayRelation: (relationId: string, patch: Partial<Omit<GameplayRelation, "id">>) => void;
  deleteGameplayRelation: (relationId: string) => void;
  addGameplayRoute: (input: CreateGameplayRouteInput) => string | null;
  updateGameplayRoute: (routeId: string, patch: Partial<Omit<GameplayRoute, "id">>) => void;
  deleteGameplayRoute: (routeId: string) => void;
  updateSharedScene: (patch: Partial<SceneLayer>) => void;
  updateSharedSpatial: (patch: Partial<SpatialLayer>) => void;
  updateSharedGameplay: (graphOrPatch: GameplayGraph | Partial<GameplayLayer>) => void;
  updateSharedExperience: (patch: Partial<ExperienceLayer>) => void;
  synchronizeSharedState: (update: {
    scene?: Partial<SceneLayer>;
    spatial?: Partial<SpatialLayer>;
    gameplay?: Partial<GameplayLayer>;
    experience?: Partial<ExperienceLayer>;
  }) => void;
  generateGameplayCandidates: () => void;
  updateGameplayCandidate: (candidateId: string, patch: GameplayCandidatePatch) => void;
  selectGameplayCandidate: (candidateId: string) => void;
  rejectGameplayCandidate: (candidateId: string) => void;
  commitGameplayCandidate: (candidateId?: string) => void;
  upsertSpatialConstraint: (constraint: SharedSpatialConstraint) => void;
  updateSpatialConstraint: (constraintId: string, patch: Partial<Omit<SharedSpatialConstraint, "id" | "targetElementId">>) => void;
  setSpatialConstraintMode: (constraintId: string, mode: SpatialConstraintMode) => void;
  removeSpatialConstraint: (constraintId: string) => void;
  validateGameplay: () => void;
  generateGameplayRepairs: () => void;
  applyGameplayRepair: (repairId: string) => void;
  regenerateLocal: (scope: Omit<LocalRegenerationOptions, "mode" | "previousVariants">) => void;
  selectInterpretationAlternative: (interpretationId: string, alternativeId: string) => void;
  placeAssetInstance: (assetDefinitionId: string, position?: Point) => void;
  moveAssetInstance: (assetInstanceId: string, dx: number, dy: number) => void;
  rotateAssetInstance: (assetInstanceId: string, degrees: number) => void;
  toggleAssetLock: (assetInstanceId: string) => void;
  duplicateAssetInstance: (assetInstanceId: string) => void;
  deleteAssetInstance: (assetInstanceId: string) => void;
  beginRawStroke: (point: { x: number; y: number; pressure?: number; pointerType?: string }) => void;
  appendRawStrokePoint: (point: { x: number; y: number; pressure?: number }) => void;
  completeRawStroke: () => void;
  deleteRawStroke: (strokeId: string) => void;
  addSketchMark: (kind: SketchMarkKind) => void;
  deleteSketchMark: (markId: string) => void;
  addSketchObject: (objectType: SketchObjectType | string) => void;
  deleteSketchObject: (objectId: string) => void;
  moveSketchObject: (objectId: string, dx: number, dy: number) => void;
  annotateSketch: (targetId: string, text: string) => void;
  deleteSketchAnnotation: (annotationId: string) => void;
  addSketchRelation: (sourceId: string, targetId: string, relationType: SketchRelationType) => void;
  deleteSketchRelation: (relationId: string) => void;
  selectSketchIds: (ids: string[]) => void;
  groupSelectedSketch: () => void;
  ungroupSelectedSketch: () => void;
  interpretTogether: (submission?: { screenshot?: string; diff?: { changedPixelCount: number; boundingBox: unknown | null; strokeIds: string[] } }) => void;
  answerCompositionClarification: (requestId: string, optionId?: string, freeText?: string) => void;
  commitComposition: () => void;
  selectCompositionCandidate: (candidateId: string) => void;
  editCompositionCandidate: (candidateId: string, patch: { name?: string; description?: string }) => void;
  setCustomInterpretation: (name: string, description: string, semanticType?: string) => void;
  generateAssetPlan: () => void;
  applyAssetPlan: () => void;
  rejectAssetPlan: () => void;
  loadV4DemoScene: (demo: "high-ground" | "gated-recovery" | "optional-detour") => void;
  answerClarificationRequest: (requestId: string, optionId?: string, freeText?: string) => void;
  commitCandidate: () => void;
  confirmCandidateConvention: (scope?: "session" | "project" | "personal") => void;
  rejectCandidateConvention: () => void;
  startRepair: (layer: "expression" | "interpretation" | "role_assignment" | "realization" | "propagation") => void;
  setShowField: (show: boolean) => void;
  setBrushWidth: (width: number) => void;
  setBrushIntensity: (intensity: number) => void;
  addStroke: (type: StrokeType, points: Point[]) => void;
  select: (selected: SelectedEntity) => void;
  updateSelectedStroke: (patch: Partial<Pick<Stroke, "width" | "intensity" | "enabled">>) => void;
  updateConstraint: (id: string, patch: Partial<Pick<GameplayConstraint, "weight" | "preferredValue" | "hard" | "enabled">>) => void;
  resetConstraint: (id: string) => void;
  deleteStroke: (id: string) => void;
  eraseAt: (point: Pick<Point, "x" | "y">) => void;
  clearStrokes: () => void;
  compileIntent: () => void;
  generate: () => void;
  regenerate: () => void;
  setSeed: (seed: number) => void;
  setActiveVariant: (variantId: string) => void;
  setWorkingVariant: (variantId: string) => void;
  loadExample: () => void;
  importJson: (text: string) => void;
  beginRoomEdit: (variantId: string, roomId: string, patch: Partial<RoomNode>, property: EditableRoomProperty) => void;
  updateDraftScope: (scope: EditScope) => void;
  selectInterpretation: (id: string) => void;
  applyDraftEdit: () => void;
  cancelDraftEdit: () => void;
  addOptionalRoom: () => void;
  deleteOptionalRoom: (variantId: string, roomId: string) => void;
  restoreRoomGenerated: (variantId: string, roomId: string) => void;
  createManualRevision: () => void;
  restoreDesignRevision: (revisionId: string) => void;
  startPlaytest: () => void;
  enterPlaytestRoom: (roomId: string) => void;
  markFeedback: (category: ExperienceFeedback["category"], note?: string) => void;
  createEditFromSuggestion: (change: ProposedChange) => void;
  runInterpretationComparison: () => void;
  exportResearchLogJson: () => string;
  exportTrainingExampleJson: () => string;
  getResearchMetrics: () => ResearchMetrics;
  dismissOnboarding: () => void;
  undo: () => void;
  redo: () => void;
};

function snapshot(project: WorldloomProject): WorldloomProject {
  return JSON.parse(JSON.stringify(project)) as WorldloomProject;
}

function commit(project: WorldloomProject, undoHistory: WorldloomProject[]): WorldloomProject[] {
  return [...undoHistory, snapshot(project)].slice(-40);
}

function buildField(project: WorldloomProject): FieldCell[] {
  return buildExperienceField(project.strokes, project.metadata.canvasWidth, project.metadata.canvasHeight);
}

function pointNearStroke(point: Pick<Point, "x" | "y">, stroke: Stroke): boolean {
  return stroke.points.some((candidate) => Math.hypot(candidate.x - point.x, candidate.y - point.y) < stroke.width * 2.4 + 8);
}

function activeVariant(project: WorldloomProject): LevelVariant | undefined {
  return project.variants.find((variant) => variant.id === (project.workingVariantId ?? project.activeVariantId)) ?? project.variants[0];
}

function findRoom(project: WorldloomProject, variantId: string, roomId: string): RoomNode | undefined {
  return project.variants.find((variant) => variant.id === variantId)?.rooms.find((room) => room.id === roomId);
}

function projectId(project: WorldloomProject): string {
  return project.projectId ?? "project-local";
}

function v4Mode(mode: ResearchMode): boolean {
  return mode === "c1-ai-opaque" || mode === "c2-ai-negotiable" || mode === "c3-ai-negotiable-conventions";
}

function seededPosition(count: number): Point {
  return { x: 170 + (count % 4) * 120, y: 150 + Math.floor(count / 4) * 110, time: Date.now() };
}

function buildDraft(project: WorldloomProject, variantId: string, before: RoomNode, after: RoomNode, property: EditableRoomProperty): RoomEdit {
  const edit = captureRoomEdit(`ED-${nanoid(5)}`, before, after, variantId, property, Date.now());
  return { ...edit, inferredMeaning: inferEditMeaning(edit, before, project.constraints, project.strokes), selectedInterpretationId: null };
}

function projectWithGameplayGraph(
  project: WorldloomProject,
  graph: GameplayGraph,
  updatedAt = Date.now(),
): WorldloomProject {
  const sharedLevelDesignState = updateGameplayLayer(
    project.sharedLevelDesignState,
    {
      graph,
      validation: null,
      repairs: [],
    },
    updatedAt,
  );

  return {
    ...project,
    gameplayGraph: graph,
    sharedLevelDesignState,
    metadata: {
      ...project.metadata,
      updatedAt,
    },
  };
}

function gameplayNegotiationSessionForProject(
  project: WorldloomProject,
) {
  const negotiation =
    project.sharedLevelDesignState.gameplay.negotiation ?? {
      candidates: [],
      selectedCandidateId: null,
      committedCandidateIds: [],
    };

  const session = createGameplayNegotiationSession(
    {
      sourceSceneElementIds: project.sketchSelection.ids.filter((id) =>
        project.sharedLevelDesignState.scene.elements.some((element) => element.id === id),
      ),
      sourceSketchIds: [...project.sketchSelection.ids],
      sourceGameplayNodeIds: project.gameplayGraph.nodes
        .filter((node) => project.sketchSelection.ids.includes(node.id))
        .map((node) => node.id),
      userInstruction: project.textInstruction,
      worldSetting: project.sharedLevelDesignState.scene.worldSetting,
      currentGraph: project.sharedLevelDesignState.gameplay.graph,
    },
    negotiation.candidates,
  );

  return {
    ...session,
    state: {
      candidates: negotiation.candidates,
      selectedCandidateId: negotiation.selectedCandidateId,
      committedCandidateIds: negotiation.committedCandidateIds,
    },
  };
}

export const useWorldloomStore = create<WorldloomState>((set, get) => {
  const initialProject = createEmptyProject();
  const researchSessionId = createResearchSessionId();
  const movementBaselines = new Map<string, { x: number; y: number }>();
  const logEvent = (eventType: ResearchEvent["eventType"], payload: Record<string, unknown> = {}) => {
    const state = get();
    set({ researchLog: [...state.researchLog, createResearchEvent(state.researchSessionId, projectId(state.project), eventType, payload)] });
  };

  return ({
  project: initialProject,
  activeTool: "pen",
  sketchSemantic: "main-route",
  setSketchSemantic: (sketchSemantic) => set({sketchSemantic}),
  wholeLevelState: initialProject.wholeLevelState ?? "editing",
  modelStatus: "idle",
  modelError: null,
  modelSource: "demo",
  gameplaySelectionId: null,
  focusRequest: null,
  focusAssetInstance: (assetInstanceId) => {
    const state = get();
    if (!state.project.sketchState.assetInstances.some((asset) => asset.id === assetInstanceId)) return;
    set({
      project: { ...state.project, sketchSelection: { ids: [assetInstanceId] } },
      selected: { kind: "asset", id: assetInstanceId },
      gameplaySelectionId: null,
      activeTool: "select",
      focusRequest: { assetId: assetInstanceId, requestId: nanoid(7) },
    });
  },
  generationContract: initialProject.generationContract ?? null,
  validationIssues: initialProject.validationIssues ?? [],
  setSemanticDimension: (key, value) => {
    const state = get();
    const current = state.project.semanticDimensions ?? {};
    const previous = current[key] ?? { proposed: value, value, adjusted: false };
    const nextValue = Math.max(0, Math.min(1, value));
    const semanticDimensions = { ...current, [key]: { ...previous, value: nextValue, adjusted: true } };
    set({ project: { ...state.project, semanticDimensions, wholeLevelState: "editing", metadata: { ...state.project.metadata, updatedAt: Date.now() } }, wholeLevelState: "editing" });
    logEvent("interpretation_adjusted", { dimension: key, value: nextValue, proposed: previous.proposed });
  },
  finalizeDesignState: (force = false) => {
    const state = get();
    const issues = validateDesignStateCompat(state.project);
    const sharedDesignState = { id: `SHARED-${nanoid(6)}`, committedAssetIds: state.project.committedCompositionIntent?.assetInstanceIds ?? [], spatialConstraints: state.project.sketchState.relations, gameplayConstraints: state.project.constraints, experienceConstraints: state.project.committedCompositionIntent?.experientialGoals ?? [], finalizedAt: Date.now() };
    const nextState: WholeLevelState = issues.length && !force ? "needs_validation" : "ready_to_generate";
    const project = { ...state.project, sharedDesignState, validationIssues: issues, wholeLevelState: nextState, metadata: { ...state.project.metadata, updatedAt: Date.now() } };
    set({ project, wholeLevelState: nextState, validationIssues: issues, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("level_state_finalized", { state: nextState, issueCount: issues.length, forced: force });
    issues.forEach((issue) => logEvent("structural_conflict_detected", { issueId: issue.id, severity: issue.severity, message: issue.message }));
  },
  validateDesignState: () => {
    const state = get();
    const issues = validateDesignStateCompat(state.project);
    const nextState: WholeLevelState = issues.length ? "needs_validation" : "ready_to_generate";
    set({ project: { ...state.project, validationIssues: issues, wholeLevelState: nextState }, wholeLevelState: nextState, validationIssues: issues });
    issues.forEach((issue) => logEvent("structural_conflict_detected", { issueId: issue.id, severity: issue.severity, message: issue.message }));
  },
  generateLevelContract: () => {
    const state = get();
    if (state.project.wholeLevelState !== "ready_to_generate" && state.wholeLevelState !== "ready_to_generate") return;
    const contract = buildGenerationContractCompat(state.project);
    const project = { ...state.project, generationContract: contract, generatedOutput: { status: "contract_ready" as const, generatedAssetCount: contract.scene.elements.length, generatedAt: Date.now(), message: "Playable generation contract ready. Rendered scene output is external." }, wholeLevelState: "generated" as const, metadata: { ...state.project.metadata, updatedAt: Date.now() } };
    set({ project, wholeLevelState: "generated", generationContract: contract });
    logEvent("generation_started", { contractId: contract.id });
    logEvent("generation_contract_ready", { contractId: contract.id, assetCount: contract.scene.elements.length });
    void requestGenerationContract({ contract }).catch(() => undefined);
  },
  retryInterpretation: () => { get().interpretTogether(); },
  moveSemanticItem: (id, position, surface = "card") => {
    const state = get();
    const existingItems = state.project.sketchState.semanticItems ?? [];
    const generatedQuestion = state.project.compositionHypothesis?.clarificationRequests.find((request) => request.id === id);
    const generatedReading = state.project.compositionHypothesis && id === `${state.project.compositionHypothesis.id}reading`;
    const item = existingItems.find((entry) => entry.id === id) ?? (generatedQuestion ? { id, kind: "question" as const, targetId: generatedQuestion.targetSketchIds[0] ?? state.project.sketchSelection.ids[0] ?? "", text: generatedQuestion.question, source: "ai_generated" as const, offset: { x: 70, y: 0 } } : generatedReading ? { id, kind: "reading" as const, targetId: state.project.compositionHypothesis!.assetRoles[0]?.assetInstanceId ?? "", text: state.project.compositionHypothesis!.summary, source: "ai_generated" as const, offset: { x: 65, y: 60 } } : undefined);
    if (!item) return;
    const nextItems = existingItems.some((entry) => entry.id === id) ? existingItems.map((entry) => entry.id === id ? { ...entry, visualPosition: { x: position.x, y: position.y } } : entry) : [...existingItems, { ...item, visualPosition: { x: position.x, y: position.y } }];
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, semanticItems: nextItems } } });
    logEvent(surface === "marker" ? "marker_moved" : "ai_card_moved", { semanticItemId: id, position });
  },
  hideSemanticItem: (id) => {
    const state = get();
    const hiddenSemanticItemIds = Array.from(new Set([...(state.project.hiddenSemanticItemIds ?? []), id]));
    set({ project: { ...state.project, hiddenSemanticItemIds } });
  },
  deleteSemanticItem: (id) => {
    const state = get();
    const item = (state.project.sketchState.semanticItems ?? []).find((entry) => entry.id === id);
    const hiddenSemanticItemIds = Array.from(new Set([...(state.project.hiddenSemanticItemIds ?? []), id]));
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, semanticItems: (state.project.sketchState.semanticItems ?? []).filter((entry) => entry.id !== id) }, hiddenSemanticItemIds } });
    if (item) logEvent("marker_deleted", { semanticItemId: id, kind: item.kind });
  },
  reassignSemanticItem: (id, targetId) => {
    const state = get();
    if (!state.project.sketchState.assetInstances.some((asset) => asset.id === targetId)) return;
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, semanticItems: (state.project.sketchState.semanticItems ?? []).map((item) => item.id === id ? { ...item, targetId, visualPosition: undefined } : item) } } });
    logEvent("ai_question_reopened", { semanticItemId: id, targetId });
  },
  convertSemanticItem: (id, kind) => {
    const state = get();
    const item = (state.project.sketchState.semanticItems ?? []).find((entry) => entry.id === id);
    if (!item) return;
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, semanticItems: (state.project.sketchState.semanticItems ?? []).map((entry) => entry.id === id ? { ...entry, kind, status: kind === "constraint" ? "committed" as const : "open" as const } : entry) } } });
    if (kind === "constraint") logEvent("constraint_note_created", { semanticItemId: id });
  },
  createSemanticItem: (kind, targetId, position, text) => {
    const state = get();
    const target = state.project.sketchState.assetInstances.find((asset) => asset.id === targetId) ?? state.project.sketchState.assetInstances[0];
    if (!target) return;
    const item = { id: `SEM-${nanoid(7)}`, kind, targetId: target.id, text: text ?? (kind === "question" ? "What should this element mean in the level?" : kind === "reading" ? "Candidate reading: a meaningful spatial role." : "User constraint note: preserve this relationship."), source: "user_created" as const, offset: { x: 70, y: 0 }, visualPosition: position ?? { x: target.position.x + 70, y: target.position.y }, status: kind === "reading" ? "candidate" as const : "open" as const };
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, semanticItems: [...(state.project.sketchState.semanticItems ?? []), item] }, hiddenSemanticItemIds: (state.project.hiddenSemanticItemIds ?? []).filter((id) => id !== item.id) } });
    logEvent("ai_card_created", { semanticItemId: item.id, kind, source: "user_created", targetId: item.targetId });
    if (kind === "question") logEvent("ai_question_generated", { semanticItemId: item.id, source: "user_created" });
    if (kind === "constraint") logEvent("constraint_note_created", { semanticItemId: item.id, source: "user_created" });
  },
  
  setWorldSetting: (text) => {
    const state = get();
    set({ project: { ...state.project, worldSetting: { text, confirmed: false } } });
  },
  confirmWorldSetting: () => {
    const state = get();
    const current = state.project.worldSetting ?? { text: "", confirmed: false };
    set({ project: { ...state.project, worldSetting: { ...current, confirmed: true, confirmedAt: Date.now() } } });
    logEvent("text_instruction_changed", { source: "world_setting_confirmed", length: current.text.length });
  },
  submitSketch: () => {
    const state = get();
    let screenshot: string | undefined;
    try { screenshot = captureStrokeSnapshot(state.project.sketchState.rawStrokes, state.project.metadata.canvasWidth, state.project.metadata.canvasHeight); } catch { screenshot = undefined; }
    const strokeIds = state.project.sketchState.rawStrokes.filter((stroke) => !stroke.deleted).map((stroke) => stroke.id);
    const previous = state.project.sketchSubmission;
    const baselineStrokeIds = new Set(previous?.diff?.strokeIds ?? []);
    const newStrokeIds = strokeIds.filter((id) => !baselineStrokeIds.has(id));
    const diff = { changedPixelCount: newStrokeIds.length ? newStrokeIds.length : (strokeIds.length ? 1 : 0), boundingBox: null, strokeIds: newStrokeIds.length ? newStrokeIds : strokeIds };
    const sketchSubmission = { status: "submitted" as const, submittedAt: Date.now(), screenshot, baselineCanvasState: previous?.currentCanvasState ?? previous?.screenshot, currentCanvasState: screenshot, newSketchDiff: diff, diff };
    set({ project: { ...state.project, sketchSubmission }, modelStatus: "loading", modelError: null, modelSource: "local-fallback" });
    logEvent("interpret_selection_requested", { source: "submit_sketch", strokeIds });
    get().interpretTogether({ screenshot, diff: sketchSubmission.diff });
  },
  clearUnsubmittedSketch: () => {
    const state = get();
    const submitted = new Set(state.project.sketchSubmission?.diff?.strokeIds ?? []);
    const rawStrokes = state.project.sketchState.rawStrokes.filter((stroke) => submitted.has(stroke.id) || stroke.deleted);
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, rawStrokes }, sketchSubmission: { status: "draft" } } });
  },
  setMapLayerVisible: (layer, visible) => {
    const state = get();
    const current = state.project.mapLayers;
    const mapLayers = {
      baseMapVisible: current?.baseMapVisible ?? false,
      editVisible: current?.editVisible ?? current?.sketchVisible ?? true,
      gameplayVisible: current?.gameplayVisible ?? true,
      gameplayLocked: current?.gameplayLocked ?? false,
      baseMapUrl: current?.baseMapUrl,
      baseMapStatus: current?.baseMapStatus ?? "not_generated",
      surfaceVisible: current?.surfaceVisible ?? true,
      accessibilityVisible: current?.accessibilityVisible ?? false,
      collisionVisible: current?.collisionVisible ?? false,
      [layer]: visible,
    };
    set({ project: { ...state.project, mapLayers } });
  },
  addBaseMapSurface: (surface) => {
    const state = get();
    const id = `surface_${nanoid(8)}`;
    const next: SurfaceData = { ...surface, id };
    set({ project: { ...state.project, baseMap: { ...state.project.baseMap, surfaces: [...state.project.baseMap.surfaces, next] }, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], selected: { kind: "base-surface", id } });
    return id;
  },
  addAccessibilityZone: (zone) => {
    const state = get();
    const id = `access_${nanoid(8)}`;
    const next: AccessibilityZone = { ...zone, id, source: zone.source ?? "manual" };
    set({ project: { ...state.project, baseMap: { ...state.project.baseMap, accessibilityZones: [...state.project.baseMap.accessibilityZones, next] }, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], selected: { kind: "base-accessibility", id } });
    return id;
  },
  addCollisionShape: (shape) => {
    const state = get();
    const id = `collision_${nanoid(8)}`;
    const next: CollisionShape = { ...shape, id, source: shape.source ?? "manual" };
    set({ project: { ...state.project, baseMap: { ...state.project.baseMap, collisions: [...state.project.baseMap.collisions, next] }, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], selected: { kind: "base-collision", id } });
    return id;
  },
  updateBaseMapSurface: (id, patch) => {
    const state = get();
    if (!state.project.baseMap.surfaces.some((surface) => surface.id === id)) return;
    set({ project: { ...state.project, baseMap: { ...state.project.baseMap, surfaces: state.project.baseMap.surfaces.map((surface) => surface.id === id ? { ...surface, ...patch } : surface) }, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
  },
  deleteBaseMapElement: (kind, id) => {
    const state = get();
    const baseMap = kind === "surface"
      ? { ...state.project.baseMap, surfaces: state.project.baseMap.surfaces.filter((item) => item.id !== id) }
      : kind === "accessibility"
        ? { ...state.project.baseMap, accessibilityZones: state.project.baseMap.accessibilityZones.filter((item) => item.id !== id) }
        : { ...state.project.baseMap, collisions: state.project.baseMap.collisions.filter((item) => item.id !== id) };
    set({ project: { ...state.project, baseMap, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], selected: null });
  },
  setAssetMovementBehavior: (assetInstanceId, behavior) => {
    const state = get();
    const asset = state.project.sketchState.assetInstances.find((item) => item.id === assetInstanceId);
    const definition = asset && mockAssetLibrary.find((item) => item.id === asset.assetDefinitionId);
    if (!asset || !definition) return;
    const nextAsset = { ...asset, movementBehavior: behavior };
    const baseMap = synchronizeAssetMovement(state.project.baseMap, nextAsset, definition);
    set({ project: { ...state.project, baseMap, sketchState: { ...state.project.sketchState, assetInstances: state.project.sketchState.assetInstances.map((item) => item.id === assetInstanceId ? nextAsset : item) }, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
  },
  setAssetCollisionFootprintScale: (assetInstanceId, scale) => {
    const state = get();
    const asset = state.project.sketchState.assetInstances.find((item) => item.id === assetInstanceId);
    const definition = asset && mockAssetLibrary.find((item) => item.id === asset.assetDefinitionId);
    if (!asset || !definition) return;
    const nextAsset = { ...asset, collisionFootprintScale: Math.max(.35, Math.min(2, scale)) };
    const baseMap = synchronizeAssetMovement(state.project.baseMap, nextAsset, definition);
    set({ project: { ...state.project, baseMap, sketchState: { ...state.project.sketchState, assetInstances: state.project.sketchState.assetInstances.map((item) => item.id === assetInstanceId ? nextAsset : item) }, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
  },
  setGameplayLayerLocked: (locked) => {
    const state = get();
    const current = state.project.mapLayers;
    set({ project: { ...state.project, mapLayers: { ...current, baseMapVisible: current?.baseMapVisible ?? false, editVisible: current?.editVisible ?? current?.sketchVisible ?? true, gameplayVisible: current?.gameplayVisible ?? true, gameplayLocked: locked }, gameplaySemanticLayer: { elements: state.project.gameplaySemanticLayer?.elements ?? [], locked } } });
  },
  selectGameplayElement: (id) => {
    set({ gameplaySelectionId: id, selected: id ? { kind: "gameplay", id } : null });
    if (id) get().selectSketchIds([]);
  },
  createGameplayElement: (type, position, sourceDoodleId = "manual") => {
    const state = get();
    if (state.project.mapLayers?.gameplayLocked || state.project.gameplaySemanticLayer?.locked) return;
    const labels: Record<GameplaySemanticType, { name: string; description: string }> = {
      player_spawn: { name: "Main Spawn", description: "Primary player starting location." },
      enemy_stronghold: { name: "Enemy Stronghold", description: "A hostile gameplay zone." },
      npc: { name: "NPC", description: "A gameplay character." },
      npc_patrol_route: { name: "Guard Patrol", description: "NPC patrol route." },
    };
    const point = { x: Math.max(0, Math.min(state.project.metadata.canvasWidth, position.x)), y: Math.max(0, Math.min(state.project.metadata.canvasHeight, position.y)) };
    const id = `gameplay_${nanoid(8)}`;
    const base = labels[type];
    const element: GameplaySemanticElement = { id, type, name: base.name, description: base.description, sourceDoodleId, position: point, region: type === "enemy_stronghold" ? { width: 150, height: 105 } : { width: 56, height: 42 } };
    if (type === "npc_patrol_route") {
      const endPoint = { x: Math.min(state.project.metadata.canvasWidth, point.x + 180), y: Math.max(0, point.y - 45) };
      element.startPoint = point; element.endPoint = endPoint; element.direction = "forward"; element.waypoints = [point, { x: (point.x + endPoint.x) / 2, y: (point.y + endPoint.y) / 2 }, endPoint];
    }
    set({ project: { ...state.project, gameplaySemanticLayer: { elements: [...(state.project.gameplaySemanticLayer?.elements ?? []), element], locked: false } }, gameplaySelectionId: id, selected: { kind: "gameplay", id } });
  },
  updateGameplayElement: (id, patch) => {
    const state = get(); if (state.project.mapLayers?.gameplayLocked || state.project.gameplaySemanticLayer?.locked) return;
    const layer = state.project.gameplaySemanticLayer ?? { elements: [], locked: false };
    set({ project: { ...state.project, gameplaySemanticLayer: { ...layer, elements: layer.elements.map((item) => item.id === id ? { ...item, ...patch } : item) } } });
  },
  moveGameplayElement: (id, position) => {
    const item = get().project.gameplaySemanticLayer?.elements.find((element) => element.id === id);
    if (!item) return;
    const dx = position.x - item.position.x;
    const dy = position.y - item.position.y;
    const shift = (point: GameplaySemanticPoint | undefined) => point ? { x: point.x + dx, y: point.y + dy } : undefined;
    get().updateGameplayElement(id, {
      position,
      startPoint: shift(item.startPoint),
      endPoint: shift(item.endPoint),
      waypoints: item.waypoints?.map((point) => shift(point)!),
    });
  },
  resizeGameplayElement: (id, region) => get().updateGameplayElement(id, { region: { width: Math.max(24, region.width), height: Math.max(24, region.height) } }),
  deleteGameplayElement: (id) => {
    const state = get(); if (state.project.mapLayers?.gameplayLocked || state.project.gameplaySemanticLayer?.locked) return;
    const layer = state.project.gameplaySemanticLayer ?? { elements: [], locked: false };
    set({ project: { ...state.project, gameplaySemanticLayer: { ...layer, elements: layer.elements.filter((item) => item.id !== id) } }, gameplaySelectionId: state.gameplaySelectionId === id ? null : state.gameplaySelectionId, selected: state.gameplaySelectionId === id ? null : state.selected });
  },
  addGameplayWaypoint: (id, point) => {
    const item = get().project.gameplaySemanticLayer?.elements.find((element) => element.id === id);
    if (!item || item.type !== "npc_patrol_route") return;
    get().updateGameplayElement(id, { waypoints: [...(item.waypoints ?? []), point] });
  },
  moveGameplayWaypoint: (id, index, point) => {
    const item = get().project.gameplaySemanticLayer?.elements.find((element) => element.id === id);
    if (!item || item.type !== "npc_patrol_route") return;
    const waypoints = [...(item.waypoints ?? [])]; waypoints[index] = point;
    get().updateGameplayElement(id, { waypoints, startPoint: index === 0 ? point : item.startPoint, endPoint: index === waypoints.length - 1 ? point : item.endPoint, position: index === 0 ? point : item.position });
  },
  deleteGameplayWaypoint: (id, index) => {
    const item = get().project.gameplaySemanticLayer?.elements.find((element) => element.id === id);
    if (!item || item.type !== "npc_patrol_route" || (item.waypoints?.length ?? 0) <= 2) return;
    get().updateGameplayElement(id, { waypoints: item.waypoints?.filter((_, waypointIndex) => waypointIndex !== index) });
  },
  reverseGameplayRoute: (id) => {
    const item = get().project.gameplaySemanticLayer?.elements.find((element) => element.id === id);
    if (!item || item.type !== "npc_patrol_route") return;
    const waypoints = [...(item.waypoints ?? [])].reverse();
    get().updateGameplayElement(id, { waypoints, startPoint: item.endPoint, endPoint: item.startPoint, position: item.endPoint ?? item.position, direction: item.direction === "reverse" ? "forward" : "reverse" });
  },
  setMapBaseMapUrl: (url) => {
    const state = get();
    const current = state.project.mapLayers;
    set({ project: { ...state.project, mapLayers: { ...current, baseMapVisible: current?.baseMapVisible ?? false, editVisible: current?.editVisible ?? current?.sketchVisible ?? true, gameplayVisible: current?.gameplayVisible ?? true, gameplayLocked: current?.gameplayLocked ?? false, baseMapUrl: url, baseMapStatus: url ? "generated" : "not_generated" } } });
  },
  setGeneratedOutput: (output) => {
    const state = get();
    const wholeLevelState = output.status === "failed" ? state.project.wholeLevelState ?? "editing" : "generated";
    set({ project: { ...state.project, generatedOutput: output, wholeLevelState }, wholeLevelState });
    logEvent(output.status === "failed" ? "structural_conflict_detected" : "generation_contract_ready", { source: "generated_output", status: output.status, scenePath: output.scenePath });
  },
  confirmMapUnderstanding: () => {
    const state = get();
    const snapshot = { id: `MAP-${nanoid(7)}`, confirmedAt: Date.now(), worldSetting: state.project.worldSetting?.text ?? "", elements: state.project.sketchState.assetInstances.map((asset) => ({ id: asset.id, type: asset.assetDefinitionId, position: asset.position, roles: asset.roleAssignments })), routes: state.project.sketchState.rawStrokes.filter((stroke) => !stroke.deleted).map((stroke) => ({ id: stroke.id, points: stroke.points, semanticStyle: stroke.semanticStyle })) };
    set({ project: { ...state.project, mapUnderstandingSnapshot: snapshot, mapUnderstandingLocked: true } });
    logEvent("level_state_finalized", { source: "map_understanding_confirmed", elementCount: snapshot.elements.length });
  },
  unlockMapUnderstanding: () => { const state = get(); set({ project: { ...state.project, mapUnderstandingLocked: false } }); },
  selected: null,
  editorMode: "intent",
  editorSubmode: "inspect",
  showField: true,
  brushWidth: 10,
  brushIntensity: 0.75,
  undoHistory: [],
  redoHistory: [],
  importError: null,
  draftRoomEdit: null,
  pendingEditScope: "instance",
  selectedEditInterpretation: null,
  impactPreview: null,
  playtestSession: null,
  onboardingDismissed: false,
  researchSessionId,
  researchLog: [createResearchEvent(researchSessionId, projectId(initialProject), "session_started")],
  comparisonResult: null,
  assetLibrary: mockAssetLibrary,
  draftRawStrokeId: null,
  setTool: (activeTool) => set({ activeTool }),
  setMode: (editorMode) => set({ editorMode }),
  setSubmode: (editorSubmode) => set({ editorSubmode }),
  setResearchMode: (researchMode) => {
    const interpretationMode: InterpretationMode = researchMode === "legacy-rule-based" || researchMode === "c1-rule-based" ? "rule-based" : "ai";
    const state = get();
    set({ project: { ...state.project, researchMode, interpretationMode } });
    logEvent("interpretation_mode_selected", { researchMode, interpretationMode });
  },
  setInterpretationMode: (interpretationMode) => {
    const state = get();
    const researchMode: ResearchMode = interpretationMode === "rule-based" ? "legacy-rule-based" : "c2-ai-negotiable";
    set({ project: { ...state.project, interpretationMode, researchMode } });
    logEvent("interpretation_mode_selected", { interpretationMode, researchMode });
  },
  setTextInstruction: (textInstruction) => {
    const state = get();
    set({ project: { ...state.project, textInstruction } });
    logEvent("text_instruction_changed", { length: textInstruction.length });
  },
  addGameplayNode: (input) => {
    const state = get();
    const node = createGameplayNode(input);
    const graph = addNodeToGraph(state.project.gameplayGraph, node);
    const project = projectWithGameplayGraph(state.project, graph);
    set({
      project,
      selected: { kind: "gameplay-node", id: node.id },
      undoHistory: commit(state.project, state.undoHistory),
      redoHistory: [],
    });
    logEvent("sketch_object_created", { source: "gameplay", nodeId: node.id, nodeType: node.type, requirement: node.requirement });
    return node.id;
  },
  updateGameplayNode: (nodeId, patch) => {
    const state = get();
    if (!state.project.gameplayGraph.nodes.some((node) => node.id === nodeId)) return;
    const graph = updateNodeInGraph(state.project.gameplayGraph, nodeId, patch);
    const project = projectWithGameplayGraph(state.project, graph);
    set({ project, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
  },
  deleteGameplayNode: (nodeId) => {
    const state = get();
    if (!state.project.gameplayGraph.nodes.some((node) => node.id === nodeId)) return;
    const graph = removeNodeFromGraph(state.project.gameplayGraph, nodeId);
    const project = projectWithGameplayGraph(state.project, graph);
    set({
      project,
      selected: state.selected?.kind === "gameplay-node" && state.selected.id === nodeId ? null : state.selected,
      undoHistory: commit(state.project, state.undoHistory),
      redoHistory: [],
    });
  },
  addGameplayRelation: (input) => {
    const state = get();
    const graph = state.project.gameplayGraph;
    if (!graph.nodes.some((node) => node.id === input.sourceNodeId) || !graph.nodes.some((node) => node.id === input.targetNodeId) || input.sourceNodeId === input.targetNodeId) return null;
    const relation = createGameplayRelation(input);
    const nextGraph = addRelationToGraph(graph, relation);
    const project = projectWithGameplayGraph(state.project, nextGraph);
    set({
      project,
      selected: { kind: "gameplay-relation", id: relation.id },
      undoHistory: commit(state.project, state.undoHistory),
      redoHistory: [],
    });
    logEvent("relation_created", { source: "gameplay", relationId: relation.id, relationType: relation.type, requirement: relation.requirement });
    return relation.id;
  },
  updateGameplayRelation: (relationId, patch) => {
    const state = get();
    if (!state.project.gameplayGraph.relations.some((relation) => relation.id === relationId)) return;
    const graph = updateRelationInGraph(state.project.gameplayGraph, relationId, patch);
    const project = projectWithGameplayGraph(state.project, graph);
    set({ project, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
  },
  deleteGameplayRelation: (relationId) => {
    const state = get();
    if (!state.project.gameplayGraph.relations.some((relation) => relation.id === relationId)) return;
    const graph = removeRelationFromGraph(state.project.gameplayGraph, relationId);
    const project = projectWithGameplayGraph(state.project, graph);
    set({
      project,
      selected: state.selected?.kind === "gameplay-relation" && state.selected.id === relationId ? null : state.selected,
      undoHistory: commit(state.project, state.undoHistory),
      redoHistory: [],
    });
    logEvent("relation_deleted", { source: "gameplay", relationId });
  },
  addGameplayRoute: (input) => {
    const state = get();
    const graph = state.project.gameplayGraph;
    if (!graph.nodes.some((node) => node.id === input.sourceNodeId) || !graph.nodes.some((node) => node.id === input.targetNodeId) || input.sourceNodeId === input.targetNodeId) return null;
    const route = createGameplayRoute(input);
    const nextGraph = addRouteToGraph(graph, route);
    const project = projectWithGameplayGraph(state.project, nextGraph);
    set({
      project,
      selected: { kind: "gameplay-route", id: route.id },
      undoHistory: commit(state.project, state.undoHistory),
      redoHistory: [],
    });
    logEvent("relation_created", { source: "gameplay-route", routeId: route.id, routeType: route.type, requirement: route.requirement });
    return route.id;
  },
  updateGameplayRoute: (routeId, patch) => {
    const state = get();
    if (!state.project.gameplayGraph.routes.some((route) => route.id === routeId)) return;
    const graph = updateRouteInGraph(state.project.gameplayGraph, routeId, patch);
    const project = projectWithGameplayGraph(state.project, graph);
    set({ project, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
  },
  deleteGameplayRoute: (routeId) => {
    const state = get();
    if (!state.project.gameplayGraph.routes.some((route) => route.id === routeId)) return;
    const graph = removeRouteFromGraph(state.project.gameplayGraph, routeId);
    const project = projectWithGameplayGraph(state.project, graph);
    set({
      project,
      selected: state.selected?.kind === "gameplay-route" && state.selected.id === routeId ? null : state.selected,
      undoHistory: commit(state.project, state.undoHistory),
      redoHistory: [],
    });
    logEvent("relation_deleted", { source: "gameplay-route", routeId });
  },
  updateSharedScene: (patch) => {
    const state = get();
    const sharedLevelDesignState = updateSceneLayer(state.project.sharedLevelDesignState, patch);
    set({ project: { ...state.project, sharedLevelDesignState } });
  },
  updateSharedSpatial: (patch) => {
    const state = get();
    const sharedLevelDesignState = updateSpatialLayer(state.project.sharedLevelDesignState, patch);
    set({ project: { ...state.project, sharedLevelDesignState } });
  },
  updateSharedGameplay: (graphOrPatch) => {
    const state = get();
    const sharedLevelDesignState = updateGameplayLayer(state.project.sharedLevelDesignState, graphOrPatch);
    const graph = "nodes" in graphOrPatch ? graphOrPatch : graphOrPatch.graph ?? sharedLevelDesignState.gameplay.graph;
    set({
      project: {
        ...state.project,
        gameplayGraph: graph,
        sharedLevelDesignState,
      },
    });
  },
  updateSharedExperience: (patch) => {
    const state = get();
    const sharedLevelDesignState = updateExperienceLayer(state.project.sharedLevelDesignState, patch);
    set({ project: { ...state.project, sharedLevelDesignState } });
  },
  synchronizeSharedState: (update) => {
    const state = get();
    const sharedLevelDesignState = synchronizeSharedLevelDesignState(state.project.sharedLevelDesignState, update);
    set({
      project: {
        ...state.project,
        gameplayGraph: sharedLevelDesignState.gameplay.graph,
        sharedLevelDesignState,
      },
    });
  },
  generateGameplayCandidates: () => {
    const state = get();
    const session = gameplayNegotiationSessionForProject(state.project);
    const result = generateDefaultGameplayCandidates(session.context);
    const sharedLevelDesignState = setGameplayCandidates(state.project.sharedLevelDesignState, result.candidates);
    set({ project: { ...state.project, sharedLevelDesignState }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("gameplay_candidate_generated", { candidateIds: result.candidates.map((candidate) => candidate.id), source: result.source });
  },
  updateGameplayCandidate: (candidateId, patch) => {
    const state = get();
    const session = updateGameplayCandidateSession(gameplayNegotiationSessionForProject(state.project), candidateId, patch);
    const sharedLevelDesignState = setGameplayCandidates(state.project.sharedLevelDesignState, session.state.candidates);
    set({ project: { ...state.project, sharedLevelDesignState }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("gameplay_candidate_changed", { candidateId });
  },
  selectGameplayCandidate: (candidateId) => {
    const state = get();
    selectGameplayCandidateSession(gameplayNegotiationSessionForProject(state.project), candidateId);
    const sharedLevelDesignState = selectSharedGameplayCandidate(state.project.sharedLevelDesignState, candidateId);
    set({ project: { ...state.project, sharedLevelDesignState } });
    logEvent("gameplay_candidate_selected", { candidateId });
  },
  rejectGameplayCandidate: (candidateId) => {
    const state = get();
    const session = rejectGameplayCandidateSession(gameplayNegotiationSessionForProject(state.project), candidateId);
    let sharedLevelDesignState = setGameplayCandidates(state.project.sharedLevelDesignState, session.state.candidates);
    sharedLevelDesignState = selectSharedGameplayCandidate(sharedLevelDesignState, session.state.selectedCandidateId);
    set({ project: { ...state.project, sharedLevelDesignState }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("gameplay_candidate_rejected", { candidateId });
  },
  commitGameplayCandidate: (candidateId) => {
    const state = get();
    const session0 = gameplayNegotiationSessionForProject(state.project);
    const targetId = candidateId ?? session0.state.selectedCandidateId;
    if (!targetId) return;
    const session1 = selectGameplayCandidateSession(session0, targetId);
    const committed = commitGameplayCandidateSession(session1, targetId);
    if (!committed.commitment) return;
    const sharedLevelDesignState = commitSharedGameplayCandidate(
      setGameplayCandidates(state.project.sharedLevelDesignState, committed.state.candidates),
      targetId,
      committed.commitment.resultingGraph,
    );
    const project = {
      ...state.project,
      gameplayGraph: committed.commitment.resultingGraph,
      sharedLevelDesignState,
      metadata: { ...state.project.metadata, updatedAt: Date.now() },
    };
    set({ project, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("gameplay_candidate_committed", { candidateId: targetId });
  },
  upsertSpatialConstraint: (constraint) => {
    const state = get();
    const constraints = state.project.sharedLevelDesignState.spatial.constraints.some((item) => item.id === constraint.id)
      ? state.project.sharedLevelDesignState.spatial.constraints.map((item) => item.id === constraint.id ? constraint : item)
      : [...state.project.sharedLevelDesignState.spatial.constraints, constraint];
    const sharedLevelDesignState = updateSpatialLayer(state.project.sharedLevelDesignState, { constraints });
    set({ project: { ...state.project, sharedLevelDesignState }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("spatial_constraint_created", { constraintId: constraint.id, targetElementId: constraint.targetElementId, mode: constraint.mode, property: constraint.property });
  },
  updateSpatialConstraint: (constraintId, patch) => {
    const state = get();
    const current = state.project.sharedLevelDesignState.spatial.constraints.find((constraint) => constraint.id === constraintId);
    if (!current) return;
    const updated = updateSpatialConstraintModel(current, patch);
    const constraints = state.project.sharedLevelDesignState.spatial.constraints.map((constraint) => constraint.id === constraintId ? updated : constraint);
    const sharedLevelDesignState = updateSpatialLayer(state.project.sharedLevelDesignState, { constraints });
    set({ project: { ...state.project, sharedLevelDesignState }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("spatial_constraint_updated", { constraintId, mode: updated.mode, property: updated.property });
  },
  setSpatialConstraintMode: (constraintId, mode) => {
    const state = get();
    const current = state.project.sharedLevelDesignState.spatial.constraints.find((constraint) => constraint.id === constraintId);
    if (!current) return;
    const updated = setSpatialConstraintModelMode(current, mode);
    const constraints = state.project.sharedLevelDesignState.spatial.constraints.map((constraint) => constraint.id === constraintId ? updated : constraint);
    const sharedLevelDesignState = updateSpatialLayer(state.project.sharedLevelDesignState, { constraints });
    set({ project: { ...state.project, sharedLevelDesignState }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("spatial_constraint_mode_changed", { constraintId, mode });
  },
  removeSpatialConstraint: (constraintId) => {
    const state = get();
    const constraints = state.project.sharedLevelDesignState.spatial.constraints.filter((constraint) => constraint.id !== constraintId);
    const sharedLevelDesignState = updateSpatialLayer(state.project.sharedLevelDesignState, { constraints });
    set({ project: { ...state.project, sharedLevelDesignState }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("spatial_constraint_removed", { constraintId });
  },
  validateGameplay: () => {
    const state = get();
    logEvent("gameplay_validation_requested", { nodeCount: state.project.gameplayGraph.nodes.length });
    const validation = validateGameplayGraph(state.project.sharedLevelDesignState.gameplay.graph);
    const repairs = generateGameplayRepairProposals(state.project.sharedLevelDesignState.gameplay.graph, validation);
    let sharedLevelDesignState = setGameplayValidationResult(state.project.sharedLevelDesignState, validation);
    sharedLevelDesignState = setGameplayRepairProposals(sharedLevelDesignState, repairs);
    set({ project: { ...state.project, sharedLevelDesignState } });
    logEvent("gameplay_validation_completed", { validationId: validation.id, valid: validation.valid, conflictCount: validation.conflicts.length });
    validation.conflicts.forEach((conflict) => logEvent("gameplay_conflict_detected", { conflictId: conflict.id, type: conflict.type, severity: conflict.severity, nodeIds: conflict.nodeIds }));
    repairs.forEach((repair) => logEvent("gameplay_repair_generated", { repairId: repair.id, conflictId: repair.conflictId, operationCount: repair.operations.length }));
  },
  generateGameplayRepairs: () => {
    const state = get();
    const validation = state.project.sharedLevelDesignState.gameplay.validation ?? validateGameplayGraph(state.project.sharedLevelDesignState.gameplay.graph);
    const repairs = generateGameplayRepairProposals(state.project.sharedLevelDesignState.gameplay.graph, validation);
    let sharedLevelDesignState = setGameplayValidationResult(state.project.sharedLevelDesignState, validation);
    sharedLevelDesignState = setGameplayRepairProposals(sharedLevelDesignState, repairs);
    set({ project: { ...state.project, sharedLevelDesignState } });
    repairs.forEach((repair) => logEvent("gameplay_repair_generated", { repairId: repair.id, conflictId: repair.conflictId, operationCount: repair.operations.length }));
  },
  applyGameplayRepair: (repairId) => {
    const state = get();
    const proposal = state.project.sharedLevelDesignState.gameplay.repairs?.find((repair) => repair.id === repairId);
    if (!proposal) return;
    const result = applyGameplayRepairProposal(state.project.sharedLevelDesignState.gameplay.graph, proposal);
    const sharedLevelDesignState = synchronizeGameplayRepairResult(state.project.sharedLevelDesignState, result.graph, result.proposal, result.validation);
    const project = {
      ...state.project,
      gameplayGraph: result.graph,
      sharedLevelDesignState,
      metadata: { ...state.project.metadata, updatedAt: Date.now() },
    };
    set({ project, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("gameplay_repair_applied", { repairId, conflictId: proposal.conflictId, validAfterRepair: result.validation.valid });
  },
  regenerateLocal: (scope) => {
    const state = get();
    const seed = state.project.seed + 1;
    const constraints = state.project.constraints;
    logEvent("local_regeneration_requested", { ...scope, seed });
    const variants = generateVariants(
      state.project.strokes,
      constraints,
      buildField(state.project),
      seed,
      state.project.metadata.canvasWidth,
      state.project.metadata.canvasHeight,
      {
        sharedState: state.project.sharedLevelDesignState,
        regeneration: {
          ...scope,
          mode: "local",
          previousVariants: state.project.variants,
        },
      },
    );
    set({
      project: {
        ...state.project,
        seed,
        variants,
        activeVariantId: state.project.activeVariantId ?? variants[0]?.id ?? null,
        workingVariantId: state.project.workingVariantId ?? variants[0]?.id ?? null,
        metadata: { ...state.project.metadata, updatedAt: Date.now() },
      },
      undoHistory: commit(state.project, state.undoHistory),
      redoHistory: [],
    });
    logEvent("local_regeneration_completed", { variantIds: variants.map((variant) => variant.id), seed });
  },
  selectInterpretationAlternative: (interpretationId, alternativeId) => {
    const state = get();
    const result = state.project.lastInterpretationResult;
    if (!result || !state.project.authoringIntent) return;
    const interpretation = result.interpretations.find((item) => item.id === interpretationId);
    const alternative = interpretation?.alternatives.find((item) => item.id === alternativeId);
    if (!interpretation || !alternative) return;
    const interpretations = result.interpretations.map((item) => item.id === interpretationId ? { ...item, semanticSummary: alternative.semanticSummary, effects: alternative.effects } : item);
    const authoringIntent = {
      ...state.project.authoringIntent,
      intents: state.project.authoringIntent.intents.map((intent) => intent.sourceStrokeIds.some((id) => interpretation.sourceStrokeIds.includes(id)) && intent.kind === "experience" ? { ...intent, effects: alternative.effects } : intent),
    };
    const derivedConstraints = intentToConstraints(authoringIntent, state.project.strokes, interpretations);
    const conflicts = detectConflicts(state.project.strokes, derivedConstraints);
    const nextResult = { ...result, interpretations, authoringIntent, derivedConstraints, conflicts, metadata: { ...result.metadata, selectedAlternativeId: alternativeId, manuallyAdjusted: true } };
    set({ project: { ...state.project, authoringIntent, constraints: derivedConstraints, conflicts, lastInterpretationResult: nextResult }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("interpretation_alternative_selected", { interpretationId, alternativeId });
  },
  placeAssetInstance: (assetDefinitionId, position) => {
    const state = get();
    const definition = mockAssetLibrary.find((asset) => asset.id === assetDefinitionId);
    if (!definition) return;
    const asset: AssetInstance = {
      id: `AI-${nanoid(5)}`,
      assetDefinitionId,
      position: position ?? seededPosition(state.project.sketchState.assetInstances.length),
      rotation: 0,
      scale: 1,
      movementBehavior: defaultMovementBehavior(definition),
      collisionFootprintScale: 1,
      locked: false,
      preserve: false,
      doNotDuplicate: definition.defaultConstraints?.duplicable === false,
      doNotReplace: definition.defaultConstraints?.replaceable === false,
      roleAssignments: [],
      sourceAssetRef: definition.sourceRef,
      createdAt: Date.now(),
    };
    const baseMap = synchronizeAssetMovement(state.project.baseMap, asset, definition);
    set({ project: { ...state.project, baseMap, sketchState: { ...state.project.sketchState, assetInstances: [...state.project.sketchState.assetInstances, asset] }, sketchSelection: { ids: [asset.id] }, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], selected: { kind: "asset", id: asset.id } });
    logEvent("asset_dragged_from_library", { assetDefinitionId });
    logEvent("asset_instance_created", { assetInstanceId: asset.id, assetDefinitionId });
  },
  moveAssetInstance: (assetInstanceId, dx, dy) => {
    const state = get();
    const asset = state.project.sketchState.assetInstances.find((item) => item.id === assetInstanceId);
    if (!asset || asset.locked) return;
    const semanticItems = state.project.sketchState.semanticItems ?? [];
    const nextPosition = { x: asset.position.x + dx, y: asset.position.y + dy };
    const baseline = movementBaselines.get(assetInstanceId) ?? { x: asset.position.x, y: asset.position.y };
    const meaningfulChange = Math.hypot(nextPosition.x - baseline.x, nextPosition.y - baseline.y) > 28;
    const createdMarker = meaningfulChange && !semanticItems.some((item) => item.kind === "question" && item.targetId === assetInstanceId);
    const nextSemanticItems = createdMarker ? [...semanticItems, { id: `MOVE-${assetInstanceId}`, kind: "question" as const, targetId: assetInstanceId, text: "This spatial change may alter the element's role. Ask the model to re-interpret it?", source: "auto_detected" as const, offset: { x: 70, y: 0 }, visualPosition: { x: nextPosition.x + 70, y: nextPosition.y }, status: "open" as const }] : semanticItems;
    if (meaningfulChange) movementBaselines.set(assetInstanceId, nextPosition);
    const nextAsset = { ...asset, position: { ...asset.position, x: asset.position.x + dx, y: asset.position.y + dy, time: Date.now() } };
    const definition = mockAssetLibrary.find((item) => item.id === asset.assetDefinitionId);
    const baseMap = definition ? synchronizeAssetMovement(state.project.baseMap, nextAsset, definition) : state.project.baseMap;
    set({ project: { ...state.project, baseMap, sketchState: { ...state.project.sketchState, assetInstances: state.project.sketchState.assetInstances.map((item) => item.id === assetInstanceId ? nextAsset : item), semanticItems: nextSemanticItems } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("asset_moved", { assetInstanceId, dx, dy });
    if (createdMarker) { logEvent("ai_marker_created", { semanticItemId: `MOVE-${assetInstanceId}`, source: "auto_detected", trigger: "meaningful_asset_move" }); logEvent("ai_question_generated", { semanticItemId: `MOVE-${assetInstanceId}` }); }
  },
  rotateAssetInstance: (assetInstanceId, degrees) => {
    const state = get();
    const asset = state.project.sketchState.assetInstances.find((item) => item.id === assetInstanceId);
    if (!asset || asset.locked) return;
    const nextAsset = { ...asset, rotation: (asset.rotation + degrees + 360) % 360 };
    const definition = mockAssetLibrary.find((item) => item.id === asset.assetDefinitionId);
    const baseMap = definition ? synchronizeAssetMovement(state.project.baseMap, nextAsset, definition) : state.project.baseMap;
    set({ project: { ...state.project, baseMap, sketchState: { ...state.project.sketchState, assetInstances: state.project.sketchState.assetInstances.map((item) => item.id === assetInstanceId ? nextAsset : item) } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("asset_rotated", { assetInstanceId, degrees });
  },
  toggleAssetLock: (assetInstanceId) => {
    const state = get();
    const asset = state.project.sketchState.assetInstances.find((item) => item.id === assetInstanceId);
    if (!asset) return;
    const locked = !asset.locked;
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, assetInstances: state.project.sketchState.assetInstances.map((item) => item.id === assetInstanceId ? { ...item, locked, preserve: locked || item.preserve } : item) } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent(locked ? "asset_locked" : "asset_unlocked", { assetInstanceId });
  },
  duplicateAssetInstance: (assetInstanceId) => {
    const state = get();
    const asset = state.project.sketchState.assetInstances.find((item) => item.id === assetInstanceId);
    if (!asset || asset.doNotDuplicate) return;
    const duplicate = { ...asset, id: `AI-${nanoid(5)}`, position: { ...asset.position, x: asset.position.x + 36, y: asset.position.y + 28, time: Date.now() }, locked: false, createdAt: Date.now() };
    const definition = mockAssetLibrary.find((item) => item.id === duplicate.assetDefinitionId);
    const baseMap = definition ? synchronizeAssetMovement(state.project.baseMap, duplicate, definition) : state.project.baseMap;
    set({ project: { ...state.project, baseMap, sketchState: { ...state.project.sketchState, assetInstances: [...state.project.sketchState.assetInstances, duplicate] }, sketchSelection: { ids: [duplicate.id] } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], selected: { kind: "asset", id: duplicate.id } });
    logEvent("asset_duplicated", { sourceAssetInstanceId: assetInstanceId, assetInstanceId: duplicate.id });
  },
  deleteAssetInstance: (assetInstanceId) => {
    const state = get();
    const asset = state.project.sketchState.assetInstances.find((item) => item.id === assetInstanceId);
    if (!asset || asset.locked) return;
    const hadCommittedReference = Boolean(state.project.committedCompositionIntent?.assetInstanceIds.includes(assetInstanceId));
    const validationIssues = hadCommittedReference ? [...(state.project.validationIssues ?? []).filter((issue) => issue.id !== `deleted-${assetInstanceId}`), { id: `deleted-${assetInstanceId}`, severity: "error" as const, message: `Committed element ${assetInstanceId} was deleted; re-check the shared design state.`, sourceIds: [assetInstanceId] }] : (state.project.validationIssues ?? []);
    const remainingAssets = state.project.sketchState.assetInstances.filter((item) => item.id !== assetInstanceId);
    const semanticItems = (state.project.sketchState.semanticItems ?? []).filter((item) => item.targetId !== assetInstanceId);
    if (hadCommittedReference && remainingAssets[0]) semanticItems.push({ id: `DELETE-${assetInstanceId}`, kind: "question", targetId: remainingAssets[0].id, text: `Structural warning: ${assetInstanceId} was committed but deleted. Reassign or redraw the dependency.`, source: "model", offset: { x: 70, y: 0 } });
    const project = { ...state.project, baseMap: removeAssetMovement(state.project.baseMap, assetInstanceId), sketchState: { ...state.project.sketchState, assetInstances: remainingAssets, relations: state.project.sketchState.relations.filter((relation) => relation.sourceId !== assetInstanceId && relation.targetId !== assetInstanceId), annotations: state.project.sketchState.annotations.filter((note) => note.targetId !== assetInstanceId), semanticItems, groups: state.project.sketchState.groups.map((group) => ({ ...group, memberIds: group.memberIds.filter((id) => id !== assetInstanceId) })).filter((group) => group.memberIds.length > 0) }, sketchSelection: { ids: state.project.sketchSelection.ids.filter((id) => id !== assetInstanceId) }, validationIssues, wholeLevelState: hadCommittedReference ? "needs_validation" as const : state.project.wholeLevelState };
    set({ project, wholeLevelState: project.wholeLevelState ?? "editing", validationIssues, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("asset_deleted", { assetInstanceId });
    if (hadCommittedReference) logEvent("structural_conflict_detected", { issueId: `deleted-${assetInstanceId}`, sourceIds: [assetInstanceId] });
  },
  beginRawStroke: (point) => {
    const state = get();
    const now = Date.now();
    const stroke = { id: `RAW-${nanoid(6)}`, points: [{ x: point.x, y: point.y, t: now, pressure: point.pressure }], createdAt: now, pointerType: point.pointerType, semanticStyle: state.sketchSemantic };
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, rawStrokes: [...state.project.sketchState.rawStrokes, stroke] } }, draftRawStrokeId: stroke.id, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("freehand_stroke_started", { strokeId: stroke.id, pointerType: point.pointerType ?? "mouse" });
  },
  appendRawStrokePoint: (point) => {
    const state = get();
    if (!state.draftRawStrokeId) return;
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, rawStrokes: state.project.sketchState.rawStrokes.map((stroke) => stroke.id === state.draftRawStrokeId ? { ...stroke, points: [...stroke.points, { x: point.x, y: point.y, t: Date.now(), pressure: point.pressure }] } : stroke) } } });
  },
  completeRawStroke: () => {
    const state = get();
    const stroke = state.project.sketchState.rawStrokes.find((item) => item.id === state.draftRawStrokeId);
    if (!stroke) {
      set({ draftRawStrokeId: null });
      return;
    }
    if (stroke.points.length < 2) {
      set({ project: { ...state.project, sketchState: { ...state.project.sketchState, rawStrokes: state.project.sketchState.rawStrokes.filter((item) => item.id !== stroke.id) } }, draftRawStrokeId: null });
      return;
    }
    const gesture = classifyRawStrokeGesture(stroke);
    const nearbyAssetIds = nearbyAssetsForStroke(stroke, state.project.sketchState.assetInstances);
    const episode = { id: `EP-${nanoid(6)}`, strokeIds: [stroke.id], nearbyAssetIds, startedAt: stroke.createdAt, endedAt: Date.now() };
    const bounds = boundsForRawStroke(stroke);
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, gestureCandidates: [...state.project.sketchState.gestureCandidates, gesture], episodes: [...state.project.sketchState.episodes, episode] }, sketchSelection: { ids: [stroke.id] }, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, draftRawStrokeId: null, selected: null });
    logEvent("freehand_stroke_completed", { strokeId: stroke.id, pointCount: stroke.points.length, duration: Date.now() - stroke.createdAt, pointerType: stroke.pointerType ?? "mouse", boundingBox: bounds, nearbyAssetIds });
    logEvent("sketch_episode_started", { episodeId: episode.id, strokeIds: episode.strokeIds, nearbyAssetIds });
    logEvent("sketch_episode_completed", { episodeId: episode.id, strokeIds: episode.strokeIds, nearbyAssetIds, duration: (episode.endedAt ?? Date.now()) - episode.startedAt });
    logEvent("gesture_candidate_generated", { gestureId: gesture.id, strokeIds: gesture.strokeIds, kind: gesture.kind, confidence: gesture.confidence, features: gesture.features });
  },
  deleteRawStroke: (strokeId) => {
    const state = get();
    const stroke = state.project.sketchState.rawStrokes.find((item) => item.id === strokeId);
    if (!stroke) return;
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, rawStrokes: state.project.sketchState.rawStrokes.map((item) => item.id === strokeId ? { ...item, deleted: true } : item) }, sketchSelection: { ids: state.project.sketchSelection.ids.filter((id) => id !== strokeId) } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("freehand_stroke_deleted", { strokeId, pointCount: stroke.points.length, boundingBox: boundsForRawStroke(stroke) });
  },
  addSketchMark: (kind) => {
    const state = get();
    const index = state.project.sketchState.marks.length;
    const mark = {
      id: `SM-${nanoid(5)}`,
      kind,
      points: [
        { x: 180 + index * 34, y: 170, time: Date.now() },
        { x: 230 + index * 34, y: kind === "region" ? 210 : 150, time: Date.now() + 1 },
        { x: 280 + index * 34, y: 190, time: Date.now() + 2 },
        ...(kind === "region" ? [{ x: 184 + index * 34, y: 172, time: Date.now() + 3 }] : []),
      ],
      width: state.brushWidth,
      intensity: state.brushIntensity,
      createdAt: Date.now(),
    };
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, marks: [...state.project.sketchState.marks, mark] }, sketchSelection: { ids: [mark.id] } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
  },
  deleteSketchMark: (markId) => {
    const state = get();
    const mark = state.project.sketchState.marks.find((item) => item.id === markId);
    if (!mark) return;
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, marks: state.project.sketchState.marks.filter((item) => item.id !== markId) }, sketchSelection: { ids: state.project.sketchSelection.ids.filter((id) => id !== markId) } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("sketch_mark_deleted", { markId, kind: mark.kind });
  },
  addSketchObject: (objectType) => {
    const state = get();
    const object = { id: `SO-${nanoid(5)}`, objectType, position: { x: 250 + state.project.sketchState.objects.length * 42, y: 250, time: Date.now() }, label: String(objectType) };
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, objects: [...state.project.sketchState.objects, object] }, sketchSelection: { ids: [object.id] } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("sketch_object_created", { objectId: object.id, objectType });
  },
  deleteSketchObject: (objectId) => {
    const state = get();
    const object = state.project.sketchState.objects.find((item) => item.id === objectId);
    if (!object) return;
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, objects: state.project.sketchState.objects.filter((item) => item.id !== objectId) }, sketchSelection: { ids: state.project.sketchSelection.ids.filter((id) => id !== objectId) } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("sketch_object_deleted", { objectId });
  },
  moveSketchObject: (objectId, dx, dy) => {
    const state = get();
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, objects: state.project.sketchState.objects.map((object) => object.id === objectId ? { ...object, position: { ...object.position, x: object.position.x + dx, y: object.position.y + dy, time: Date.now() } } : object) } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("sketch_object_moved", { objectId, dx, dy });
  },
  annotateSketch: (targetId, text) => {
    const state = get();
    if (!text.trim() || !state.project.sketchState.assetInstances.some(a => a.id === targetId)) return;
    const annotation = { id: `SA-${nanoid(8)}`, targetId, text: text.trim(), createdAt: Date.now() };
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, annotations: [...state.project.sketchState.annotations, annotation] } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("text_instruction_changed", { annotationId: annotation.id, targetId, text: annotation.text });
  },
  deleteSketchAnnotation: (annotationId) => {
    const state = get();
    const annotation = state.project.sketchState.annotations.find((item) => item.id === annotationId);
    if (!annotation) return;
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, annotations: state.project.sketchState.annotations.filter((item) => item.id !== annotationId) }, sketchSelection: { ids: state.project.sketchSelection.ids.filter((id) => id !== annotationId) } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("sketch_annotation_deleted", { annotationId });
  },
  addSketchRelation: (sourceId, targetId, relationType) => {
    const state = get();
    if (!sourceId || !targetId || sourceId === targetId) return;
    const relation = { id: `SR-${nanoid(5)}`, sourceId, targetId, relationType, directed: relationType === "leads_to" };
    const shouldQuestion = relationType === "leads_to" || relationType === "gates";
    const semanticItems = state.project.sketchState.semanticItems ?? [];
    const markerId = `REL-${relation.id}`;
    const nextItems = shouldQuestion && !semanticItems.some((item) => item.id === markerId) ? [...semanticItems, { id: markerId, kind: "question" as const, targetId, text: relationType === "gates" ? "This connection introduces a gate dependency. Should the route remain blocked?" : "This branch connection may change route priority. Should it remain optional?", source: "auto_detected" as const, offset: { x: 70, y: 0 }, visualPosition: { x: (state.project.sketchState.assetInstances.find(a=>a.id===targetId)?.position.x ?? 0) + 70, y: state.project.sketchState.assetInstances.find(a=>a.id===targetId)?.position.y ?? 0 }, status: "open" as const }] : semanticItems;
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, relations: [...state.project.sketchState.relations, relation], semanticItems: nextItems } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("relation_created", { relationId: relation.id, sourceId, targetId, relationType });
    if (shouldQuestion) { logEvent("ai_marker_created", { semanticItemId: markerId, source: "auto_detected", trigger: relationType }); logEvent("ai_question_generated", { semanticItemId: markerId }); }
  },
  deleteSketchRelation: (relationId) => {
    const state = get();
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, relations: state.project.sketchState.relations.filter((relation) => relation.id !== relationId), semanticItems: (state.project.sketchState.semanticItems ?? []).filter((item) => item.id !== `REL-${relationId}`) } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("relation_deleted", { relationId });
  },
  selectSketchIds: (ids) => set((state) => ({ project: { ...state.project, sketchSelection: { ids } }, selected: state.selected?.kind.startsWith("base-") ? null : state.selected })),
  groupSelectedSketch: () => {
    const state = get();
    if (state.project.sketchSelection.ids.length < 2) return;
    const group = { id: `SG-${nanoid(5)}`, memberIds: state.project.sketchSelection.ids, label: "Selected group" };
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, groups: [...state.project.sketchState.groups, group] }, sketchSelection: { ids: [group.id] } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("group_created", { groupId: group.id, memberIds: group.memberIds });
    logEvent("assets_grouped", { groupId: group.id, memberIds: group.memberIds });
  },
  ungroupSelectedSketch: () => {
    const state = get();
    const selected = new Set(state.project.sketchSelection.ids);
    const removed = state.project.sketchState.groups.filter((group) => selected.has(group.id));
    if (removed.length === 0) return;
    set({ project: { ...state.project, sketchState: { ...state.project.sketchState, groups: state.project.sketchState.groups.filter((group) => !selected.has(group.id)) }, sketchSelection: { ids: removed.flatMap((group) => group.memberIds) } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    removed.forEach((group) => logEvent("assets_ungrouped", { groupId: group.id, memberIds: group.memberIds }));
  },
  interpretTogether: (submission) => {
    const state = get();
    const fallbackIds = [
      ...state.project.sketchState.assetInstances.map((asset) => asset.id),
      ...state.project.sketchState.rawStrokes.filter((stroke) => !stroke.deleted).map((stroke) => stroke.id),
      ...state.project.sketchState.marks.map((mark) => mark.id),
      ...state.project.sketchState.relations.map((relation) => relation.id),
    ];
    const selection = (state.project.sketchSelection.ids.length > 0 ? state.project.sketchSelection.ids : fallbackIds).flatMap((id) => state.project.sketchState.groups.find((group) => group.id === id)?.memberIds ?? [id]);
    const utterance = createUtteranceFromSelection(state.project.sketchState, selection);
    const sketchState = { ...state.project.sketchState, utterances: [...state.project.sketchState.utterances, utterance] };
    logEvent("interpret_selection_requested", { selectedIds: selection, rawStrokeIds: utterance.rawStrokeIds, assetInstanceIds: utterance.assetInstanceIds, gestureCandidateIds: utterance.gestureCandidateIds });
    logEvent("composition_interpretation_requested", { utteranceId: utterance.id, selectedIds: selection });
    const conventions = state.project.researchMode === "c3-ai-negotiable-conventions" ? state.project.conventions : [];
    const hypothesis = interpretAssetComposition(sketchState, utterance, conventions);
    const nextSketchState = { ...sketchState, utterances: sketchState.utterances.map((item) => item.id === utterance.id ? { ...item, status: hypothesis.status === "clarifying" ? "clarifying" as const : "candidate" as const } : item) };
    set({ project: { ...state.project, sketchState: nextSketchState, compositionHypothesis: hypothesis, committedCompositionIntent: null, assetEditPlan: null, semanticDimensions: dimensionsFromHypothesis(hypothesis), wholeLevelState: "editing", sketchSubmission: submission ? { status: "interpreting" as const, submittedAt: state.project.sketchSubmission?.submittedAt ?? Date.now(), screenshot: submission.screenshot, diff: submission.diff } : state.project.sketchSubmission, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, editorMode: "review", modelStatus: "loading", modelError: null, modelSource: "local-fallback", wholeLevelState: "editing" });
    logEvent("composition_hypothesis_returned", { hypothesisId: hypothesis.id, utteranceId: utterance.id, confidence: hypothesis.confidence, summary: hypothesis.summary });
    hypothesis.assetRoles.forEach((role) => logEvent("asset_role_proposed", role));
    hypothesis.clarificationRequests.forEach((request) => logEvent("clarification_shown", { requestId: request.id, reason: request.reason, targetSketchIds: request.targetSketchIds }));
    if (hypothesis.conventionMatchedId) logEvent("convention_detected", { conventionId: hypothesis.conventionMatchedId, utteranceId: utterance.id });
    const context = {
      utterance,
      screenshot: submission?.screenshot,
      sketchDiff: submission?.diff,
      worldSetting: state.project.worldSetting,
      assets: sketchState.assetInstances.map((asset) => ({ id: asset.id, definitionId: asset.assetDefinitionId, position: asset.position, locked: asset.locked, preserve: asset.preserve, roles: asset.roleAssignments })),
      routes: sketchState.rawStrokes.filter((stroke) => !stroke.deleted).map((stroke) => ({ id: stroke.id, semanticStyle: stroke.semanticStyle, points: stroke.points })),
      marks: sketchState.marks,
      relations: sketchState.relations,
      annotations: sketchState.annotations,
      localHypothesis: { summary: hypothesis.summary, confidence: hypothesis.confidence, roles: hypothesis.assetRoles.map((role) => role.proposedRole) },
    };
    void requestModelInterpretation(context).then((model) => {
      const current = get();
      if (current.project.compositionHypothesis?.utteranceId !== utterance.id) return;
      const modelCandidates = model.candidates ?? [];
      const alternatives = modelCandidates.length ? modelCandidates.map((item, index) => ({ id: `model-alt-${index}`, name: item.name ?? "Candidate", semanticType: item.type ?? "environment", description: item.description ?? "", confidence: typeof item.confidence === "number" ? item.confidence : undefined, dimensions: item.dimensions, summary: `${item.name ?? "Candidate"}${item.type ? ` · ${item.type}` : ""}: ${item.description ?? ""}`, rationale: `Confidence ${Math.round((item.confidence ?? 0) * 100)}%` })) : (model.alternative_readings ?? []).map((item, index) => ({ id: `model-alt-${index}`, name: item.label ?? "Alternative reading", description: item.summary ?? "", summary: item.summary ?? item.label ?? "Alternative reading", rationale: item.rationale ?? "Model-proposed alternative" }));
      const questions = (model.questions ?? []).map((item, index) => ({ id: `model-q-${index}`, targetSketchIds: selection, reason: "semantic_ambiguity" as const, question: typeof item === "string" ? item : item.question ?? "What should this element mean?", options: [], allowFreeText: true }));
      const localDimensions = current.project.semanticDimensions ?? {};
      const semanticDimensions = { ...localDimensions };
      Object.entries(model.dimensions ?? {}).forEach(([key, value]) => { const prior = semanticDimensions[key] ?? { proposed: value, value, adjusted: false }; semanticDimensions[key] = { ...prior, proposed: Math.max(0, Math.min(1, Number(value))), value: prior.adjusted ? prior.value : Math.max(0, Math.min(1, Number(value))) }; });
      modelCandidates.forEach((candidate) => Object.entries(candidate.dimensions ?? {}).forEach(([key, value]) => { const prior = semanticDimensions[key] ?? { proposed: value, value, adjusted: false }; semanticDimensions[key] = { ...prior, proposed: Math.max(0, Math.min(1, Number(value))), value: prior.adjusted ? prior.value : Math.max(0, Math.min(1, Number(value))) }; }));
      const nextHypothesis = { ...current.project.compositionHypothesis!, summary: model.summary ?? current.project.compositionHypothesis!.summary, confidence: typeof model.confidence === "number" ? Math.max(0, Math.min(1, model.confidence)) : current.project.compositionHypothesis!.confidence, alternatives: alternatives.length ? alternatives : model.title ? [{ id: "model-title", summary: model.title, rationale: "Model title" }] : current.project.compositionHypothesis!.alternatives, clarificationRequests: questions.length ? questions : current.project.compositionHypothesis!.clarificationRequests };
      set({ project: { ...current.project, compositionHypothesis: nextHypothesis, semanticDimensions, sketchSubmission: current.project.sketchSubmission ? { ...current.project.sketchSubmission, status: "candidate" as const } : current.project.sketchSubmission }, modelStatus: "ready", modelError: null, modelSource: "model" });
      logEvent("composition_hypothesis_returned", { hypothesisId: nextHypothesis.id, utteranceId: utterance.id, source: "model", confidence: nextHypothesis.confidence });
    }).catch((error: unknown) => {
      const current = get();
      if (current.project.compositionHypothesis?.utteranceId !== utterance.id) return;
      set({ project: { ...current.project, sketchSubmission: current.project.sketchSubmission ? { ...current.project.sketchSubmission, status: "candidate" as const, error: error instanceof Error ? error.message : "Model request failed" } : current.project.sketchSubmission }, modelStatus: "ready", modelError: error instanceof Error ? error.message : "Model request failed", modelSource: "local-fallback" });
    });
  },
  answerCompositionClarification: (requestId, optionId, freeText) => {
    const state = get();
    const hypothesis = state.project.compositionHypothesis;
    if (!hypothesis) return;
    const answer: ClarificationAnswer = { requestId, optionId, freeText, answeredAt: Date.now() };
    const request = hypothesis.clarificationRequests.find((item) => item.id === requestId);
    const selectedOption = request?.options?.find((option) => option.id === optionId);
    const answerValue = freeText?.trim() || selectedOption?.answerValue || selectedOption?.label;
    const answeredTargets = new Set(request?.targetSketchIds ?? []);
    const next = {
      ...hypothesis,
      clarificationAnswers: [...hypothesis.clarificationAnswers, answer],
      assetRoles: hypothesis.assetRoles.map((role) => {
        const asset = state.project.sketchState.assetInstances.find((item) => item.id === role.assetInstanceId);
        if (asset?.assetDefinitionId === "reward_chest" && optionId === "chest-separate-reward") return { ...role, proposedRole: "optional reward", confidence: 0.9 };
        return answeredTargets.has(role.assetInstanceId) && answerValue ? { ...role, proposedRole: answerValue, confidence: 0.92 } : role;
      }),
      alternatives: answerValue ? [{ id: `answer-${requestId}`, name: answerValue, semanticType: "gameplay", description: `User-selected role for this element: ${answerValue}.`, confidence: 0.92, summary: `${answerValue}: user-confirmed interpretation`, rationale: "User response" }, ...hypothesis.alternatives.filter((item) => item.id !== `answer-${requestId}`)] : hypothesis.alternatives,
      status: "candidate" as const,
    };
    set({ project: { ...state.project, compositionHypothesis: next, sketchState: { ...state.project.sketchState, semanticItems: (state.project.sketchState.semanticItems ?? []).map((item) => item.id === requestId ? { ...item, status: "committed" as const } : item) } } });
    logEvent("clarification_answered", { requestId, optionId, freeText });
    logEvent("interpretation_adjusted", { source: "clarification_response", requestId, answerValue });
  },
  selectCompositionCandidate: (candidateId) => {
    const state = get();
    const hypothesis = state.project.compositionHypothesis;
    const candidate = hypothesis?.alternatives.find((item) => item.id === candidateId);
    if (!hypothesis || !candidate) return;
    set({ project: { ...state.project, compositionHypothesis: { ...hypothesis, summary: candidate.summary, alternatives: [candidate, ...hypothesis.alternatives.filter((item) => item.id !== candidateId)] } } });
    logEvent("interpretation_alternative_selected", { candidateId, hypothesisId: hypothesis.id });
  },
  editCompositionCandidate: (candidateId, patch) => {
    const state = get();
    const hypothesis = state.project.compositionHypothesis;
    if (!hypothesis) return;
    const alternatives = hypothesis.alternatives.map((candidate) => {
      if (candidate.id !== candidateId) return candidate;
      const name = patch.name ?? candidate.name ?? candidate.summary.split(" · ")[0].split(":")[0];
      const description = patch.description ?? candidate.description ?? candidate.summary.split(":").slice(1).join(":").trim();
      return { ...candidate, name, description, summary: `${name}${candidate.semanticType ? ` · ${candidate.semanticType}` : ""}: ${description}`, rationale: "User edited candidate" };
    });
    set({ project: { ...state.project, compositionHypothesis: { ...hypothesis, alternatives } } });
    logEvent("interpretation_adjusted", { source: "user_candidate_edit", candidateId });
  },
  setCustomInterpretation: (name, description, semanticType) => {
    const state = get();
    const hypothesis = state.project.compositionHypothesis;
    if (!hypothesis || !name.trim()) return;
    const summary = `${name.trim()}${semanticType ? ` · ${semanticType}` : ""}: ${description.trim()}`;
    set({ project: { ...state.project, compositionHypothesis: { ...hypothesis, summary, alternatives: [{ id: `custom-${hypothesis.id}`, summary, rationale: "User-defined interpretation" }, ...hypothesis.alternatives] } } });
    logEvent("interpretation_adjusted", { source: "user_defined", hypothesisId: hypothesis.id });
  },
  commitComposition: () => {
    const state = get();
    const hypothesis = state.project.compositionHypothesis;
    if (!hypothesis) return;
    const committedCompositionIntent = commitCompositionIntent(hypothesis, state.project.sketchState);
    const assignedRoles = new Map(hypothesis.assetRoles.map((role) => [role.assetInstanceId, role.proposedRole]));
    const sketchState = {
      ...state.project.sketchState,
      utterances: state.project.sketchState.utterances.map((utterance) => utterance.id === hypothesis.utteranceId ? { ...utterance, status: "committed" as const } : utterance),
      assetInstances: state.project.sketchState.assetInstances.map((asset) => assignedRoles.has(asset.id) ? { ...asset, roleAssignments: Array.from(new Set([...asset.roleAssignments, assignedRoles.get(asset.id)!])) } : asset),
    };
    const compositionHypothesis = { ...hypothesis, status: "committed" as const };
    set({ project: { ...state.project, sketchState, compositionHypothesis, committedCompositionIntent, wholeLevelState: "editing", sketchSubmission: state.project.sketchSubmission ? { ...state.project.sketchSubmission, status: "committed" as const } : state.project.sketchSubmission, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, wholeLevelState: "editing", undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("composition_committed", { hypothesisId: hypothesis.id, compositionIntentId: committedCompositionIntent.id });
    logEvent("interpretation_committed", { hypothesisId: hypothesis.id, compositionIntentId: committedCompositionIntent.id });
  },
  generateAssetPlan: () => {
    const state = get();
    if (!state.project.committedCompositionIntent) return;
    const assetEditPlan = generateAssetEditPlan(state.project.committedCompositionIntent, state.project.sketchState);
    set({ project: { ...state.project, assetEditPlan, metadata: { ...state.project.metadata, updatedAt: Date.now() } } });
    logEvent("edit_plan_generated", { planId: assetEditPlan.id, operationCount: assetEditPlan.operations.length });
  },
  applyAssetPlan: () => {
    const state = get();
    const plan = state.project.assetEditPlan;
    if (!plan || plan.status !== "preview") return;
    const applied = { ...plan, status: "applied" as const, appliedAt: Date.now() };
    set({ project: { ...state.project, sketchState: applyAssetEditPlan(state.project.sketchState, plan), assetEditPlan: applied, appliedAssetEditPlans: [...state.project.appliedAssetEditPlans, applied], metadata: { ...state.project.metadata, updatedAt: Date.now() } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("edit_plan_applied", { planId: plan.id, operationCount: plan.operations.length });
  },
  rejectAssetPlan: () => {
    const state = get();
    if (!state.project.assetEditPlan) return;
    set({ project: { ...state.project, assetEditPlan: { ...state.project.assetEditPlan, status: "rejected" } } });
    logEvent("edit_plan_rejected", { planId: state.project.assetEditPlan.id });
  },
  loadV4DemoScene: (demo) => {
    const base = createEmptyProject();
    const positions: Record<string, Point> = {
      watchtower: { x: 430, y: 210, time: Date.now() },
      barricade: { x: 474, y: 255, time: Date.now() },
      stone_stair: { x: 260, y: 330, time: Date.now() },
      enemy_shrine: { x: 440, y: 270, time: Date.now() },
      reward_chest: { x: 650, y: 330, time: Date.now() },
      gate: { x: 460, y: 255, time: Date.now() },
      bridge: { x: 290, y: 315, time: Date.now() },
      healing_shrine: { x: 535, y: 250, time: Date.now() },
    };
    const ids = demo === "high-ground" ? ["watchtower", "barricade", "stone_stair", "enemy_shrine", "reward_chest"] : demo === "gated-recovery" ? ["gate", "healing_shrine", "bridge"] : ["bridge", "reward_chest", "barricade"];
    const assetInstances = ids.map((assetDefinitionId) => { const definition = mockAssetLibrary.find((item)=>item.id===assetDefinitionId)!; return { id: `AI-${assetDefinitionId}`, assetDefinitionId, position: positions[assetDefinitionId], rotation: 0, scale: 1, movementBehavior: defaultMovementBehavior(definition), collisionFootprintScale: 1, locked: false, preserve: false, roleAssignments: [], createdAt: Date.now() }; });
    const loop = { id: "SM-demo-loop", kind: "loop" as const, points: [{ x: 385, y: 175, time: Date.now() }, { x: 535, y: 190, time: Date.now() }, { x: 540, y: 315, time: Date.now() }, { x: 380, y: 310, time: Date.now() }, { x: 385, y: 175, time: Date.now() }], createdAt: Date.now() };
    const arrow = { id: "SM-demo-arrow", kind: "arrow" as const, points: [{ x: 290, y: 320, time: Date.now() }, { x: 415, y: 225, time: Date.now() }], createdAt: Date.now() };
    const marks = demo === "high-ground" ? [loop, arrow] : [loop];
    const relations = demo === "high-ground" ? [{ id: "SR-demo-stair-tower", sourceId: "AI-stone_stair", targetId: "AI-watchtower", relationType: "related_to" as const, directed: true }] : [];
    const selection = demo === "high-ground" ? ["AI-watchtower", "AI-barricade", "AI-enemy_shrine", "AI-stone_stair", "SM-demo-loop", "SM-demo-arrow"] : assetInstances.map((asset) => asset.id).concat(marks.map((mark) => mark.id));
    const baseMap = assetInstances.reduce((current,asset)=>synchronizeAssetMovement(current,asset,mockAssetLibrary.find((item)=>item.id===asset.assetDefinitionId)!),base.baseMap);
    const project = { ...base, baseMap, name: demo === "high-ground" ? "Demo A - High-Ground Encounter" : demo === "gated-recovery" ? "Demo B - Gated Recovery Area" : "Demo C - Optional Detour", sketchState: { ...base.sketchState, assetInstances, marks, relations }, sketchSelection: { ids: selection }, wholeLevelState: "editing" as const, semanticDimensions: {}, validationIssues: [] };
    set({ project, selected: null, editorMode: "intent", editorSubmode: "inspect", wholeLevelState: "editing", generationContract: null, validationIssues: [], modelStatus: "idle", modelError: null, modelSource: "demo", undoHistory: [], redoHistory: [] });
    logEvent("asset_instance_created", { demo, count: assetInstances.length });
  },
  answerClarificationRequest: (requestId, optionId, freeText) => {
    const state = get();
    if (!state.project.candidateIntent) return;
    const answer: ClarificationAnswer = { requestId, optionId, freeText, answeredAt: Date.now() };
    const baseCandidate = answerClarification(state.project.candidateIntent, answer);
    const wantsRecovery = optionId === "recovery-area" || optionId === "AI-sketch-relief" || /recovery|relief/i.test(freeText ?? "");
    const candidateIntent = wantsRecovery ? {
      ...baseCandidate,
      interpretations: baseCandidate.interpretations.map((interpretation) => requestId.includes("region") || interpretation.id === "AI-sketch-1" ? { ...interpretation, semanticSummary: "Recovery pocket connected to the main route", confidence: Math.max(interpretation.confidence, 0.82), effects: { recovery: 0.85, spatialOpenness: 0.65, encounterIntensity: -0.65, resourceDensity: 0.2 } } : interpretation),
      authoringIntent: {
        ...baseCandidate.authoringIntent,
        intents: baseCandidate.authoringIntent.intents.map((intent) => intent.kind === "experience" ? { ...intent, semanticLabel: "relief" as const, effects: { recovery: 0.85, spatialOpenness: 0.65, encounterIntensity: -0.65, resourceDensity: 0.2 } } : intent),
      },
    } : baseCandidate;
    set({ project: { ...state.project, candidateIntent } });
    logEvent("clarification_answered", { requestId, optionId, freeText, timeToAnswer: answer.answeredAt - state.project.candidateIntent.metadata.createdAt });
  },
  commitCandidate: () => {
    const state = get();
    const candidate = state.project.candidateIntent;
    if (!candidate) return;
    const committedIntent = commitCandidateIntent(candidate);
    const constraints = intentToConstraints(committedIntent.authoringIntent, state.project.strokes, candidate.interpretations);
    const conflicts = [...detectConflicts(state.project.strokes, constraints), ...candidate.conflicts];
    set({ project: { ...state.project, committedIntent, authoringIntent: committedIntent.authoringIntent, constraints, conflicts, lastInterpretationResult: { ...candidate, derivedConstraints: constraints, conflicts }, candidateIntent: { ...candidate, status: "committed" }, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("intent_committed", { candidateId: candidate.id, clarificationCount: candidate.clarificationAnswers.length });
  },
  confirmCandidateConvention: (scope = "project") => {
    const state = get();
    const candidate = state.project.candidateIntent;
    if (!candidate?.candidateConvention) return;
    const sketchIds = candidate.candidateConvention.sketchIds;
    const existing = candidate.candidateConvention.matchedConventionId ? state.project.conventions.find((entry) => entry.id === candidate.candidateConvention?.matchedConventionId) : undefined;
    const conventions = existing
      ? state.project.conventions.map((entry) => entry.id === existing.id ? confirmConvention(entry, sketchIds) : entry)
      : [...state.project.conventions, createConventionEntry(buildSketchPatternSignature(state.project.sketchState, sketchIds), candidate.candidateConvention.inferredMeaning, candidate.candidateConvention.humanReadableLabel, sketchIds, scope)];
    set({ project: { ...state.project, conventions } });
    logEvent(existing ? "convention_reused" : "convention_confirmed", { sketchIds, scope, matchedConventionId: existing?.id });
  },
  rejectCandidateConvention: () => {
    const state = get();
    const proposal = state.project.candidateIntent?.candidateConvention;
    if (!proposal) return;
    const conventions = proposal.matchedConventionId ? state.project.conventions.map((entry) => entry.id === proposal.matchedConventionId ? rejectConvention(entry) : entry) : state.project.conventions;
    set({ project: { ...state.project, conventions, candidateIntent: state.project.candidateIntent ? { ...state.project.candidateIntent, candidateConvention: undefined } : null } });
    logEvent("convention_rejected", { sketchIds: proposal.sketchIds, matchedConventionId: proposal.matchedConventionId });
  },
  startRepair: (layer) => {
    const state = get();
    const item = { id: `RP-${nanoid(5)}`, layer, summary: `Repair started at ${layer} layer`, createdAt: Date.now() };
    set({ project: { ...state.project, repairHistory: [...state.project.repairHistory, item] } });
    logEvent("repair_started", { layer });
    logEvent("repair_layer_selected", { layer });
  },
  setShowField: (showField) => set({ showField }),
  setBrushWidth: (brushWidth) => set({ brushWidth }),
  setBrushIntensity: (brushIntensity) => set({ brushIntensity }),
  addStroke: (type, points) => {
    const state = get();
    const stroke: Stroke = { id: `S-${nanoid(5)}`, type, points: simplifyStroke(points, 2.5), width: state.brushWidth, intensity: state.brushIntensity, enabled: true, createdAt: Date.now() };
    const strokes = [...state.project.strokes, stroke];
    set({ project: { ...state.project, strokes, sketchState: createSketchStateFromStrokes(strokes), metadata: { ...state.project.metadata, updatedAt: Date.now() } }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], selected: { kind: "stroke", id: stroke.id } });
    logEvent("stroke_created", { strokeId: stroke.id, strokeType: stroke.type });
  },
  select: (selected) => set({ selected }),
  updateSelectedStroke: (patch) => {
    const state = get();
    if (state.selected?.kind !== "stroke") return;
    set({ project: { ...state.project, strokes: state.project.strokes.map((stroke) => (stroke.id === state.selected?.id ? { ...stroke, ...patch } : stroke)) }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("stroke_modified", { strokeId: state.selected.id, patch });
  },
  updateConstraint: (id, patch) => {
    const state = get();
    set({ project: { ...state.project, constraints: state.project.constraints.map((constraint) => constraint.id === id ? { ...constraint, ...patch, userAdjusted: true } : constraint) }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
    logEvent("interpretation_adjusted", { constraintId: id, patch });
  },
  resetConstraint: (id) => {
    const state = get();
    const compiled = compileConstraints(state.project.strokes).find((constraint) => constraint.id === id);
    if (!compiled) return;
    set({ project: { ...state.project, constraints: state.project.constraints.map((constraint) => constraint.id === id ? compiled : constraint) }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
  },
  deleteStroke: (id) => {
    const state = get();
    const strokes = state.project.strokes.filter((stroke) => stroke.id !== id);
    set({ project: { ...state.project, strokes, sketchState: createSketchStateFromStrokes(strokes), constraints: [], conflicts: [], variants: [], activeVariantId: null, workingVariantId: null }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], selected: null });
    logEvent("stroke_deleted", { strokeId: id });
  },
  eraseAt: (point) => {
    const state = get();
    const target = state.project.strokes.find((stroke) => pointNearStroke(point, stroke));
    if (target) get().deleteStroke(target.id);
  },
  clearStrokes: () => {
    const state = get();
    set({ project: { ...state.project, strokes: [], sketchState: createSketchStateFromStrokes([]), constraints: [], conflicts: [], variants: [], activeVariantId: null, workingVariantId: null }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], selected: null });
  },
  compileIntent: () => {
    const state = get();
    if (v4Mode(state.project.researchMode)) {
      get().interpretTogether();
      return;
    }
    const hasSketch = state.project.strokes.length > 0 || state.project.sketchState.marks.length > 0 || state.project.sketchState.objects.length > 0;
    if (!hasSketch) return;
    logEvent("compile_requested", { researchMode: state.project.researchMode, interpretationMode: state.project.interpretationMode, textInstructionLength: state.project.textInstruction.length });
    const input = { strokes: state.project.strokes, sketchState: state.project.sketchState, textInstruction: state.project.textInstruction, currentLevelContext: { activeVariantId: state.project.activeVariantId, workingVariantId: state.project.workingVariantId, variants: state.project.variants } };
    const result = state.project.interpretationMode === "ai" ? interpretMockAISync(input) : interpretRuleBasedSync(input);
    const constraints = result.derivedConstraints;
    const conflicts = [...detectConflicts(state.project.strokes, constraints), ...result.conflicts];
    const comparison = {
      ruleBased: interpretRuleBasedSync({ strokes: state.project.strokes, textInstruction: state.project.textInstruction }),
      ai: interpretMockAISync({ strokes: state.project.strokes, textInstruction: state.project.textInstruction, currentLevelContext: { activeVariantId: state.project.activeVariantId, workingVariantId: state.project.workingVariantId, variants: state.project.variants } }),
    };
    if (state.project.researchMode === "c3-ai-negotiable") {
      const candidate = createCandidateIntent({ ...result, conflicts }, state.project.sketchState);
      const selectedIds = state.project.sketchSelection.ids.length > 0 ? state.project.sketchSelection.ids : [...state.project.sketchState.marks.map((mark) => mark.id), ...state.project.sketchState.objects.map((object) => object.id), ...state.project.sketchState.relations.map((relation) => relation.id)];
      const matchedConvention = findMatchingConvention(state.project.conventions, state.project.sketchState, selectedIds);
      const candidateConvention = matchedConvention
        ? { sketchIds: selectedIds, inferredMeaning: matchedConvention.entry.semanticMeaning, matchedConventionId: matchedConvention.entry.id, proposalType: "reuse_existing" as const, humanReadableLabel: matchedConvention.entry.humanReadableLabel }
        : selectedIds.length >= 2 ? { sketchIds: selectedIds, inferredMeaning: candidate.authoringIntent.intents[0], proposalType: "new_convention" as const, humanReadableLabel: candidate.interpretations[0]?.semanticSummary ?? "Reusable sketch expression" } : undefined;
      const nextCandidate = { ...candidate, candidateConvention };
      set({ project: { ...state.project, constraints: [], conflicts, candidateIntent: nextCandidate, authoringIntent: null, committedIntent: null, lastInterpretationResult: { ...result, conflicts }, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, comparisonResult: comparison, editorMode: "review" });
      logEvent("interpretation_candidate_created", { candidateId: nextCandidate.id, clarificationCount: nextCandidate.clarificationRequests.length });
      nextCandidate.clarificationRequests.forEach((request) => {
        logEvent("clarification_triggered", { reason: request.reason, targetSketchIds: request.targetSketchIds, candidateInterpretations: nextCandidate.interpretations.map((item) => item.semanticSummary), modelConfidence: nextCandidate.metadata.confidence });
        logEvent("clarification_shown", { requestId: request.id, reason: request.reason, targetSketchIds: request.targetSketchIds });
      });
      if (candidateConvention) logEvent("convention_proposed", { proposalType: candidateConvention.proposalType, sketchIds: candidateConvention.sketchIds, matchedConventionId: candidateConvention.matchedConventionId });
    } else {
      const committedIntent = commitCandidateIntent(createCandidateIntent({ ...result, conflicts }, state.project.sketchState));
      set({ project: { ...state.project, constraints, conflicts, candidateIntent: state.project.researchMode === "c2-ai-opaque" ? null : createCandidateIntent({ ...result, conflicts }, state.project.sketchState), committedIntent, authoringIntent: result.authoringIntent, lastInterpretationResult: { ...result, conflicts }, metadata: { ...state.project.metadata, updatedAt: Date.now() } }, comparisonResult: comparison, editorMode: "review" });
    }
    logEvent("interpretation_returned", { interpretationMode: result.mode, interpretationCount: result.interpretations.length, conflictCount: conflicts.length, confidence: result.metadata.confidence });
  },
  generate: () => {
    const state = get();
    if (state.project.constraints.length === 0) return;
    logEvent("interpretation_accepted", { interpretationMode: state.project.interpretationMode, interpretationId: state.project.lastInterpretationResult?.authoringIntent.id });
    logEvent("generation_requested", { constraintCount: state.project.constraints.length, interpretationMode: state.project.interpretationMode });
    const constraints = state.project.constraints;
    const conflicts = detectConflicts(state.project.strokes, constraints);
    const variants = generateVariants(state.project.strokes, constraints, buildField(state.project), state.project.seed, state.project.metadata.canvasWidth, state.project.metadata.canvasHeight);
    const baseProject = { ...state.project, constraints, conflicts, variants, activeVariantId: variants[0]?.id ?? null, workingVariantId: variants[0]?.id ?? null };
    const revision = createRevision(baseProject, "Initial Generation", [], undefined);
    set({ project: { ...baseProject, revisions: [revision], activeRevisionId: revision.id }, editorMode: "level", editorSubmode: "compare", selected: null });
    variants.forEach((variant) => logEvent("variant_generated", { variantId: variant.id, strategy: variant.strategy, intentFit: variant.intentFit }));
  },
  regenerate: () => {
    const state = get();
    set({ project: { ...state.project, seed: state.project.seed + 1 } });
    get().generate();
  },
  setSeed: (seed) => set((state) => ({ project: { ...state.project, seed } })),
  setActiveVariant: (variantId) => {
    set((state) => ({ project: { ...state.project, activeVariantId: variantId }, selected: null, editorMode: "level" }));
    logEvent("variant_selected", { variantId, activeOnly: true });
  },
  setWorkingVariant: (variantId) => {
    set((state) => ({ project: { ...state.project, activeVariantId: variantId, workingVariantId: variantId }, selected: null, editorMode: "level", editorSubmode: "edit" }));
    logEvent("variant_selected", { variantId, working: true });
  },
  loadExample: () => {
    const base = createEmptyProject();
    const project = { ...base, strokes: createExampleStrokes() };
    const constraints = compileConstraints(project.strokes);
    const conflicts = detectConflicts(project.strokes, constraints);
    const interpretationResult = interpretRuleBasedSync({ strokes: project.strokes });
    const nextProject = { ...project, sketchState: createSketchStateFromStrokes(project.strokes), constraints, conflicts, authoringIntent: interpretationResult.authoringIntent, lastInterpretationResult: interpretationResult, wholeLevelState: "editing" as const, semanticDimensions: {}, validationIssues: [] };
    set({ project: nextProject, selected: null, editorMode: "review", editorSubmode: "inspect", wholeLevelState: "editing", generationContract: null, validationIssues: [], modelStatus: "idle", modelError: null, modelSource: "local-fallback", undoHistory: [], redoHistory: [], importError: null });
  },
  importJson: (text) => {
    const result = importProjectJson(text);
    if (!result.ok) set({ importError: result.error });
    else set({ project: result.project, selected: null, importError: null, wholeLevelState: result.project.wholeLevelState ?? "editing", generationContract: result.project.generationContract ?? null, validationIssues: result.project.validationIssues ?? [], modelStatus: "idle", modelError: null, modelSource: result.project.generationContract ? "model" : "local-fallback", undoHistory: [], redoHistory: [], editorMode: result.project.variants.length > 0 ? "level" : result.project.constraints.length > 0 ? "review" : "intent" });
  },
  beginRoomEdit: (variantId, roomId, patch, property) => {
    const state = get();
    const before = findRoom(state.project, variantId, roomId);
    if (!before) return;
    if ((before.role === "entrance" || before.role === "exit") && property === "role") return;
    const after = { ...before, ...patch };
    const edit = buildDraft(state.project, variantId, before, after, property);
    const scope = edit.inferredMeaning[0]?.recommendedScope ?? "instance";
    set({ draftRoomEdit: edit, pendingEditScope: scope, selectedEditInterpretation: edit.inferredMeaning[0]?.id ?? null, impactPreview: buildImpactPreview(state.project, edit, scope), selected: { kind: "room", variantId, id: roomId }, editorSubmode: "edit" });
  },
  updateDraftScope: (scope) => {
    const state = get();
    if (!state.draftRoomEdit) return;
    set({ pendingEditScope: scope, impactPreview: buildImpactPreview(state.project, state.draftRoomEdit, scope) });
    logEvent("edit_scope_selected", { scope, editId: state.draftRoomEdit.id });
  },
  selectInterpretation: (id) => set({ selectedEditInterpretation: id }),
  applyDraftEdit: () => {
    const state = get();
    if (!state.draftRoomEdit) return;
    const beforeVariant = state.project.variants.find((variant) => variant.id === state.draftRoomEdit?.variantId);
    const nextProject = applyEdit(state.project, { ...state.draftRoomEdit, selectedInterpretationId: state.selectedEditInterpretation }, state.pendingEditScope);
    const afterVariant = nextProject.variants.find((variant) => variant.id === state.draftRoomEdit?.variantId);
    const shouldRevise = state.pendingEditScope !== "instance";
    const revision = shouldRevise ? createRevision(nextProject, `${state.draftRoomEdit.property} edit - ${state.pendingEditScope}`, [state.draftRoomEdit.id], state.pendingEditScope, beforeVariant?.intentFit, beforeVariant?.validation.reachable) : null;
    set({ project: revision ? { ...nextProject, revisions: [...nextProject.revisions, revision], activeRevisionId: revision.id } : nextProject, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], draftRoomEdit: null, impactPreview: null, selectedEditInterpretation: null, selected: { kind: "room", variantId: state.draftRoomEdit.variantId, id: state.draftRoomEdit.roomId }, editorMode: "level", editorSubmode: "inspect" });
    logEvent("edit_applied", { editId: state.draftRoomEdit.id, scope: state.pendingEditScope, roomId: state.draftRoomEdit.roomId });
    void afterVariant;
  },
  cancelDraftEdit: () => set({ draftRoomEdit: null, impactPreview: null, selectedEditInterpretation: null }),
  addOptionalRoom: () => {
    const state = get();
    const variant = activeVariant(state.project);
    if (!variant) return;
    const anchor = variant.rooms.find((room) => room.role !== "exit") ?? variant.rooms[0];
    const room: RoomNode = { id: `O${variant.rooms.length + 1}`, role: "reward", x: Math.min(860, anchor.x + 120), y: Math.min(500, anchor.y + 70), width: 58, height: 42, intensity: 0.2, sourceStrokeIds: [], sourceConstraintIds: [], manual: true, locked: false, resourceLevel: 0.7 };
    const edge = { id: `OE${variant.edges.length + 1}`, from: anchor.id, to: room.id, role: "optional" as const, risk: 0.2, sourceStrokeIds: [], sourceConstraintIds: [] };
    const nextVariants = state.project.variants.map((item) => item.id === variant.id ? { ...item, rooms: [...item.rooms, room], edges: [...item.edges, edge], modified: true } : item);
    set({ project: { ...state.project, variants: nextVariants }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], selected: { kind: "room", variantId: variant.id, id: room.id } });
  },
  deleteOptionalRoom: (variantId, roomId) => {
    const state = get();
    const variant = state.project.variants.find((item) => item.id === variantId);
    const room = variant?.rooms.find((item) => item.id === roomId);
    if (!variant || !room || room.role === "entrance" || room.role === "exit") return;
    const mainEdges = variant.edges.filter((edge) => edge.role === "main" && (edge.from === roomId || edge.to === roomId));
    if (mainEdges.length > 0) return;
    const nextVariants = state.project.variants.map((item) => item.id === variantId ? { ...item, rooms: item.rooms.filter((candidate) => candidate.id !== roomId), edges: item.edges.filter((edge) => edge.from !== roomId && edge.to !== roomId), modified: true } : item);
    set({ project: { ...state.project, variants: nextVariants }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [], selected: null });
  },
  restoreRoomGenerated: (variantId, roomId) => {
    const state = get();
    const regenerated = generateVariants(state.project.strokes, state.project.constraints, buildField(state.project), state.project.seed, state.project.metadata.canvasWidth, state.project.metadata.canvasHeight).find((variant) => variant.id === variantId);
    const source = regenerated?.rooms.find((room) => room.id === roomId);
    if (!source) return;
    set({ project: { ...state.project, variants: state.project.variants.map((variant) => variant.id === variantId ? { ...variant, rooms: variant.rooms.map((room) => room.id === roomId ? source : room) } : variant), manualOverrides: state.project.manualOverrides.filter((override) => override.roomId !== roomId) }, undoHistory: commit(state.project, state.undoHistory), redoHistory: [] });
  },
  createManualRevision: () => {
    const state = get();
    const revision = createRevision(state.project, "Saved Revision", [], undefined);
    set({ project: { ...state.project, revisions: [...state.project.revisions, revision], activeRevisionId: revision.id } });
  },
  restoreDesignRevision: (revisionId) => {
    const state = get();
    const revision = state.project.revisions.find((item) => item.id === revisionId);
    if (!revision) return;
    set({ project: restoreRevision(state.project, revision), selected: null });
  },
  startPlaytest: () => {
    const state = get();
    const variant = activeVariant(state.project);
    if (!variant) return;
    const { session, event } = createPlaytestSession(variant, Date.now());
    set({ playtestSession: session, project: { ...state.project, playtestSessions: [...state.project.playtestSessions, session], playtestEvents: [...state.project.playtestEvents, event], activeVariantId: variant.id, workingVariantId: variant.id }, editorMode: "playtest" });
    logEvent("playtest_started", { sessionId: session.id, variantId: variant.id });
  },
  enterPlaytestRoom: (roomId) => {
    const state = get();
    const variant = activeVariant(state.project);
    if (!variant || !state.playtestSession) return;
    const result = enterRoom(state.playtestSession, variant, roomId, Date.now());
    set({ playtestSession: result.session, project: { ...state.project, playtestSessions: state.project.playtestSessions.map((session) => session.id === result.session.id ? result.session : session), playtestEvents: [...state.project.playtestEvents, result.event] } });
  },
  markFeedback: (category, note) => {
    const state = get();
    const variant = activeVariant(state.project);
    if (!variant || !state.playtestSession) return;
    const feedback = createFeedback(state.playtestSession, variant.id, category, note, Date.now());
    const event = { id: `PE-${nanoid(5)}`, sessionId: state.playtestSession.id, variantId: variant.id, type: "feedback" as const, roomId: state.playtestSession.currentRoomId ?? undefined, timestamp: Date.now(), elapsedMs: Date.now() - state.playtestSession.startedAt };
    set({ project: { ...state.project, experienceFeedback: [...state.project.experienceFeedback, feedback], playtestEvents: [...state.project.playtestEvents, event] } });
    logEvent("feedback_submitted", { category, roomId: feedback.roomId, sessionId: feedback.sessionId });
  },
  createEditFromSuggestion: (change) => {
    const state = get();
    const variant = activeVariant(state.project);
    if (!variant || change.entityType !== "room") return;
    const room = variant.rooms.find((item) => item.id === change.entityId);
    if (!room) return;
    if (change.property === "intensity") get().beginRoomEdit(variant.id, room.id, { intensity: Number(change.after) }, "intensity");
    if (change.property === "width") get().beginRoomEdit(variant.id, room.id, { width: Number(change.after) }, "size");
  },
  runInterpretationComparison: () => {
    const state = get();
    const ruleBased = interpretRuleBasedSync({ strokes: state.project.strokes, textInstruction: state.project.textInstruction });
    const ai = interpretMockAISync({ strokes: state.project.strokes, textInstruction: state.project.textInstruction, currentLevelContext: { activeVariantId: state.project.activeVariantId, workingVariantId: state.project.workingVariantId, variants: state.project.variants } });
    set({ comparisonResult: { ruleBased, ai } });
  },
  exportResearchLogJson: () => exportResearchLog(get().researchLog),
  exportTrainingExampleJson: () => {
    const state = get();
    const comparison = state.comparisonResult ?? { ruleBased: interpretRuleBasedSync({ strokes: state.project.strokes, textInstruction: state.project.textInstruction }), ai: interpretMockAISync({ strokes: state.project.strokes, textInstruction: state.project.textInstruction }) };
    return JSON.stringify(buildTrainingExample(state.project, comparison.ruleBased, comparison.ai), null, 2);
  },
  getResearchMetrics: () => calculateResearchMetrics(get().researchLog),
  dismissOnboarding: () => set({ onboardingDismissed: true }),
  undo: () => {
    const state = get();
    const previous = state.undoHistory[state.undoHistory.length - 1];
    if (!previous) return;
    set({ project: previous, wholeLevelState: previous.wholeLevelState ?? "editing", generationContract: previous.generationContract ?? null, validationIssues: previous.validationIssues ?? [], undoHistory: state.undoHistory.slice(0, -1), redoHistory: [...state.redoHistory, snapshot(state.project)], selected: null, draftRoomEdit: null, impactPreview: null });
    logEvent("undo");
  },
  redo: () => {
    const state = get();
    const next = state.redoHistory[state.redoHistory.length - 1];
    if (!next) return;
    set({ project: next, wholeLevelState: next.wholeLevelState ?? "editing", generationContract: next.generationContract ?? null, validationIssues: next.validationIssues ?? [], redoHistory: state.redoHistory.slice(0, -1), undoHistory: [...state.undoHistory, snapshot(state.project)], selected: null });
    logEvent("redo");
  },
  });
});
