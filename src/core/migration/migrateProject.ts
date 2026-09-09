import type { WorldloomProject } from "../types";

import {
  createSketchStateFromStrokes,
  emptySketchState,
} from "../sketch/adaptLegacyStrokes";

import {
  createEmptyGameplayGraph,
} from "../gameplay/types";

import type {
  GameplayGraph,
} from "../gameplay/types";

import {
  defaultGenerativeFreedom,
  defaultToleranceForProperty,
} from "../constraints/spatialConstraintModel";

import type {
  ExperienceDimension,
  ExperienceLayer,
  GameplayLayer,
  GameplayNegotiationState,
  SceneLayer,
  SharedExperienceGoal,
  SharedLevelDesignState,
  SharedSceneElement,
  SharedSpatialConstraint,
  SpatialLayer,
  SpatialTolerance,
} from "../shared-state/types";

const defaultMetadata = {
  canvasWidth: 960,
  canvasHeight: 560,
  updatedAt: Date.now(),
};

const currentProjectVersion = "5.0.0";

function normalizeSketchState(
  project: Partial<WorldloomProject>,
): WorldloomProject["sketchState"] {
  const base = project.strokes
    ? createSketchStateFromStrokes(project.strokes)
    : emptySketchState();

  const sketch = project.sketchState as
    | Partial<WorldloomProject["sketchState"]>
    | undefined;

  if (!sketch) return base;

  return {
    assetInstances:
      sketch.assetInstances ?? [],

    rawStrokes:
      sketch.rawStrokes ?? [],

    gestureCandidates:
      sketch.gestureCandidates ?? [],

    episodes:
      sketch.episodes ?? [],

    marks:
      sketch.marks ?? base.marks,

    objects:
      sketch.objects ?? [],

    relations:
      sketch.relations ?? [],

    annotations:
      sketch.annotations ?? [],

    groups:
      sketch.groups ?? [],

    utterances:
      sketch.utterances ?? [],
  };
}

function normalizeGraphValue(
  value:
    | Partial<GameplayGraph>
    | undefined,
): GameplayGraph {
  if (!value) {
    return createEmptyGameplayGraph();
  }

  return {
    schemaVersion: "1.0",

    nodes:
      Array.isArray(value.nodes)
        ? value.nodes
        : [],

    relations:
      Array.isArray(value.relations)
        ? value.relations
        : [],

    routes:
      Array.isArray(value.routes)
        ? value.routes
        : [],
  };
}

function normalizeGameplayGraph(
  project: Partial<WorldloomProject>,
): GameplayGraph {
  const sharedGraph =
    project.sharedLevelDesignState
      ?.gameplay?.graph as
      | Partial<GameplayGraph>
      | undefined;

  const legacyGraph =
    project.gameplayGraph as
      | Partial<GameplayGraph>
      | undefined;

  return normalizeGraphValue(
    sharedGraph ?? legacyGraph,
  );
}

function importedProvenance(
  sourceIds: string[],
  updatedAt: number,
) {
  return {
    source: "imported" as const,

    sourceIds,

    explanation:
      "Migrated from an earlier Worldloom project structure.",

    updatedAt,
  };
}

function deriveSceneElements(
  sketch:
    WorldloomProject["sketchState"],
  updatedAt: number,
): SharedSceneElement[] {
  const elements =
    new Map<
      string,
      SharedSceneElement
    >();

  for (
    const asset
    of sketch.assetInstances
  ) {
    elements.set(
      asset.id,
      {
        id: asset.id,

        type: "asset",

        name:
          asset.assetDefinitionId,

        assetDefinitionId:
          asset.assetDefinitionId,

        sourceRef:
          asset.sourceAssetRef,

        transform: {
          position: {
            x: asset.position.x,
            y: asset.position.y,
          },

          rotation:
            asset.rotation,

          scale:
            asset.scale ?? 1,
        },

        semanticRoles: [
          ...asset.roleAssignments,
        ],

        preserved:
          Boolean(
            asset.preserve ||
            asset.locked,
          ),

        status: "committed",

        provenance:
          importedProvenance(
            [asset.id],
            updatedAt,
          ),
      },
    );
  }

  for (
    const object
    of sketch.objects
  ) {
    if (
      elements.has(object.id)
    ) {
      continue;
    }

    elements.set(
      object.id,
      {
        id:
          object.id,

        type:
          object.assetRef
            ? "asset"
            : "placeholder",

        name:
          object.label ??
          String(
            object.objectType,
          ),

        sourceRef:
          object.assetRef,

        transform: {
          position: {
            x:
              object.position.x,

            y:
              object.position.y,
          },

          rotation: 0,

          scale: 1,
        },

        semanticRoles:
          object.gameplayNodeType
            ? [
                object.gameplayNodeType,
              ]
            : [
                String(
                  object.objectType,
                ),
              ],

        preserved: false,

        status:
          object.gameplayNodeId
            ? "committed"
            : "candidate",

        provenance:
          importedProvenance(
            [object.id],
            updatedAt,
          ),
      },
    );
  }

  return [
    ...elements.values(),
  ];
}

