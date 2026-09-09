import type {
  GodotMapExport,
} from "../core/export/godotMapExporter";

import type {
  PlayableGenerationContract,
} from "../core/contract/types";

import {
  getAssetManifest,
} from "../assets/assetManifestClient";


export type AssetManifestItem = {
  id: string;
  name: string;
  category: string;
  tags: string[];
  origin?: string;
  previewUrl?: string;

  resource: {
    type: string;
    generator?: string;
    path?: string;
  };

  visual: {
    color?: string;
    defaultWidth: number;
    defaultHeight: number;
  };

  placement: {
    mode: string;
    layer: number;
  };

  physics: {
    collision: boolean;
    bodyType?: string;
  };
};


export type AssetManifest = {
  schemaVersion: string;
  libraryId: string;
  name: string;
  assets: AssetManifestItem[];
};


export type GodotAssetPlacement = {
  id: string;
  sourceElementId: string;
  assetId: string;
  rationale: string;

  position: {
    x: number;
    y: number;
  };

  size: {
    width: number;
    height: number;
  };

  rotation: number;
  layer: number;
  collision: boolean;
};


export type MissingAssetRequest = {
  id: string;
  sourceElementId: string;
  suggestedAssetId: string;
  name: string;
  category: string;
  rationale: string;
  imagePrompt: string;

  size: {
    width: number;
    height: number;
  };

  layer: number;
  collision: boolean;
};


export type GameplayElementType =
  | "enemy_base"
  | "player_spawn"
  | "npc"
  | "npc_patrol_route";


export type GameplayPoint = {
  x: number;
  y: number;
};


export type GodotGameplayElement = {
  id: string;
  sourceElementId: string;
  type: GameplayElementType;
  name: string;
  description: string;

  position: GameplayPoint;

  size: {
    width: number;
    height: number;
  };

  routePoints: GameplayPoint[];
  layer: number;
};


export type GodotGenerationPlan = {
  schemaVersion: "1.2";
  targetEngine: "godot";
  sourceMapUnderstandingId: string;
  placements: GodotAssetPlacement[];
  missingAssets: MissingAssetRequest[];
  gameplayElements: GodotGameplayElement[];
};


type QwenAPIResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;

  error?: string;
  details?: string;
};


const GAMEPLAY_TYPES =
  new Set<GameplayElementType>([
    "enemy_base",
    "player_spawn",
    "npc",
    "npc_patrol_route",
  ]);


function cleanJsonText(
  text: string,
): string {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace =
    cleaned.indexOf("{");

  const lastBrace =
    cleaned.lastIndexOf("}");

  if (
    firstBrace === -1 ||
    lastBrace === -1
  ) {
    throw new Error(
      "千问没有返回有效的生成计划。",
    );
  }

  return cleaned.slice(
    firstBrace,
    lastBrace + 1,
  );
}


function asRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value === "object"
  ) {
    return value as Record<
      string,
      unknown
    >;
  }

  return {};
}


function toNumber(
  value: unknown,
  fallback: number,
): number {
  const numberValue =
    Number(value);

  return Number.isFinite(
    numberValue,
  )
    ? numberValue
    : fallback;
}


