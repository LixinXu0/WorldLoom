import {
  useEffect,
  useState,
} from "react";

import {
  useWorldloomStore,
} from "../../store/useWorldloomStore";

import {
  useDoodleInterpretationStore,
} from "../../store/useDoodleInterpretationStore";

import {
  buildGodotMapExport,
  downloadGodotMapJson,
} from "../../core/export/godotMapExporter";

import {
  createQwenGenerationPlan,
  type AssetManifestItem,
  type GodotGenerationPlan,
} from "../../ai/qwenGenerationPlanner";

import {
  generateMissingAsset,
  generateMissingAssets,
  type GeneratedAsset,
} from "../../ai/wanAssetGenerator";

import {
  generateInGodot,
} from "../../core/bridge/worldloomBridgeClient";

import {
  getAssetManifest,
  getWebTextureUrl,
  refreshAssetManifest,
} from "../../assets/assetManifestClient";


const MAP_BACKGROUND_REQUEST_ID =
  "worldloom-map-background";


function ExistingAssetThumbnail({
  asset,
}: {
  asset: AssetManifestItem | null;
}) {
  if (!asset) {
    return (
      <div
        style={{
          width: "72px",
          height: "72px",
          display: "grid",
          placeItems: "center",
          border: "1px solid var(--border)",
          background: "var(--elevated)",
          color: "var(--muted)",
          fontSize: "11px",
        }}
      >
        No preview
      </div>
    );
  }

  const textureUrl =
    getWebTextureUrl(asset);

  if (textureUrl) {
    return (
      <img
        src={textureUrl}
        alt={asset.name}
        style={{
          width: "72px",
          height: "72px",
          objectFit: "contain",
          border: "1px solid var(--border)",
          background: "var(--elevated)",
        }}
      />
    );
  }

  const generator =
    asset.resource.generator ??
    "filled_area";

  const isEllipse =
    generator === "ellipse_area";

  const isStrip = [
    "path_strip",
    "rail_strip",
    "wall_strip",
  ].includes(generator);

  return (
    <div
      title={asset.name}
      style={{
        width: "72px",
        height: "72px",
        display: "grid",
        placeItems: "center",
        border: "1px solid var(--border)",
        background: "var(--elevated)",
      }}
    >
      <div
        style={{
          width: isStrip
            ? "58px"
            : "54px",

          height: isStrip
            ? "15px"
            : "48px",

          borderRadius: isEllipse
            ? "50%"
            : "3px",

          background:
            asset.visual.color ??
            "var(--muted)",

          border:
            "1px solid rgba(0, 0, 0, 0.18)",
        }}
      />
    </div>
  );
}


