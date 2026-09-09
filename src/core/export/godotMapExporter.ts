import type {
  FinalMapUnderstanding,
} from "../../store/useDoodleInterpretationStore";

import type {
  PlayableGenerationContract,
  RegenerationScope,
} from "../contract/types";

import type {
  GameplayRepairProposal,
  GameplayValidationResult,
} from "../shared-state/types";


export type GodotMapElement = {
  id: string;
  name: string;
  description: string;

  source:
    | "qwen_candidate"
    | "custom";

  position: {
    x: number;
    y: number;
    normalizedX: number;
    normalizedY: number;
  };

  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
};


export type GodotMapRegenerationScope = {
  mode:
    | "full"
    | "local";

  targetElementIds: string[];

  targetGameplayNodeIds: string[];

  lockedElementIds: string[];

  lockedGameplayNodeIds: string[];

  targetRoomIds: string[];

  targetEdgeIds: string[];
};


export type GodotMapExportOptions = {
  generationContract?:
    PlayableGenerationContract;

  regenerationScope?:
    Partial<GodotMapRegenerationScope>;

  validation?:
    GameplayValidationResult | null;

  repairs?:
    GameplayRepairProposal[];
};


export type GodotMapExport = {
  schemaVersion: "2.0";

  targetEngine: "godot";

  generatedAt: string;

  worldSetting: string;

  canvas: {
    width: number;
    height: number;
  };

  mapUnderstandingId: string;

  elements: GodotMapElement[];

  /**
   * 当前已经编译好的三层 Generation Contract。
   *
   * scene:
   *   场景元素与需要保留的对象。
   *
   * spatial:
   *   exact / approximate / free。
   *
   * gameplay:
   *   nodes / relations / routes / experience goals。
   */
  generationContract?:
    PlayableGenerationContract;

  constraints?: {
    scene:
      PlayableGenerationContract["scene"];

    spatial:
      PlayableGenerationContract["spatial"];

    gameplay:
      PlayableGenerationContract["gameplay"];
  };

  regenerationScope:
    GodotMapRegenerationScope;

  validation:
    GameplayValidationResult | null;

  repairs:
    GameplayRepairProposal[];
};


function createDefaultRegenerationScope():
  GodotMapRegenerationScope {
  return {
    mode: "full",

    targetElementIds: [],

    targetGameplayNodeIds: [],

    lockedElementIds: [],

    lockedGameplayNodeIds: [],

    targetRoomIds: [],

    targetEdgeIds: [],
  };
}


function scopeFromContract(
  contract:
    PlayableGenerationContract | undefined,
): GodotMapRegenerationScope {
  if (!contract) {
    return createDefaultRegenerationScope();
  }

  return {
    mode:
      contract.regeneration.mode,

    targetElementIds: [
      ...contract
        .regeneration
        .targetElementIds,
    ],

    targetGameplayNodeIds: [
      ...contract
        .regeneration
        .targetGameplayNodeIds,
    ],

    lockedElementIds: [
      ...contract
        .regeneration
        .lockedElementIds,
    ],

    lockedGameplayNodeIds: [
      ...contract
        .regeneration
        .lockedGameplayNodeIds,
    ],

    targetRoomIds: [],

    targetEdgeIds: [],
  };
}


function mergeRegenerationScope(
  base:
    GodotMapRegenerationScope,

  override:
    Partial<
      GodotMapRegenerationScope
    > | undefined,
): GodotMapRegenerationScope {
  if (!override) {
    return base;
  }

  return {
    mode:
      override.mode ??
      base.mode,

    targetElementIds:
      override.targetElementIds
        ? [
            ...override
              .targetElementIds,
          ]
        : [
            ...base
              .targetElementIds,
          ],

    targetGameplayNodeIds:
      override.targetGameplayNodeIds
        ? [
            ...override
              .targetGameplayNodeIds,
          ]
        : [
            ...base
              .targetGameplayNodeIds,
          ],

    lockedElementIds:
      override.lockedElementIds
        ? [
            ...override
              .lockedElementIds,
          ]
        : [
            ...base
              .lockedElementIds,
          ],

    lockedGameplayNodeIds:
      override.lockedGameplayNodeIds
        ? [
            ...override
              .lockedGameplayNodeIds,
          ]
        : [
            ...base
              .lockedGameplayNodeIds,
          ],

    targetRoomIds:
      override.targetRoomIds
        ? [
            ...override
              .targetRoomIds,
          ]
        : [
            ...base
              .targetRoomIds,
          ],

    targetEdgeIds:
      override.targetEdgeIds
        ? [
            ...override
              .targetEdgeIds,
          ]
        : [
            ...base
              .targetEdgeIds,
          ],
  };
}


