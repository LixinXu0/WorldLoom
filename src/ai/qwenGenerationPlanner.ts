import type {
  GodotMapExport,
} from "../core/export/godotMapExporter";

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
  source?: "qwen" | "local_fallback";
  warning?: string;
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
      "Qwen did not return a valid generation plan.",
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
           "The generation plan format is invalid.",
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
          `Qwen selected an unknown asset: ${assetId}`,
        );
      }

      if (
        !validElementIds.has(
          sourceElementId,
        )
      ) {
        throw new Error(
          `The generation plan references an unknown map element: ${sourceElementId}`,
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
            `A missing asset references an unknown map element: ${sourceElementId}`,
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
              `A gameplay element references an unknown map element: ${sourceElementId}`,
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
              `Unknown gameplay element type: ${rawType}`,
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
      "Qwen returned no placements, missing asset requests, or gameplay elements.",
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


function buildLocalFallbackGenerationPlan(
  map: GodotMapExport,
  manifest: AssetManifest,
  reason: string,
): GodotGenerationPlan {
  const placements: GodotAssetPlacement[] = [];
  const missingAssets: MissingAssetRequest[] = [];
  const gameplayElements: GodotGameplayElement[] = [];
  const genericArea = manifest.assets.find((asset) => asset.id === "generic_area");

  const classifyGameplay = (element: GodotMapExport["elements"][number]): GameplayElementType | null => {
    const text = `${element.name} ${element.description}`.toLocaleLowerCase();
    if (/patrol|route|arrow/.test(text)) return "npc_patrol_route";
    if (/enemy|stronghold|shrine|camp|base|lair/.test(text)) return "enemy_base";
    if (/spawn|player|start/.test(text)) return "player_spawn";
    if (/npc|merchant|resident|character/.test(text)) return "npc";
    return null;
  };

  const chooseAsset = (element: GodotMapExport["elements"][number]): AssetManifestItem | null => {
    const text = `${element.name} ${element.description}`.toLocaleLowerCase();
    let best: AssetManifestItem | null = null;
    let bestScore = 0;
    for (const asset of manifest.assets) {
      const terms = [asset.id, asset.name, ...asset.tags]
        .map((term) => term.toLocaleLowerCase())
        .filter((term) => term.length > 1);
      const score = terms.reduce((total, term) => total + (text.includes(term) ? Math.max(2, term.length) : 0), 0);
      if (score > bestScore) {
        best = asset;
        bestScore = score;
      }
    }
    return best ?? genericArea ?? manifest.assets[0] ?? null;
  };

  map.elements.forEach((element, index) => {
    const gameplayType = classifyGameplay(element);
    const position = element.position;
    const width = element.bounds?.width ?? 96;
    const height = element.bounds?.height ?? 96;

    if (gameplayType) {
      const routePoints = gameplayType === "npc_patrol_route"
        ? [
            { x: position.x - Math.max(30, width / 2), y: position.y },
            { x: position.x + Math.max(30, width / 2), y: position.y },
          ]
        : [];
      gameplayElements.push({
        id: `gameplay-${index + 1}`,
        sourceElementId: element.id,
        type: gameplayType,
        name: element.name,
        description: element.description,
        position: { x: position.x, y: position.y },
        size: { width, height },
        routePoints,
        layer: 10,
      });
      return;
    }

    const asset = chooseAsset(element);
    if (asset) {
      placements.push({
        id: `placement-${index + 1}`,
        sourceElementId: element.id,
        assetId: asset.id,
        rationale: "Matched locally using element names and asset tags.",
        position: { x: position.x, y: position.y },
        size: {
          width: element.bounds?.width ?? asset.visual.defaultWidth,
          height: element.bounds?.height ?? asset.visual.defaultHeight,
        },
        rotation: 0,
        layer: asset.placement.layer,
        collision: asset.physics.collision,
      });
    } else {
      missingAssets.push({
        id: `missing-asset-${index + 1}`,
        sourceElementId: element.id,
        suggestedAssetId: `generated-${element.id}`,
        name: element.name,
        category: "environment",
        rationale: "No suitable asset was found in the manifest.",
        imagePrompt: `A clean top-down 2D game asset of ${element.name}, consistent with ${map.worldSetting || "the map style"}.`,
        size: { width, height },
        layer: 1,
        collision: false,
      });
    }
  });

  const validated = validateGenerationPlan(
    { placements, missingAssets, gameplayElements },
    manifest,
    map,
  );
  return {
    ...validated,
    source: "local_fallback",
    warning: `Qwen is temporarily unavailable. A local fallback plan was used (${reason}).`,
  };
}


export async function createQwenGenerationPlan(
  map: GodotMapExport,
): Promise<GodotGenerationPlan> {
  const manifest =
    await getAssetManifest(true);

  try {
    const response = await fetch(
      "/api/qwen/generation-plan",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ map, assetManifest: manifest }),
      },
    );
    const data = (await response.json()) as QwenAPIResponse;
    if (!response.ok) {
      throw new Error(
        data.details
          ? `${data.error ?? "Generation plan failed"}: ${data.details}`
          : data.error ?? "Generation plan failed.",
      );
    }
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Qwen did not return a generation plan.");
    const parsed = JSON.parse(cleanJsonText(content)) as unknown;
    return {
      ...validateGenerationPlan(parsed, manifest, map),
      source: "qwen",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Network request failed";
    console.warn("Qwen generation plan unavailable; using local fallback.", reason);
    return buildLocalFallbackGenerationPlan(map, manifest, reason);
  }
}
