import type {
  Stroke,
  WorldloomProject,
} from "../core/types";
import { emptyBaseMapState } from "../core/baseMap";

import {
  emptySketchState,
} from "../core/sketch/adaptLegacyStrokes";

import {
  createEmptyGameplayGraph,
} from "../core/gameplay/types";

import {
  createEmptySharedLevelDesignState,
} from "../core/shared-state/sharedLevelDesignState";

const now = 1725000000000;

export function createExampleStrokes(): Stroke[] {
  return [
    {
      id: "S01",
      type: "flow",
      width: 7,
      intensity: 0.85,
      enabled: true,
      createdAt: now,

      points: [
        {
          x: 80,
          y: 295,
          time: now,
        },
        {
          x: 205,
          y: 250,
          time: now + 1,
        },
        {
          x: 360,
          y: 310,
          time: now + 2,
        },
        {
          x: 560,
          y: 260,
          time: now + 3,
        },
        {
          x: 735,
          y: 330,
          time: now + 4,
        },
        {
          x: 890,
          y: 285,
          time: now + 5,
        },
      ],
    },

    {
      id: "S02",
      type: "pressure",
      width: 24,
      intensity: 0.82,
      enabled: true,
      createdAt: now + 10,

      points: [
        {
          x: 330,
          y: 225,
          time: now,
        },
        {
          x: 430,
          y: 270,
          time: now + 1,
        },
        {
          x: 520,
          y: 315,
          time: now + 2,
        },
      ],
    },

    {
      id: "S03",
      type: "relief",
      width: 28,
      intensity: 0.78,
      enabled: true,
      createdAt: now + 20,

      points: [
        {
          x: 655,
          y: 260,
          time: now,
        },
        {
          x: 750,
          y: 225,
          time: now + 1,
        },
        {
          x: 835,
          y: 250,
          time: now + 2,
        },
      ],
    },

    {
      id: "S04",
      type: "branch",
      width: 10,
      intensity: 0.75,
      enabled: true,
      createdAt: now + 30,

      points: [
        {
          x: 380,
          y: 305,
          time: now,
        },
        {
          x: 460,
          y: 405,
          time: now + 1,
        },
        {
          x: 620,
          y: 390,
          time: now + 2,
        },
        {
          x: 720,
          y: 325,
          time: now + 3,
        },
      ],
    },
  ];
}

export function createEmptyProject(): WorldloomProject {
  const createdAt = Date.now();

  const gameplayGraph =
    createEmptyGameplayGraph();

  const sharedLevelDesignState =
    createEmptySharedLevelDesignState(
      gameplayGraph,
      createdAt,
    );

  sharedLevelDesignState.spatial.lastObservations = [];

  sharedLevelDesignState.gameplay.negotiation = {
    candidates: [],
    selectedCandidateId: null,
    committedCandidateIds: [],
  };

  sharedLevelDesignState.gameplay.validation = null;

  sharedLevelDesignState.gameplay.repairs = [];

  return {
    version: "5.0.0",
    name: "Worldloom Study",

    projectId:
      `project-${createdAt}`,

    researchMode:
      "c2-ai-negotiable",

    interpretationMode: "ai",

    textInstruction: "",

    gameplayGraph,

    sharedLevelDesignState,

    sketchState:
      emptySketchState(),

    sketchSelection: {
      ids: [],
    },

    candidateIntent: null,
    committedIntent: null,
    authoringIntent: null,
    lastInterpretationResult: null,

    compositionHypothesis: null,
    committedCompositionIntent: null,

    assetEditPlan: null,
    appliedAssetEditPlans: [],

    conventions: [],
    repairHistory: [],

    strokes: [],
    constraints: [],
    conflicts: [],
    variants: [],

    activeVariantId: null,
    workingVariantId: null,

    seed: 4217,

    metadata: {
      canvasWidth: 960,
      canvasHeight: 560,
      updatedAt: createdAt,
    },

    manualOverrides: [],
    variantRuleOverrides: [],
    globalDesignPreferences: [],
    strokeInterpretationOverrides: [],

    editHistory: [],
    revisions: [],
    activeRevisionId: null,

    playtestSessions: [],
    playtestEvents: [],
    experienceFeedback: [],
    baseMap: emptyBaseMapState(),
    mapLayers: {
      baseMapVisible: true,
      editVisible: true,
      gameplayVisible: true,
      surfaceVisible: true,
      accessibilityVisible: false,
      collisionVisible: false,
    },
  };
}