export function MapUnderstandingPanel() {
  const { project, setMapLayerVisible, setMapBaseMapUrl, setGeneratedOutput } =
    useWorldloomStore();

  const {
    confirmedDoodles: storedConfirmedDoodles,
    finalMapUnderstanding: storedFinalMapUnderstanding,
    updateConfirmedDoodle,
    removeConfirmedDoodle,
    confirmOverallMap,
    reopenOverallMap,
  } = useDoodleInterpretationStore();
  const projectDoodles = project.mapUnderstandingSnapshot && typeof project.mapUnderstandingSnapshot === "object" && Array.isArray((project.mapUnderstandingSnapshot as { elements?: unknown[] }).elements)
    ? ((project.mapUnderstandingSnapshot as { elements: Array<{ id: string; type: string; position?: { x: number; y: number }; roles?: string[] }> }).elements).map((element) => ({ id: element.id, confirmedAt: Date.now(), imageDataUrl: "", aiSummary: element.roles?.[0] ?? "Map element", selectedLabel: element.type, selectedDescription: element.roles?.[0] ?? "Confirmed map element", source: "custom" as const, boundingBox: element.position ? { x: element.position.x, y: element.position.y, width: 72, height: 72 } : null }))
    : [];
  const confirmedDoodles = storedConfirmedDoodles.length ? storedConfirmedDoodles : projectDoodles;
  const finalMapUnderstanding = storedFinalMapUnderstanding ?? (project.mapUnderstandingSnapshot ? { id: "project-map-understanding", confirmedAt: project.mapUnderstandingSnapshot && typeof project.mapUnderstandingSnapshot === "object" && "confirmedAt" in project.mapUnderstandingSnapshot ? Number((project.mapUnderstandingSnapshot as { confirmedAt?: number }).confirmedAt) : Date.now(), worldSetting: project.worldSetting?.text ?? "", doodles: projectDoodles } : null);

  const [
    generationPlan,
    setGenerationPlan,
  ] = useState<
    GodotGenerationPlan | null
  >(null);

  const [
    generatedAssets,
    setGeneratedAssets,
  ] = useState<GeneratedAsset[]>([]);

  const [
    manifestAssets,
    setManifestAssets,
  ] = useState<
    AssetManifestItem[]
  >([]);

  const [
    includeMapBackground,
    setIncludeMapBackground,
  ] = useState(true);

  const [
    mapBackgroundPrompt,
    setMapBackgroundPrompt,
  ] = useState("");

  const [
    isGenerating,
    setIsGenerating,
  ] = useState(false);

  const [
    isGeneratingAssets,
    setIsGeneratingAssets,
  ] = useState(false);

  const [
    regeneratingAssetId,
    setRegeneratingAssetId,
  ] = useState<string | null>(null);

  const [
    isGeneratingInGodot,
    setIsGeneratingInGodot,
  ] = useState(false);

  const [
    generationError,
    setGenerationError,
  ] = useState("");

  const [
    godotSuccess,
    setGodotSuccess,
  ] = useState("");

  const canvasWidth =
    project.metadata.canvasWidth;

  const canvasHeight =
    project.metadata.canvasHeight;

  const isConfirmed = Boolean(
    finalMapUnderstanding,
  );


  useEffect(() => {
    let cancelled = false;

    getAssetManifest()
      .then((manifest) => {
        if (!cancelled) {
          setManifestAssets(
            manifest.assets,
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setManifestAssets([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);


  const addMapBackgroundToPlan = (
    plan: GodotGenerationPlan,
  ): GodotGenerationPlan => {
    const withoutOldBackground =
      plan.missingAssets.filter(
        (request) =>
          request.id !==
            MAP_BACKGROUND_REQUEST_ID &&
          request.category !==
            "map_background",
      );

    if (
      !includeMapBackground ||
      !finalMapUnderstanding ||
      confirmedDoodles.length === 0
    ) {
      return {
        ...plan,
        missingAssets:
          withoutOldBackground,
      };
    }

    const firstDoodle =
      confirmedDoodles[0];

    const elementDescriptions =
      confirmedDoodles
        .map((item, index) => {
          const bounds =
            item.boundingBox;

          const positionText = bounds
            ? (
                `position x=${Math.round(
                  bounds.x,
                )}, y=${Math.round(
                  bounds.y,
                )}, width=${Math.round(
                  bounds.width,
                )}, height=${Math.round(
                  bounds.height,
                )}`
              )
            : "position unspecified";

          return (
            `${index + 1}. ` +
            `${item.selectedLabel}: ` +
            `${item.selectedDescription}; ` +
            positionText
          );
        })
        .join(". ");

    const automaticPrompt = [
      "Create one complete 2D game map background.",
      "Top-down view.",
      "The image must cover the entire map canvas.",
      "Create a coherent environment rather than separate isolated objects.",
      "Leave suitable visual space for game objects to be placed on top.",
      "No text, no labels, no user interface, no frame, no border.",
      "Do not use a transparent background.",
      `Map aspect ratio: ${canvasWidth}:${canvasHeight}.`,

      finalMapUnderstanding.worldSetting
        ? (
            "World setting and art direction: " +
            finalMapUnderstanding
              .worldSetting
          )
        : "",

      elementDescriptions
        ? (
            "Map layout and landmarks: " +
            elementDescriptions
          )
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    const finalPrompt =
      mapBackgroundPrompt.trim()
        ? [
            automaticPrompt,
            "Additional player direction:",
            mapBackgroundPrompt.trim(),
          ].join(" ")
        : automaticPrompt;

    return {
      ...plan,

      missingAssets: [
        {
          id:
            MAP_BACKGROUND_REQUEST_ID,

          sourceElementId:
            firstDoodle.id,

          suggestedAssetId:
            "worldloom-map-background",

          name:
            "Complete map background",

          category:
            "map_background",

          rationale:
            "Generate a unified environment background from the world setting and all map elements.",

          imagePrompt:
            finalPrompt,

          size: {
            width: canvasWidth,
            height: canvasHeight,
          },

          layer: -10,
          collision: false,
        },

        ...withoutOldBackground,
      ],
    };
  };


  const exportToGodot = () => {
    if (!finalMapUnderstanding) {
      return;
    }

    const mapExport =
      buildGodotMapExport(
        finalMapUnderstanding,
        canvasWidth,
        canvasHeight,
      );

    downloadGodotMapJson(
      mapExport,
    );
  };


  const generateGodotPlan =
    async () => {
      if (!finalMapUnderstanding) {
        return;
      }

      setIsGenerating(true);
      setGenerationError("");
      setGodotSuccess("");
      setGenerationPlan(null);
      setGeneratedAssets([]);

      try {
        const mapExport =
          buildGodotMapExport(
            finalMapUnderstanding,
            canvasWidth,
            canvasHeight,
          );

        const qwenPlan =
          await createQwenGenerationPlan(
            mapExport,
          );

        const plan =
          addMapBackgroundToPlan(
            qwenPlan,
          );

        const refreshedManifest =
          await refreshAssetManifest();

        setManifestAssets(
          refreshedManifest.assets,
        );

        setGenerationPlan(plan);

      } catch (error) {
        setGenerationError(
          error instanceof Error
            ? error.message
            : "An unknown error occurred while generating the Godot plan.",
        );

      } finally {
        setIsGenerating(false);
      }
    };


  const handleGenerateMissingAssets =
    async () => {
      if (
        !generationPlan ||
        generationPlan
          .missingAssets.length === 0
      ) {
        return;
      }

      setIsGeneratingAssets(true);
      setGenerationError("");
      setGodotSuccess("");
      setGeneratedAssets([]);

      try {
        const assets =
          await generateMissingAssets(
            generationPlan
              .missingAssets,
          );

        setGeneratedAssets(assets);
        const baseMap = assets.find((asset) => asset.requestId === MAP_BACKGROUND_REQUEST_ID);
        if (baseMap) { setMapBaseMapUrl(baseMap.imageUrl); setMapLayerVisible("baseMapVisible", true); }

      } catch (error) {
        setGenerationError(
          error instanceof Error
            ? error.message
            : "An unknown error occurred while generating missing assets.",
        );

      } finally {
        setIsGeneratingAssets(false);
      }
    };


  const updateMissingAsset = (
    requestId: string,
    patch: {
      name?: string;
      imagePrompt?: string;
    },
  ) => {
    setGenerationPlan(
      (currentPlan) => {
        if (!currentPlan) {
          return currentPlan;
        }

        return {
          ...currentPlan,

          missingAssets:
            currentPlan
              .missingAssets
              .map((request) =>
                request.id ===
                requestId
                  ? {
                      ...request,
                      ...patch,
                    }
                  : request,
              ),
        };
      },
    );

    setGeneratedAssets(
      (currentAssets) =>
        currentAssets.filter(
          (asset) =>
            asset.requestId !==
            requestId,
        ),
    );
  };


  const regenerateSingleAsset =
    async (
      requestId: string,
    ) => {
      const request =
        generationPlan
          ?.missingAssets
          .find(
            (item) =>
              item.id === requestId,
          );

      if (!request) {
        return;
      }

      setRegeneratingAssetId(
        requestId,
      );

      setGenerationError("");
      setGodotSuccess("");

      try {
        const generatedAsset =
          await generateMissingAsset(
            request,
          );

        setGeneratedAssets(
          (currentAssets) => [
            ...currentAssets.filter(
              (asset) =>
                asset.requestId !==
                requestId,
            ),

            generatedAsset,
          ],
        );
        if (requestId === MAP_BACKGROUND_REQUEST_ID) { setMapBaseMapUrl(generatedAsset.imageUrl); setMapLayerVisible("baseMapVisible", true); }

      } catch (error) {
        setGenerationError(
          error instanceof Error
            ? error.message
            : "An unknown error occurred while regenerating the asset.",
        );

      } finally {
        setRegeneratingAssetId(
          null,
        );
      }
    };


  const replaceExistingAssetWithAI = (
    placementId: string,
  ) => {
    setGenerationPlan(
      (currentPlan) => {
        if (!currentPlan) {
          return currentPlan;
        }

        const placement =
          currentPlan
            .placements
            .find(
              (item) =>
                item.id ===
                placementId,
            );

        if (!placement) {
          return currentPlan;
        }

        const sourceDoodle =
          confirmedDoodles.find(
            (item) =>
              item.id ===
              placement
                .sourceElementId,
          );

        const sourceAsset =
          manifestAssets.find(
            (item) =>
              item.id ===
              placement.assetId,
          );

        const safeSourceId =
          placement
            .sourceElementId
            .replace(
              /[^a-zA-Z0-9_-]/g,
              "_",
            );

        return {
          ...currentPlan,

          placements:
            currentPlan
              .placements
              .filter(
                (item) =>
                  item.id !==
                  placementId,
              ),

          missingAssets: [
            ...currentPlan
              .missingAssets,

            {
              id:
                `replace-${placement.id}`,

              sourceElementId:
                placement
                  .sourceElementId,

              suggestedAssetId:
                `custom-${safeSourceId}`,

              name:
                sourceDoodle
                  ?.selectedLabel ??
                `${sourceAsset?.name ??
                  placement.assetId} Custom`,

              category:
                sourceAsset
                  ?.category ??
                "object",

              rationale:
                "The player chose to generate a custom AI version.",

              imagePrompt: [
                sourceDoodle
                  ?.selectedDescription ??
                  sourceDoodle
                    ?.selectedLabel ??
                  placement.assetId,

                finalMapUnderstanding
                  ?.worldSetting ??
                  "",

                "top-down 2D game asset, isolated object, consistent game art style",
              ]
                .filter(Boolean)
                .join(", "),

              size: {
                ...placement.size,
              },

              layer:
                placement.layer,

              collision:
                placement.collision,
            },
          ],
        };
      },
    );
  };


  const generateDirectlyInGodot =
    async () => {
      if (!finalMapUnderstanding) {
        return;
      }

      setIsGeneratingInGodot(true);
      setGenerationError("");
      setGodotSuccess("");

      try {
        const mapExport =
          buildGodotMapExport(
            finalMapUnderstanding,
            canvasWidth,
            canvasHeight,
          );

        let plan = generationPlan;

        if (!plan) {
          const qwenPlan =
            await createQwenGenerationPlan(
              mapExport,
            );

          plan =
            addMapBackgroundToPlan(
              qwenPlan,
            );

          const refreshedManifest =
            await refreshAssetManifest();

          setManifestAssets(
            refreshedManifest.assets,
          );

          setGenerationPlan(plan);
        }

        if (
          plan.missingAssets.length >
            0 &&
          generatedAssets.length <
            plan.missingAssets.length
        ) {
          throw new Error(
          `There are ${plan.missingAssets.length} missing assets. Generate them first.`,
          );
        }

        const result =
          await generateInGodot(
            mapExport,
            plan,
            generatedAssets,
          );

        setGodotSuccess(
          `Godot map generated: ${result.scenePath}`,
        );
        setGeneratedOutput({
          status: "success",
          scenePath: result.scenePath,
          generatedAssetCount: generatedAssets.length,
          generatedAt: Date.now(),
          message: result.message,
        });

      } catch (error) {
        setGeneratedOutput({
          status: "failed",
          generatedAt: Date.now(),
          message: error instanceof Error ? error.message : "Godot generation failed",
        });
        setGenerationError(
          error instanceof Error
            ? error.message
            : "An unknown error occurred while generating the map in Godot.",
        );

      } finally {
        setIsGeneratingInGodot(
          false,
        );
      }
    };


  const downloadGenerationPlan =
    () => {
      if (!generationPlan) {
        return;
      }

      const json = JSON.stringify(
        generationPlan,
        null,
        2,
      );

      const blob = new Blob(
        [json],
        {
          type:
            "application/json",
        },
      );

      const url =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = url;

      link.download =
        "worldloom-generation-plan.json";

      document.body.appendChild(
        link,
      );

      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    };


  if (
    confirmedDoodles.length === 0
  ) {
    return (
      <section
        className="generation-tools-panel"
        style={{
          width: "100%",
          padding: "12px",
          border:
            "1px solid var(--border)",
          background: "var(--panel)",
        }}
      >
        <h3>Map Understanding</h3>

        <p
          style={{
            marginTop: "8px",
          }}
        >
          No confirmed sketch interpretations yet.
        </p>
      </section>
    );
  }


  return (
    <section
      className="generation-tools-panel"
      style={{
        width: "100%",
        padding: "12px",

        border: isConfirmed
          ? "1px solid var(--relief)"
          : "1px solid var(--border)",

        background: isConfirmed
          ? "color-mix(in srgb, var(--relief) 12%, var(--panel))"
          : "var(--panel)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: "10px",
          marginBottom: "10px",
        }}
      >
        <div>
          <h3>Map Understanding</h3>

          <p
            style={{
              marginTop: "5px",
            }}
          >
            The system currently understands {" "}
            {confirmedDoodles.length}{" "}
            map elements.
          </p>
        </div>

        {isConfirmed ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <button
              disabled={
                isGeneratingInGodot ||
                isGeneratingAssets
              }
              onClick={
                reopenOverallMap
              }
            >
              Edit Map Understanding
            </button>

            <button
              disabled={
                isGeneratingInGodot ||
                isGeneratingAssets
              }
              onClick={exportToGodot}
            >
              Export Map Understanding
            </button>

            <button
              disabled={
                isGenerating ||
                isGeneratingInGodot ||
                isGeneratingAssets
              }
              onClick={
                generateGodotPlan
              }
            >
              {isGenerating
                ? "Planning..."
                : "Generate Plan Only"}
            </button>

            <button
              className="primary"
              disabled={
                isGenerating ||
                isGeneratingInGodot ||
                isGeneratingAssets
              }
              onClick={
                generateDirectlyInGodot
              }
            >
              {isGeneratingInGodot
                ? "Generating and launching Godot..."
                : "Generate in Godot"}
            </button>
          </div>
        ) : (
          <button
            className="primary"
            onClick={
              confirmOverallMap
            }
          >
            Confirm Map Understanding
          </button>
        )}
      </div>

      {isConfirmed &&
        finalMapUnderstanding && (
          <div
            style={{
              display: "grid",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <div
              style={{
                padding: "9px",
                border:
                  "1px solid var(--relief)",
                background: "color-mix(in srgb, var(--relief) 10%, var(--panel))",
                color: "var(--relief)",
              }}
            >
              Map understanding confirmed. The result is locked and ready for engine generation.
            </div>

            <div
              style={{
                padding: "10px",
                border:
                  "1px solid var(--border)",
                background: "var(--elevated)",
              }}
            >
              <strong>
                World Setting
              </strong>

              <p
                style={{
                  marginTop: "6px",

                  color:
                    finalMapUnderstanding
                      .worldSetting
                      ? "var(--text)"
                      : "var(--muted)",

                  whiteSpace:
                    "pre-wrap",

                  lineHeight: 1.5,
                }}
              >
                {finalMapUnderstanding
                  .worldSetting ||
                  "Not set; using the default generation style."}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gap: "8px",
                padding: "10px",
                border:
                  "1px solid var(--candidate)",
                background: "color-mix(in srgb, var(--candidate) 9%, var(--panel))",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    includeMapBackground
                  }
                  disabled={
                    isGenerating ||
                    isGeneratingAssets ||
                    isGeneratingInGodot
                  }
                  onChange={(event) => {
                    setIncludeMapBackground(
                      event.target.checked,
                    );

                    setGenerationPlan(null);
                    setGeneratedAssets([]);
                    setGodotSuccess("");
                  }}
                />

                Generate Complete Map Background with AI
              </label>

              <div
                style={{
                  color: "var(--muted)",
                  fontSize: "12px",
                  lineHeight: 1.45,
                }}
              >
                When enabled, the system generates a complete background from the world setting and all map elements, beneath every asset.
              </div>

              {includeMapBackground && (
                <label
                  style={{
                    display: "grid",
                    gap: "5px",
                  }}
                >
                  Additional background requirements (optional)

                  <textarea
                    value={
                      mapBackgroundPrompt
                    }
                    disabled={
                      isGenerating ||
                      isGeneratingAssets ||
                      isGeneratingInGodot
                    }
                    placeholder="Example: denser forest, an open center, and a soft pixel-art style."
                    onChange={(event) => {
                      setMapBackgroundPrompt(
                        event.target.value,
                      );

                      setGenerationPlan(null);
                      setGeneratedAssets([]);
                      setGodotSuccess("");
                    }}
                    style={{
                      width: "100%",
                      minHeight: "72px",
                      resize: "vertical",
                      padding: "7px",
                      border:
                        "1px solid var(--border)",
                      background: "var(--elevated)",
                      font: "inherit",
                      lineHeight: 1.45,
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        )}

      {generationError && (
        <div
          style={{
            marginBottom: "10px",
            padding: "9px",
            border:
              "1px solid var(--invalid)",
            background: "color-mix(in srgb, var(--invalid) 12%, var(--panel))",
            color: "var(--invalid)",
          }}
        >
          {generationError}
        </div>
      )}

      {godotSuccess && (
        <div
          style={{
            marginBottom: "10px",
            padding: "9px",
            border:
              "1px solid var(--relief)",
            background: "color-mix(in srgb, var(--relief) 10%, var(--panel))",
            color: "var(--relief)",
          }}
        >
          {godotSuccess}
        </div>
      )}

      {generationPlan && (
        <div
          style={{
            marginBottom: "10px",
            padding: "10px",
            border:
              "1px solid var(--flow)",
            background: "color-mix(in srgb, var(--flow) 9%, var(--panel))",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div>
              <strong>
                Godot generation plan ready
              </strong>

              {generationPlan.warning && (
                <div
                  className="generation-plan-warning"
                >
                  {generationPlan.warning}
                </div>
              )}

              <div
                style={{
                  marginTop: "4px",
                }}
              >
                Matched {" "}
                {
                  generationPlan
                    .placements.length
                }{" "}
                existing assets; {" "}
                {
                  generationPlan
                    .missingAssets.length
                }{" "}
                new assets need generation.
              </div>
            </div>

            <button
              onClick={
                downloadGenerationPlan
              }
            >
              Download Generation Plan
            </button>
          </div>

          {generationPlan
            .placements.length > 0 && (
            <div
              style={{
                display: "grid",
                gap: "6px",
                marginTop: "10px",
              }}
            >
              <strong>
                Existing Asset Matches
              </strong>

              {generationPlan
                .placements
                .map(
                  (
                    placement,
                    index,
                  ) => {
                    const asset =
                      manifestAssets
                        .find(
                          (item) =>
                            item.id ===
                            placement
                              .assetId,
                        ) ?? null;

                    return (
                      <div
                        key={
                          placement.id
                        }
                        style={{
                          display:
                            "grid",

                          gridTemplateColumns:
                            "72px minmax(0, 1fr)",

                          gap: "10px",
                          alignItems:
                            "center",
                          padding: "8px",

                          border:
                            "1px solid var(--border)",

                          background:
                            "var(--elevated)",
                        }}
                      >
                        <ExistingAssetThumbnail
                          asset={asset}
                        />

                        <div>
                          <div>
                            {index + 1}.{" "}

                            <strong>
                              {asset?.name ??
                                placement
                                  .assetId}
                            </strong>

                            <span
                              style={{
                                marginLeft:
                                  "8px",

                                color:
                                "var(--relief)",

                                fontSize:
                                  "11px",
                              }}
                            >
                              In Asset Library
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop:
                                "4px",

                              color:
                                "var(--muted)",

                              fontSize:
                                "11px",
                            }}
                          >
                            ID：
                            {
                              placement
                                .assetId
                            }

                            {asset?.category
                              ? ` · ${asset.category}`
                              : ""}
                          </div>

                          <div
                            style={{
                              marginTop:
                                "5px",

                              color:
                              "var(--muted)",
                            }}
                          >
                            {
                              placement
                                .rationale
                            }
                          </div>

                          <button
                            style={{
                              marginTop:
                                "7px",
                            }}
                            disabled={
                              isGeneratingAssets ||
                              regeneratingAssetId !==
                                null
                            }
                            onClick={() =>
                              replaceExistingAssetWithAI(
                                placement.id,
                              )
                            }
                          >
                            Replace with AI-generated Asset
                          </button>
                        </div>
                      </div>
                    );
                  },
                )}
            </div>
          )}

          {generationPlan
            .missingAssets.length >
            0 && (
            <div
              style={{
                display: "grid",
                gap: "8px",
                marginTop: "12px",
                padding: "10px",
                border:
                  "1px solid var(--warning)",
                background: "color-mix(in srgb, var(--warning) 10%, var(--panel))",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <strong
                  style={{
                    color: "var(--warning)",
                  }}
                >
                  New Assets to Generate
                </strong>

                <button
                  className="primary"
                  disabled={
                    isGeneratingAssets
                  }
                  onClick={
                    handleGenerateMissingAssets
                  }
                >
                  {isGeneratingAssets
                    ? "Wanxiang is generating..."
                    : "Generate All Missing Assets"}
                </button>
              </div>

              {generationPlan
                .missingAssets
                .map(
                  (
                    request,
                    index,
                  ) => {
                    const generatedAsset =
                      generatedAssets.find(
                        (asset) =>
                          asset.requestId ===
                          request.id,
                      );

                    const isMapBackground =
                      request.category ===
                      "map_background";

                    return (
                      <div
                        key={request.id}
                        style={{
                          display:
                            "grid",

                          gridTemplateColumns:
                            generatedAsset
                              ? (
                                  isMapBackground
                                    ? "220px 1fr"
                                    : "130px 1fr"
                                )
                              : "1fr",

                          gap: "10px",
                          padding: "8px",

                          border:
                            isMapBackground
                              ? "1px solid var(--candidate)"
                              : "1px solid var(--warning)",

                          background:
                            "var(--elevated)",
                        }}
                      >
                        {generatedAsset && (
                          <img
                            src={
                              generatedAsset
                                .imageUrl
                            }
                            alt={
                              generatedAsset
                                .name
                            }
                            style={{
                              width:
                                isMapBackground
                                  ? "220px"
                                  : "130px",

                              height:
                                isMapBackground
                                  ? "130px"
                                  : "130px",

                              objectFit:
                                "contain",

                              border:
                                "1px solid var(--border)",

                              background:
                                "var(--elevated)",
                            }}
                          />
                        )}

                        <div>
                          <label
                            style={{
                              display:
                                "grid",

                              gap: "4px",
                            }}
                          >
                            {isMapBackground
                              ? "Complete Map Background Name"
                              : "Asset Name"}

                            <input
                              value={
                                request.name
                              }
                              disabled={
                                isGeneratingAssets ||
                                regeneratingAssetId ===
                                  request.id
                              }
                              onChange={(
                                event,
                              ) =>
                                updateMissingAsset(
                                  request.id,
                                  {
                                    name:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              style={{
                                width:
                                  "100%",

                                minHeight:
                                  "32px",

                                padding:
                                  "5px 7px",

                                border:
                                  "1px solid var(--border)",
                              }}
                            />
                          </label>

                          <div
                            style={{
                              marginTop:
                                "6px",

                              color:
                                isMapBackground
                                  ? "var(--candidate)"
                                  : "var(--muted)",

                              fontWeight:
                                isMapBackground
                                  ? 600
                                  : 400,
                            }}
                          >
                            {index + 1}.{" "}

                            {isMapBackground
                                  ? "Complete Map Background"
                              : request.category}
                          </div>

                          <div
                            style={{
                              marginTop:
                                "5px",

                              color:
                                "var(--muted)",
                            }}
                          >
                            {
                              request.rationale
                            }
                          </div>

                          <label
                            style={{
                              display:
                                "grid",

                              gap: "4px",

                              marginTop:
                                "7px",

                              fontSize:
                                "12px",

                              color:
                                "var(--muted)",
                            }}
                          >
                            Image Generation Prompt

                            <textarea
                              value={
                                request
                                  .imagePrompt
                              }
                              disabled={
                                isGeneratingAssets ||
                                regeneratingAssetId ===
                                  request.id
                              }
                              onChange={(
                                event,
                              ) =>
                                updateMissingAsset(
                                  request.id,
                                  {
                                    imagePrompt:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              style={{
                                width:
                                  "100%",

                                minHeight:
                                  isMapBackground
                                    ? "110px"
                                    : "76px",

                                resize:
                                  "vertical",

                                padding:
                                  "6px 7px",

                                border:
                                  "1px solid var(--border)",

                                font:
                                  "inherit",

                                lineHeight:
                                  1.45,
                              }}
                            />
                          </label>

                          <button
                            className="primary"
                            style={{
                              marginTop:
                                "7px",
                            }}
                            disabled={
                              isGeneratingAssets ||
                              regeneratingAssetId !==
                                null ||
                              !request
                                .imagePrompt
                                .trim()
                            }
                            onClick={() =>
                              regenerateSingleAsset(
                                request.id,
                              )
                            }
                          >
                            {regeneratingAssetId ===
                            request.id
                              ? "Regenerating..."
                              : generatedAsset
                                ? (
                                    isMapBackground
                                      ? "Regenerate Complete Background"
                                      : "Regenerate This Asset"
                                  )
                                : (
                                    isMapBackground
                                      ? "Generate Complete Map Background"
                                      : "Generate This Asset"
                                  )}
                          </button>

                          {generatedAsset && (
                            <div
                              style={{
                                marginTop:
                                  "7px",

                                color:
                                  "var(--relief)",
                              }}
                            >
                              {isMapBackground
                                ? "Complete map background generated."
                                : "Asset image generated. You can edit it and regenerate."}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  },
                )}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          position: "relative",
          width: "100%",

          aspectRatio:
            `${canvasWidth} / ${canvasHeight}`,

          maxHeight: "420px",

          border:
            "1px solid var(--border)",

          backgroundColor:
            "var(--elevated)",

          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",

          backgroundSize:
            "40px 40px",

          overflow: "hidden",
        }}
      >
        {confirmedDoodles.map(
          (item, index) => {
            const bounds =
              item.boundingBox;

            if (!bounds) {
              return null;
            }

            return (
              <div
                key={item.id}
                title={
                  item
                    .selectedDescription
                }
                style={{
                  position:
                    "absolute",

                  left:
                    `${(
                      bounds.x /
                      canvasWidth
                    ) * 100}%`,

                  top:
                    `${(
                      bounds.y /
                      canvasHeight
                    ) * 100}%`,

                  width:
                    `${Math.max(
                      4,
                      (
                        bounds.width /
                        canvasWidth
                      ) * 100,
                    )}%`,

                  height:
                    `${Math.max(
                      6,
                      (
                        bounds.height /
                        canvasHeight
                      ) * 100,
                    )}%`,

                  minWidth: "55px",
                  minHeight: "40px",

                  border:
                    "2px solid var(--flow)",

                  background:
                    "rgba(40, 105, 255, 0.12)",

                  display: "grid",
                  placeItems:
                    "center",

                  padding: "3px",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    padding:
                      "2px 5px",

                    background:
                      "var(--elevated)",

                    border:
                      "1px solid var(--flow)",

                    fontSize:
                      "11px",

                    textAlign:
                      "center",
                  }}
                >
                  {index + 1}.{" "}
                  {
                    item
                      .selectedLabel
                  }
                </span>
              </div>
            );
          },
        )}
      </div>

      <div
        style={{
          display: "grid",
          gap: "8px",
          marginTop: "10px",
        }}
      >
        {confirmedDoodles.map(
          (item, index) => (
            <div
              key={item.id}
              style={{
                display: "grid",

                gridTemplateColumns:
                  "90px minmax(130px, 0.7fr) minmax(200px, 1.5fr) auto",

                gap: "8px",
                alignItems: "center",
                padding: "8px",

                border:
                  "1px solid var(--border)",

                background:
                  "var(--elevated)",
              }}
            >
              <img
                src={
                  item.imageDataUrl
                }
                alt={
                  item.selectedLabel
                }
                style={{
                  width: "90px",
                  height: "65px",
                  objectFit:
                    "contain",
                  border:
                    "1px solid var(--border)",
                }}
              />

              <label
                style={{
                  display: "grid",
                  gap: "4px",
                }}
              >
                Element {index + 1}

                <input
                  value={
                    item.selectedLabel
                  }
                  disabled={
                    isConfirmed
                  }
                  onChange={(event) =>
                    updateConfirmedDoodle(
                      item.id,
                      {
                        selectedLabel:
                          event
                            .target
                            .value,
                      },
                    )
                  }
                  style={{
                    width: "100%",
                    minHeight: "32px",
                    padding: "5px 7px",
                    border:
                      "1px solid var(--border)",
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "4px",
                }}
              >
                Detailed Interpretation

                <input
                  value={
                    item
                      .selectedDescription
                  }
                  disabled={
                    isConfirmed
                  }
                  onChange={(event) =>
                    updateConfirmedDoodle(
                      item.id,
                      {
                        selectedDescription:
                          event
                            .target
                            .value,
                      },
                    )
                  }
                  style={{
                    width: "100%",
                    minHeight: "32px",
                    padding: "5px 7px",
                    border:
                      "1px solid var(--border)",
                  }}
                />
              </label>

              <button
                disabled={
                  isConfirmed
                }
                onClick={() =>
                  removeConfirmedDoodle(
                    item.id,
                  )
                }
              >
                Delete
              </button>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
