import type { WorldloomProject } from "../types";
import { createSketchStateFromStrokes, emptySketchState } from "../sketch/adaptLegacyStrokes";

const defaultMetadata = { canvasWidth: 960, canvasHeight: 560, updatedAt: Date.now() };

function normalizeSketchState(project: Partial<WorldloomProject>): WorldloomProject["sketchState"] {
  const base = project.strokes ? createSketchStateFromStrokes(project.strokes) : emptySketchState();
  const sketch = project.sketchState as Partial<WorldloomProject["sketchState"]> | undefined;
  if (!sketch) return base;
  return {
    assetInstances: sketch.assetInstances ?? [],
    rawStrokes: sketch.rawStrokes ?? [],
    semanticItems: sketch.semanticItems ?? [],
    gestureCandidates: sketch.gestureCandidates ?? [],
    episodes: sketch.episodes ?? [],
    marks: sketch.marks ?? base.marks,
    objects: sketch.objects ?? [],
    relations: sketch.relations ?? [],
    annotations: sketch.annotations ?? [],
    groups: sketch.groups ?? [],
    utterances: sketch.utterances ?? [],
  };
}

function withV2Defaults(project: Partial<WorldloomProject>): WorldloomProject {
  return {
    name: project.name ?? "Worldloom Project",
    projectId: project.projectId ?? `project-${Date.now()}`,
    version: "4.0.0",
    researchMode: project.researchMode ?? (project.interpretationMode === "ai" ? "c3-ai-negotiable" : "c1-rule-based"),
    interpretationMode: project.interpretationMode ?? "rule-based",
    textInstruction: project.textInstruction ?? "",
    sketchState: normalizeSketchState(project),
    sketchSelection: project.sketchSelection ?? { ids: [] },
    candidateIntent: project.candidateIntent ?? null,
    committedIntent: project.committedIntent ?? null,
    authoringIntent: project.authoringIntent ?? null,
    lastInterpretationResult: project.lastInterpretationResult ?? null,
    compositionHypothesis: project.compositionHypothesis ?? null,
    committedCompositionIntent: project.committedCompositionIntent ?? null,
    assetEditPlan: project.assetEditPlan ?? null,
    appliedAssetEditPlans: project.appliedAssetEditPlans ?? [],
    conventions: project.conventions ?? [],
    repairHistory: project.repairHistory ?? [],
    strokes: project.strokes ?? [],
    constraints: project.constraints ?? [],
    conflicts: project.conflicts ?? [],
    variants: project.variants ?? [],
    activeVariantId: project.activeVariantId ?? null,
    workingVariantId: project.workingVariantId ?? project.activeVariantId ?? null,
    seed: typeof project.seed === "number" ? project.seed : 42017,
    metadata: project.metadata ?? defaultMetadata,
    manualOverrides: project.manualOverrides ?? [],
    variantRuleOverrides: project.variantRuleOverrides ?? [],
    globalDesignPreferences: project.globalDesignPreferences ?? [],
    strokeInterpretationOverrides: project.strokeInterpretationOverrides ?? [],
    editHistory: project.editHistory ?? [],
    revisions: project.revisions ?? [],
    activeRevisionId: project.activeRevisionId ?? null,
    playtestSessions: project.playtestSessions ?? [],
    playtestEvents: project.playtestEvents ?? [],
    experienceFeedback: project.experienceFeedback ?? [],
    wholeLevelState: project.wholeLevelState ?? (project.generationContract ? "generated" : "editing"),
    semanticDimensions: project.semanticDimensions ?? {},
    sharedDesignState: project.sharedDesignState,
    validationIssues: project.validationIssues ?? [],
    generationContract: project.generationContract,
    hiddenSemanticItemIds: project.hiddenSemanticItemIds ?? [],
    worldSetting: project.worldSetting ?? { text: "", confirmed: false },
    sketchSubmission: project.sketchSubmission ?? { status: "draft" },
    mapUnderstandingLocked: project.mapUnderstandingLocked ?? false,
    mapUnderstandingSnapshot: project.mapUnderstandingSnapshot,
    mapLayers: project.mapLayers
      ? {
          ...project.mapLayers,
          editVisible: project.mapLayers.editVisible ?? project.mapLayers.sketchVisible ?? true,
        }
      : { baseMapVisible: false, editVisible: true, gameplayVisible: true, baseMapStatus: "not_generated" },
  };
}

export function migrateProject(input: unknown): { ok: true; project: WorldloomProject } | { ok: false; error: string } {
  if (!input || typeof input !== "object") return { ok: false, error: "Project JSON must contain an object." };
  const parsed = input as Partial<WorldloomProject>;
  if (!Array.isArray(parsed.strokes)) return { ok: false, error: "Project JSON is missing strokes." };
  if (typeof parsed.seed !== "number") return { ok: false, error: "Project JSON is missing numeric seed." };
  if (parsed.version === "0.1.0" || parsed.version === "2.0.0" || parsed.version === "4.0.0" || parsed.version === undefined) return { ok: true, project: withV2Defaults(parsed) };
  return { ok: false, error: `Unsupported Worldloom version: ${String(parsed.version)}.` };
}