function normalizeTolerance(
  constraint:
    SharedSpatialConstraint,
):
  | number
  | SpatialTolerance
  | undefined {
  if (
    constraint.mode !==
    "approximate"
  ) {
    return undefined;
  }

  if (
    constraint.tolerance !==
    undefined
  ) {
    return constraint.tolerance;
  }

  return defaultToleranceForProperty(
    constraint.property,
    constraint.unit,
  );
}

function normalizeSpatialConstraint(
  constraint:
    SharedSpatialConstraint,
): SharedSpatialConstraint {
  return {
    ...constraint,

    tolerance:
      normalizeTolerance(
        constraint,
      ),

    generativeFreedom:
      constraint.mode === "exact"
        ? 0
        : constraint.mode === "free"
          ? 1
          : constraint
              .generativeFreedom ??
            defaultGenerativeFreedom(
              constraint.mode,
            ),

    preserveOnRegeneration:
      constraint.mode === "exact"
        ? true
        : constraint.mode === "free"
          ? false
          : constraint
              .preserveOnRegeneration ??
            false,

    enabled:
      constraint.enabled ??
      true,

    status:
      constraint.status ??
      "committed",
  };
}

function deriveSpatialConstraints(
  sketch:
    WorldloomProject["sketchState"],
  updatedAt: number,
): SharedSpatialConstraint[] {
  const constraints:
    SharedSpatialConstraint[] = [];

  for (
    const asset
    of sketch.assetInstances
  ) {
    if (
      asset.preserve ||
      asset.doNotReplace
    ) {
      constraints.push(
        normalizeSpatialConstraint(
          {
            id:
              `SC-${asset.id}-identity`,

            targetElementId:
              asset.id,

            property:
              "identity",

            mode:
              "exact",

            value:
              asset.assetDefinitionId,

            enabled: true,

            status:
              "committed",

            provenance:
              importedProvenance(
                [asset.id],
                updatedAt,
              ),
          },
        ),
      );
    }

    if (asset.locked) {
      constraints.push(
        normalizeSpatialConstraint(
          {
            id:
              `SC-${asset.id}-position`,

            targetElementId:
              asset.id,

            property:
              "position",

            mode:
              "exact",

            value: {
              x:
                asset.position.x,

              y:
                asset.position.y,
            },

            enabled: true,

            status:
              "committed",

            provenance:
              importedProvenance(
                [asset.id],
                updatedAt,
              ),
          },
        ),
      );
    }
  }

  return constraints;
}

function inferExperienceDimension(
  text: string,
): ExperienceDimension {
  const normalized =
    text.toLowerCase();

  if (
    /relief|recovery|rest|calm/.test(
      normalized,
    )
  ) {
    return "relief";
  }

  if (
    /pressure/.test(
      normalized,
    )
  ) {
    return "pressure";
  }

  if (
    /tension|risk/.test(
      normalized,
    )
  ) {
    return "tension";
  }

  if (
    /challenge|combat|encounter/.test(
      normalized,
    )
  ) {
    return "challenge";
  }

  if (
    /explor|discover/.test(
      normalized,
    )
  ) {
    return "exploration";
  }

  if (
    /choice|branch|optional/.test(
      normalized,
    )
  ) {
    return "choice";
  }

  if (
    /climax|boss|final/.test(
      normalized,
    )
  ) {
    return "climax";
  }

  if (
    /orient|introduc|entry/.test(
      normalized,
    )
  ) {
    return "orientation";
  }

  return "pacing";
}