function validateGenerationPlan(
  value: unknown,
  manifest: AssetManifest,
  map: GodotMapExport,
): GodotGenerationPlan {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throw new Error(
           "生成计划格式不正确。",
       );
  }

  const rawPlan = value as {
    placements?: unknown;
    missingAssets?: unknown;
    gameplayElements?: unknown;
  };

  const rawPlacements =
    Array.isArray(
      rawPlan.placements,
    )
      ? rawPlan.placements
      : [];

  const rawMissingAssets =
    Array.isArray(
      rawPlan.missingAssets,
    )
      ? rawPlan.missingAssets
      : [];

  const rawGameplayElements =
    Array.isArray(
      rawPlan.gameplayElements,
    )
      ? rawPlan.gameplayElements
      : [];

  const validAssetIds = new Set(
    manifest.assets.map(
      (asset) => asset.id,
    ),
  );

  const validElementIds = new Set(
    map.elements.map(
      (element) => element.id,
    ),
  );

  const elementsById = new Map(
    map.elements.map(
      (element) => [
        element.id,
        element,
      ],
    ),
  );


  const placements = rawPlacements
    .filter(
      (
        placement,
      ): placement is Record<
        string,
        unknown
      > => {
        return Boolean(
          placement &&
          typeof placement ===
            "object",
        );
      },
    )
    .map((placement, index) => {
      const assetId = String(
        placement.assetId ?? "",
      );

      const sourceElementId =
        String(
          placement.sourceElementId ??
            "",
        );

      if (
        !validAssetIds.has(assetId)
      ) {
        throw new Error(
          `千问选择了不存在的素材：${assetId}`,
        );
      }

      if (
        !validElementIds.has(
          sourceElementId,
        )
      ) {
        throw new Error(
          `生成计划引用了不存在的地图元素：${sourceElementId}`,
        );
      }

      const position =
        asRecord(
          placement.position,
        );

      const size =
        asRecord(
          placement.size,
        );

      const asset =
        manifest.assets.find(
          (item) =>
            item.id === assetId,
        );

      return {
        id: String(
          placement.id ??
            `placement-${index + 1}`,
        ),

        sourceElementId,
        assetId,

        rationale: String(
          placement.rationale ??
            "Selected from the asset library.",
        ),

        position: {
          x: toNumber(
            position.x,
            0,
          ),

          y: toNumber(
            position.y,
            0,
          ),
        },

        size: {
          width: Math.max(
            1,
            toNumber(
              size.width,
              asset?.visual
                .defaultWidth ??
                100,
            ),
          ),

          height: Math.max(
            1,
            toNumber(
              size.height,
              asset?.visual
                .defaultHeight ??
                100,
            ),
          ),
        },

        rotation: toNumber(
          placement.rotation,
          0,
        ),

        layer: toNumber(
          placement.layer,
          asset?.placement.layer ??
            0,
        ),

        collision:
          typeof placement.collision ===
          "boolean"
            ? placement.collision
            : asset?.physics
                .collision ?? false,
      };
    });


  const missingAssets =
    rawMissingAssets
      .filter(
        (
          request,
        ): request is Record<
          string,
          unknown
        > => {
          return Boolean(
            request &&
            typeof request ===
              "object",
          );
        },
      )
      .map((request, index) => {
        const sourceElementId =
          String(
            request.sourceElementId ??
              "",
          );

        if (
          !validElementIds.has(
            sourceElementId,
          )
        ) {
          throw new Error(
            `缺失素材引用了不存在的地图元素：${sourceElementId}`,
          );
        }

        const size =
          asRecord(
            request.size,
          );

        return {
          id: String(
            request.id ??
              `missing-asset-${index + 1}`,
          ),

          sourceElementId,

          suggestedAssetId: String(
            request.suggestedAssetId ??
              `generated-asset-${index + 1}`,
          ),

          name: String(
            request.name ??
              "Generated Asset",
          ),

          category: String(
            request.category ??
              "object",
          ),

          rationale: String(
            request.rationale ??
              "No suitable library asset was found.",
          ),

          imagePrompt: String(
            request.imagePrompt ??
              "A clean 2D top-down game asset with a transparent background.",
          ),

          size: {
            width: Math.max(
              1,
              toNumber(
                size.width,
                128,
              ),
            ),

            height: Math.max(
              1,
              toNumber(
                size.height,
                128,
              ),
            ),
          },

          layer: toNumber(
            request.layer,
            1,
          ),

          collision:
            typeof request.collision ===
            "boolean"
              ? request.collision
              : false,
        };
      });


  const gameplayElements =
    rawGameplayElements
      .filter(
        (
          gameplayElement,
        ): gameplayElement is Record<
          string,
          unknown
        > => {
          return Boolean(
            gameplayElement &&
            typeof gameplayElement ===
              "object",
          );
        },
      )
      .map(
        (
          gameplayElement,
          index,
        ) => {
          const sourceElementId =
            String(
              gameplayElement
                .sourceElementId ??
                "",
            );

          if (
            !validElementIds.has(
              sourceElementId,
            )
          ) {
            throw new Error(
              `玩法元素引用了不存在的地图元素：${sourceElementId}`,
            );
          }

          const rawType =
            String(
              gameplayElement.type ??
                "",
            ) as GameplayElementType;

          if (
            !GAMEPLAY_TYPES.has(
              rawType,
            )
          ) {
            throw new Error(
              `未知的玩法元素类型：${rawType}`,
            );
          }

          const sourceElement =
            elementsById.get(
              sourceElementId,
            );

          const sourcePosition =
            sourceElement?.position;

          const sourceBounds =
            sourceElement?.bounds;

          const position =
            asRecord(
              gameplayElement
                .position,
            );

          const size =
            asRecord(
              gameplayElement.size,
            );

          const rawRoutePoints =
            Array.isArray(
              gameplayElement
                .routePoints,
            )
              ? gameplayElement
                  .routePoints
              : [];

          let routePoints =
            rawRoutePoints
              .filter(
                (
                  point,
                ): point is Record<
                  string,
                  unknown
                > => {
                  return Boolean(
                    point &&
                    typeof point ===
                      "object",
                  );
                },
              )
              .map((point) => ({
                x: toNumber(
                  point.x,
                  sourcePosition?.x ??
                    0,
                ),

                y: toNumber(
                  point.y,
                  sourcePosition?.y ??
                    0,
                ),
              }));

          if (
            rawType ===
              "npc_patrol_route" &&
            routePoints.length < 2
          ) {
            const centerX =
              sourcePosition?.x ??
              0;

            const centerY =
              sourcePosition?.y ??
              0;

            const halfWidth =
              Math.max(
                30,
                (
                  sourceBounds
                    ?.width ??
                  120
                ) / 2,
              );

            routePoints = [
              {
                x:
                  centerX -
                  halfWidth,

                y: centerY,
              },
              {
                x:
                  centerX +
                  halfWidth,

                y: centerY,
              },
            ];
          }

          return {
            id: String(
              gameplayElement.id ??
                `gameplay-${index + 1}`,
            ),

            sourceElementId,

            type: rawType,

            name: String(
              gameplayElement.name ??
                sourceElement?.name ??
                rawType,
            ),

            description: String(
              gameplayElement
                .description ??
                sourceElement
                  ?.description ??
                "",
            ),

            position: {
              x: toNumber(
                position.x,
                sourcePosition?.x ??
                  0,
              ),

              y: toNumber(
                position.y,
                sourcePosition?.y ??
                  0,
              ),
            },

            size: {
              width: Math.max(
                1,
                toNumber(
                  size.width,
                  sourceBounds?.width ??
                    80,
                ),
              ),

              height: Math.max(
                1,
                toNumber(
                  size.height,
                  sourceBounds?.height ??
                    80,
                ),
              ),
            },

            routePoints,

            layer: toNumber(
              gameplayElement.layer,
              10,
            ),
          };
        },
      );


  if (
    placements.length === 0 &&
    missingAssets.length === 0 &&
    gameplayElements.length === 0
  ) {
    throw new Error(
      "千问没有生成素材放置方案、缺失素材请求或玩法元素。",
    );
  }

  return {
    schemaVersion: "1.2",
    targetEngine: "godot",

    sourceMapUnderstandingId:
      map.mapUnderstandingId,

    placements,
    missingAssets,
    gameplayElements,
  };
}


export async function createQwenGenerationPlan(
  map: GodotMapExport,
  generationContract: PlayableGenerationContract,
): Promise<GodotGenerationPlan> {
  const manifest =
    await getAssetManifest(true);

  const response = await fetch(
    "/api/qwen/generation-plan",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        map,
        generationContract,
        assetManifest:
          manifest,
      }),
    },
  );

  const data =
    (await response.json()) as
      QwenAPIResponse;

  if (!response.ok) {
    throw new Error(
      data.details
        ? `${data.error ?? "生成计划失败"}：${data.details}`
        : data.error ??
            "生成计划失败。",
    );
  }

  const content =
    data.choices?.[0]?.message
      ?.content;

  if (!content) {
    throw new Error(
      "千问没有返回生成计划。",
    );
  }

  const parsed = JSON.parse(
    cleanJsonText(content),
  ) as unknown;

  return validateGenerationPlan(
    parsed,
    manifest,
    map,
  );
}