function cloneValidation(
  validation:
    GameplayValidationResult | null | undefined,
): GameplayValidationResult | null {
  if (!validation) {
    return null;
  }

  return {
    ...validation,

    reachableNodeIds: [
      ...validation
        .reachableNodeIds,
    ],

    mandatoryNodeIds: [
      ...validation
        .mandatoryNodeIds,
    ],

    conflicts:
      validation.conflicts.map(
        (conflict) => ({
          ...conflict,

          nodeIds: [
            ...conflict.nodeIds,
          ],

          relationIds: [
            ...conflict
              .relationIds,
          ],

          routeIds: [
            ...conflict.routeIds,
          ],

          suggestedRepairIds: [
            ...conflict
              .suggestedRepairIds,
          ],
        }),
      ),
  };
}


function cloneRepairs(
  repairs:
    GameplayRepairProposal[] | undefined,
): GameplayRepairProposal[] {
  return (
    repairs ?? []
  ).map(
    (repair) => ({
      ...repair,

      operations:
        repair.operations.map(
          (operation) => ({
            ...operation,
          }),
        ),

      provenance: {
        ...repair.provenance,

        sourceIds: [
          ...repair
            .provenance
            .sourceIds,
        ],
      },
    }),
  );
}


export function buildGodotMapExport(
  understanding:
    FinalMapUnderstanding,

  canvasWidth: number,

  canvasHeight: number,

  options:
    GodotMapExportOptions = {},
): GodotMapExport {
  const elements =
    understanding.doodles.map(
      (doodle) => {
        const bounds =
          doodle.boundingBox;

        const centerX =
          bounds
            ? bounds.x +
              bounds.width / 2
            : canvasWidth / 2;

        const centerY =
          bounds
            ? bounds.y +
              bounds.height / 2
            : canvasHeight / 2;

        return {
          id:
            doodle.id,

          name:
            doodle.selectedLabel,

          description:
            doodle
              .selectedDescription,

          source:
            doodle.source,

          position: {
            x:
              centerX,

            y:
              centerY,

            normalizedX:
              centerX /
              canvasWidth,

            normalizedY:
              centerY /
              canvasHeight,
          },

          bounds:
            bounds
              ? {
                  x:
                    bounds.x,

                  y:
                    bounds.y,

                  width:
                    bounds.width,

                  height:
                    bounds.height,
                }
              : null,
        };
      },
    );

  const contract =
    options.generationContract;

  const contractScope =
    scopeFromContract(
      contract,
    );

  const regenerationScope =
    mergeRegenerationScope(
      contractScope,
      options.regenerationScope,
    );

  return {
    schemaVersion:
      "2.0",

    targetEngine:
      "godot",

    generatedAt:
      new Date()
        .toISOString(),

    worldSetting:
      understanding
        .worldSetting,

    canvas: {
      width:
        canvasWidth,

      height:
        canvasHeight,
    },

    mapUnderstandingId:
      understanding.id,

    elements,

    generationContract:
      contract,

    constraints:
      contract
        ? {
            scene:
              contract.scene,

            spatial:
              contract.spatial,

            gameplay:
              contract.gameplay,
          }
        : undefined,

    regenerationScope,

    validation:
      cloneValidation(
        options.validation,
      ),

    repairs:
      cloneRepairs(
        options.repairs,
      ),
  };
}


export function downloadGodotMapJson(
  mapExport:
    GodotMapExport,

  filename =
    "worldloom-godot-map.json",
): void {
  const json =
    JSON.stringify(
      mapExport,
      null,
      2,
    );

  const blob =
    new Blob(
      [json],
      {
        type:
          "application/json",
      },
    );

  const url =
    URL.createObjectURL(
      blob,
    );

  const link =
    document.createElement(
      "a",
    );

  link.href =
    url;

  link.download =
    filename;

  document.body.appendChild(
    link,
  );

  link.click();

  link.remove();

  URL.revokeObjectURL(
    url,
  );
}