function deriveExperienceGoals(
  project:
    Partial<WorldloomProject>,
  updatedAt: number,
): SharedExperienceGoal[] {
  const descriptions =
    project
      .committedCompositionIntent
      ?.experientialGoals ??
    [];

  return descriptions.map(
    (
      description,
      index,
    ) => ({
      id:
        `EG-migrated-${index + 1}`,

      dimension:
        inferExperienceDimension(
          description,
        ),

      description,

      order:
        index,

      targetGameplayNodeIds:
        [],

      status:
        "committed",

      provenance:
        importedProvenance(
          project
            .committedCompositionIntent
            ? [
                project
                  .committedCompositionIntent
                  .id,
              ]
            : [],
          updatedAt,
        ),
    }),
  );
}

function normalizeNegotiationState(
  gameplay:
    Partial<GameplayLayer>
      | undefined,
): GameplayNegotiationState {
  const negotiation =
    gameplay?.negotiation;

  return {
    candidates:
      Array.isArray(
        negotiation?.candidates,
      )
        ? negotiation.candidates
        : [],

    selectedCandidateId:
      negotiation
        ?.selectedCandidateId ??
      null,

    committedCandidateIds:
      Array.isArray(
        negotiation
          ?.committedCandidateIds,
      )
        ? negotiation
            .committedCandidateIds
        : [],
  };
}

function normalizeSharedLevelDesignState(
  project:
    Partial<WorldloomProject>,

  sketch:
    WorldloomProject["sketchState"],

  gameplayGraph:
    GameplayGraph,

  updatedAt:
    number,
): SharedLevelDesignState {
  const existing =
    project
      .sharedLevelDesignState as
      | Partial<
          SharedLevelDesignState
        >
      | undefined;

  const existingScene =
    existing?.scene as
      | Partial<SceneLayer>
      | undefined;

  const existingSpatial =
    existing?.spatial as
      | Partial<SpatialLayer>
      | undefined;

  const existingGameplay =
    existing?.gameplay as
      | Partial<GameplayLayer>
      | undefined;

  const existingExperience =
    existing?.experience as
      | Partial<ExperienceLayer>
      | undefined;

  const constraints =
    Array.isArray(
      existingSpatial
        ?.constraints,
    )
      ? existingSpatial
          .constraints
          .map(
            normalizeSpatialConstraint,
          )
      : deriveSpatialConstraints(
          sketch,
          updatedAt,
        );

  return {
    schemaVersion:
      "1.0",

    revision:
      typeof existing
        ?.revision ===
      "number"
        ? existing.revision
        : 0,

    scene: {
      worldSetting:
        existingScene
          ?.worldSetting ??
        "",

      elements:
        Array.isArray(
          existingScene
            ?.elements,
        )
          ? existingScene
              .elements
          : deriveSceneElements(
              sketch,
              updatedAt,
            ),

      backgroundElementId:
        existingScene
          ?.backgroundElementId,
    },

    spatial: {
      constraints,

      lastObservations:
        Array.isArray(
          existingSpatial
            ?.lastObservations,
        )
          ? existingSpatial
              .lastObservations
          : [],
    },

    gameplay: {
      graph:
        gameplayGraph,

      negotiation:
        normalizeNegotiationState(
          existingGameplay,
        ),

      validation:
        existingGameplay
          ?.validation ??
        null,

      repairs:
        Array.isArray(
          existingGameplay
            ?.repairs,
        )
          ? existingGameplay
              .repairs
          : [],
    },

    experience: {
      goals:
        Array.isArray(
          existingExperience
            ?.goals,
        )
          ? existingExperience
              .goals
          : deriveExperienceGoals(
              project,
              updatedAt,
            ),

      summary:
        existingExperience
          ?.summary ??
        "",
    },

    updatedAt:
      typeof existing
        ?.updatedAt ===
      "number"
        ? existing.updatedAt
        : updatedAt,
  };
}

function withCurrentDefaults(
  project:
    Partial<WorldloomProject>,
): WorldloomProject {
  const metadata =
    project.metadata ?? {
      ...defaultMetadata,
      updatedAt:
        Date.now(),
    };

  const sketchState =
    normalizeSketchState(
      project,
    );

  const gameplayGraph =
    normalizeGameplayGraph(
      project,
    );

  const sharedLevelDesignState =
    normalizeSharedLevelDesignState(
      project,
      sketchState,
      gameplayGraph,
      metadata.updatedAt,
    );

  return {
    name:
      project.name ??
      "Worldloom Project",

    projectId:
      project.projectId ??
      `project-${Date.now()}`,

    version:
      currentProjectVersion,

    researchMode:
      project.researchMode ??
      (
        project.interpretationMode ===
        "ai"
          ? "c3-ai-negotiable"
          : "c1-rule-based"
      ),

    interpretationMode:
      project
        .interpretationMode ??
      "rule-based",

    textInstruction:
      project
        .textInstruction ??
      "",

    gameplayGraph:
      sharedLevelDesignState
        .gameplay.graph,

    sharedLevelDesignState,

    sketchState,

    sketchSelection:
      project
        .sketchSelection ??
      {
        ids: [],
      },

    candidateIntent:
      project
        .candidateIntent ??
      null,

    committedIntent:
      project
        .committedIntent ??
      null,

    authoringIntent:
      project
        .authoringIntent ??
      null,

    lastInterpretationResult:
      project
        .lastInterpretationResult ??
      null,

    compositionHypothesis:
      project
        .compositionHypothesis ??
      null,

    committedCompositionIntent:
      project
        .committedCompositionIntent ??
      null,

    assetEditPlan:
      project
        .assetEditPlan ??
      null,

    appliedAssetEditPlans:
      project
        .appliedAssetEditPlans ??
      [],

    conventions:
      project
        .conventions ??
      [],

    repairHistory:
      project
        .repairHistory ??
      [],

    strokes:
      project.strokes ??
      [],

    constraints:
      project.constraints ??
      [],

    conflicts:
      project.conflicts ??
      [],

    variants:
      project.variants ??
      [],

    activeVariantId:
      project
        .activeVariantId ??
      null,

    workingVariantId:
      project
        .workingVariantId ??
      project
        .activeVariantId ??
      null,

    seed:
      typeof project.seed ===
      "number"
        ? project.seed
        : 42017,

    metadata,

    manualOverrides:
      project
        .manualOverrides ??
      [],

    variantRuleOverrides:
      project
        .variantRuleOverrides ??
      [],

    globalDesignPreferences:
      project
        .globalDesignPreferences ??
      [],

    strokeInterpretationOverrides:
      project
        .strokeInterpretationOverrides ??
      [],

    editHistory:
      project
        .editHistory ??
      [],

    revisions:
      project
        .revisions ??
      [],

    activeRevisionId:
      project
        .activeRevisionId ??
      null,

    playtestSessions:
      project
        .playtestSessions ??
      [],

    playtestEvents:
      project
        .playtestEvents ??
      [],

    experienceFeedback:
      project
        .experienceFeedback ??
      [],
  };
}

export function migrateProject(
  input: unknown,
):
  | {
      ok: true;
      project:
        WorldloomProject;
    }
  | {
      ok: false;
      error: string;
    } {
  if (
    !input ||
    typeof input !==
      "object"
  ) {
    return {
      ok: false,

      error:
        "Project JSON must contain an object.",
    };
  }

  const parsed =
    input as
      Partial<WorldloomProject>;

  if (
    !Array.isArray(
      parsed.strokes,
    )
  ) {
    return {
      ok: false,

      error:
        "Project JSON is missing strokes.",
    };
  }

  if (
    typeof parsed.seed !==
    "number"
  ) {
    return {
      ok: false,

      error:
        "Project JSON is missing numeric seed.",
    };
  }

  const supportedVersions =
    new Set([
      "0.1.0",
      "2.0.0",
      "2.1.0",
      "4.0.0",
      "5.0.0",
      undefined,
    ]);

  if (
    supportedVersions.has(
      parsed.version,
    )
  ) {
    return {
      ok: true,

      project:
        withCurrentDefaults(
          parsed,
        ),
    };
  }

  return {
    ok: false,

    error:
      `Unsupported Worldloom version: ${String(
        parsed.version,
      )}.`,
  };
}