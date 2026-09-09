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

import {
  buildPlayableGenerationContract,
} from "../../core/contract/buildPlayableGenerationContract";

import type {
  PlayableGenerationContract,
} from "../../core/contract/types";


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
          border: "1px solid #c8c5bd",
          background: "#f4f1ea",
          color: "#686868",
          fontSize: "11px",
        }}
      >
        无预览
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
          border: "1px solid #c8c5bd",
          background: "#f4f1ea",
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
        border: "1px solid #c8c5bd",
        background: "#f4f1ea",
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
            "#d7d2c8",

          border:
            "1px solid rgba(0, 0, 0, 0.18)",
        }}
      />
    </div>
  );
}


export function MapUnderstandingPanel() {
  const { project } =
    useWorldloomStore();

  const {
    confirmedDoodles,
    finalMapUnderstanding,
    updateConfirmedDoodle,
    removeConfirmedDoodle,
    confirmOverallMap,
    reopenOverallMap,
  } = useDoodleInterpretationStore();

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

  const [
    generationContract,
    setGenerationContract,
  ] = useState<
    PlayableGenerationContract | null
  >(null);

  const [
    submittedContract,
    setSubmittedContract,
  ] = useState<
    PlayableGenerationContract | null
  >(null);


  useEffect(() => {
    setGenerationContract(null);
    setSubmittedContract(null);
  }, [
    project.sharedLevelDesignState.revision,
    project.seed,
    canvasWidth,
    canvasHeight,
  ]);

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
            "整体地图底图",

          category:
            "map_background",

          rationale:
            "根据整体背景设定和全部地图元素生成统一的地图环境底图。",

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


  const compileGenerationContract =
    (): PlayableGenerationContract => {
      const contract =
        buildPlayableGenerationContract(
          project.sharedLevelDesignState,
          {
            projectId:
              project.projectId,

            seed:
              project.seed,

            canvasWidth,
            canvasHeight,

            regenerationMode:
              "full",

            compiledAt:
              Date.now(),
          },
        );

      setGenerationContract(
        contract,
      );

      setSubmittedContract(
        null,
      );

      setGenerationPlan(null);
      setGeneratedAssets([]);
      setGenerationError("");
      setGodotSuccess("");

      return contract;
    };


  const submitGenerationContract =
    () => {
      const contract =
        generationContract ??
        compileGenerationContract();

      if (
        contract.status ===
        "invalid"
      ) {
        setGenerationError(
          "Generation Contract 存在错误，请先解决冲突后再提交。",
        );

        return;
      }

      setSubmittedContract(
        contract,
      );

      setGenerationError("");
      setGodotSuccess(
        "Generation Contract 已确认，可以进入生成阶段。",
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
            : "生成 Godot 计划时发生未知错误。",
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

      } catch (error) {
        setGenerationError(
          error instanceof Error
            ? error.message
            : "生成缺失素材时发生未知错误。",
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

      } catch (error) {
        setGenerationError(
          error instanceof Error
            ? error.message
            : "重新生成素材时发生未知错误。",
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
                "玩家选择使用 AI 生成自定义版本。",

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
            `发现 ${plan.missingAssets.length} 个待生成素材。请先生成这些素材。`,
          );
        }

        const result =
          await generateInGodot(
            mapExport,
            plan,
            generatedAssets,
          );

        setGodotSuccess(
          `Godot 地图已生成：${result.scenePath}`,
        );

      } catch (error) {
        setGenerationError(
          error instanceof Error
            ? error.message
            : "一键生成到 Godot 时发生未知错误。",
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
        style={{
          width: "100%",
          padding: "12px",
          border:
            "1px solid #c8c5bd",
          background: "#fbfaf6",
        }}
      >
        <h3>整体地图理解</h3>

        <p
          style={{
            marginTop: "8px",
          }}
        >
          暂时没有已确认的涂鸦含义。
        </p>
      </section>
    );
  }


  return (
    <section
      style={{
        width: "100%",
        padding: "12px",

        border: isConfirmed
          ? "1px solid #1f7a4f"
          : "1px solid #c8c5bd",

        background: isConfirmed
          ? "#f1fbf5"
          : "#fbfaf6",
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
          <h3>整体地图理解</h3>

          <p
            style={{
              marginTop: "5px",
            }}
          >
            系统目前理解到{" "}
            {confirmedDoodles.length}{" "}
            个地图元素。
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
              重新修改
            </button>

            <button
              disabled={
                isGeneratingInGodot ||
                isGeneratingAssets
              }
              onClick={exportToGodot}
            >
              导出地图理解
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
                ? "千问正在规划..."
                : "仅生成计划"}
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
                ? "正在生成并启动 Godot..."
                : "一键生成到 Godot"}
            </button>
          </div>
        ) : (
          <button
            className="primary"
            onClick={
              confirmOverallMap
            }
          >
            确认整体地图理解
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
                  "1px solid #1f7a4f",
                background: "#ffffff",
                color: "#1f7a4f",
              }}
            >
              整体地图理解已经确认。当前结果已锁定，可以进入引擎生成阶段。
            </div>

            <div
              style={{
                padding: "10px",
                border:
                  "1px solid #c8c5bd",
                background: "#ffffff",
              }}
            >
              <strong>
                整体背景设定
              </strong>

              <p
                style={{
                  marginTop: "6px",

                  color:
                    finalMapUnderstanding
                      .worldSetting
                      ? "#171717"
                      : "#686868",

                  whiteSpace:
                    "pre-wrap",

                  lineHeight: 1.5,
                }}
              >
                {finalMapUnderstanding
                  .worldSetting ||
                  "未设置，使用默认生成风格。"}
              </p>
            </div>

            <div
              style={{
                padding: "10px",
                border:
                  "1px solid #c8c5bd",
                background: "#ffffff",
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
                    Playable Generation Contract
                  </strong>

                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "12px",
                      color: "#686868",
                    }}
                  >
                    Scene + Spatial + Gameplay
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "6px",
                  }}
                >
                  <button
                    type="button"
                    disabled={
                      isGenerating ||
                      isGeneratingAssets ||
                      isGeneratingInGodot
                    }
                    onClick={
                      compileGenerationContract
                    }
                  >
                    {generationContract
                      ? "重新生成 Contract"
                      : "生成 Contract"}
                  </button>

                  <button
                    type="button"
                    className="primary"
                    disabled={
                      !generationContract ||
                      generationContract.status ===
                        "invalid" ||
                      isGenerating ||
                      isGeneratingAssets ||
                      isGeneratingInGodot
                    }
                    onClick={
                      submitGenerationContract
                    }
                  >
                    {submittedContract
                      ? "已提交"
                      : "提交 Contract"}
                  </button>
                </div>
              </div>

              {!generationContract && (
                <div
                  style={{
                    marginTop: "8px",
                    color: "#686868",
                    fontSize: "12px",
                    lineHeight: 1.45,
                  }}
                >
                  先生成统一 Contract，系统会把场景元素、空间约束和 Gameplay Graph 编译成同一份生成协议。
                </div>
              )}

              {generationContract && (
                <div
                  style={{
                    marginTop: "10px",
                    display: "grid",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      fontSize: "12px",
                    }}
                  >
                    <span>
                      状态：{" "}
                      <strong>
                        {
                          generationContract.status
                        }
                      </strong>
                    </span>

                    <span>
                      Scene：{" "}
                      {
                        generationContract
                          .scene
                          .elements
                          .length
                      }
                    </span>

                    <span>
                      Exact：{" "}
                      {
                        generationContract
                          .spatial
                          .exact
                          .length
                      }
                    </span>

                    <span>
                      Approximate：{" "}
                      {
                        generationContract
                          .spatial
                          .approximate
                          .length
                      }
                    </span>

                    <span>
                      Free：{" "}
                      {
                        generationContract
                          .spatial
                          .free
                          .length
                      }
                    </span>

                    <span>
                      Nodes：{" "}
                      {
                        generationContract
                          .gameplay
                          .nodes
                          .length
                      }
                    </span>

                    <span>
                      Relations：{" "}
                      {
                        generationContract
                          .gameplay
                          .relations
                          .length
                      }
                    </span>

                    <span>
                      Routes：{" "}
                      {
                        generationContract
                          .gameplay
                          .routes
                          .length
                      }
                    </span>
                  </div>

                  {generationContract
                    .issues.length >
                    0 && (
                    <div
                      style={{
                        padding: "8px",
                        border:
                          generationContract.status ===
                          "invalid"
                            ? "1px solid #b42318"
                            : "1px solid #d9aa5d",
                        background:
                          generationContract.status ===
                          "invalid"
                            ? "#fff4f2"
                            : "#fffaf0",
                      }}
                    >
                      <strong>
                        Contract Issues
                      </strong>

                      {generationContract
                        .issues
                        .map(
                          (issue) => (
                            <div
                              key={
                                issue.id
                              }
                              style={{
                                marginTop:
                                  "5px",
                                fontSize:
                                  "12px",
                                lineHeight:
                                  1.45,
                              }}
                            >
                              [
                              {
                                issue.severity
                              }
                              ]{" "}
                              {
                                issue.message
                              }
                            </div>
                          ),
                        )}
                    </div>
                  )}

                  <details>
                    <summary
                      style={{
                        cursor: "pointer",
                        fontWeight: 600,
                      }}
                    >
                      预览完整 Contract
                    </summary>

                    <pre
                      style={{
                        maxHeight: "300px",
                        overflow: "auto",
                        padding: "8px",
                        marginTop: "6px",
                        background:
                          "#f4f1ea",
                        fontSize: "11px",
                        whiteSpace:
                          "pre-wrap",
                      }}
                    >
                      {JSON.stringify(
                        generationContract,
                        null,
                        2,
                      )}
                    </pre>
                  </details>

                  {submittedContract && (
                    <div
                      style={{
                        padding: "8px",
                        border:
                          "1px solid #1f7a4f",
                        background:
                          "#f1fbf5",
                        color:
                          "#1f7a4f",
                        fontSize: "12px",
                      }}
                    >
                      Contract 已确认：{" "}
                      {
                        submittedContract.id
                      }
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                display: "grid",
                gap: "8px",
                padding: "10px",
                border:
                  "1px solid #8b4ab8",
                background: "#faf6ff",
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

                AI 生成整体地图底图
              </label>

              <div
                style={{
                  color: "#686868",
                  fontSize: "12px",
                  lineHeight: 1.45,
                }}
              >
                开启后，系统会根据整体背景设定和所有地图元素生成一张完整底图，并放在所有素材下方。
              </div>

              {includeMapBackground && (
                <label
                  style={{
                    display: "grid",
                    gap: "5px",
                  }}
                >
                  底图附加要求（可选）

                  <textarea
                    value={
                      mapBackgroundPrompt
                    }
                    disabled={
                      isGenerating ||
                      isGeneratingAssets ||
                      isGeneratingInGodot
                    }
                    placeholder="例如：森林更茂密，中央留出开阔区域，整体使用柔和的像素艺术风格。"
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
                        "1px solid #c8c5bd",
                      background: "#ffffff",
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
              "1px solid #b42318",
            background: "#fff4f2",
            color: "#b42318",
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
              "1px solid #1f7a4f",
            background: "#ffffff",
            color: "#1f7a4f",
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
              "1px solid #2869ff",
            background: "#f3f7ff",
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
                Godot 生成计划已完成
              </strong>

              <div
                style={{
                  marginTop: "4px",
                }}
              >
                已匹配{" "}
                {
                  generationPlan
                    .placements.length
                }{" "}
                个已有素材，待生成{" "}
                {
                  generationPlan
                    .missingAssets.length
                }{" "}
                个新素材。
              </div>
            </div>

            <button
              onClick={
                downloadGenerationPlan
              }
            >
              下载生成计划
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
                已有素材匹配
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
                            "1px solid #c8d5f2",

                          background:
                            "#ffffff",
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
                                  "#1f7a4f",

                                fontSize:
                                  "11px",
                              }}
                            >
                              素材库已有
                            </span>
                          </div>

                          <div
                            style={{
                              marginTop:
                                "4px",

                              color:
                                "#686868",

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
                                "#4f4f4f",
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
                            不满意，改为 AI 生成
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
                  "1px solid #d97706",
                background: "#fff8eb",
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
                    color: "#9a4f00",
                  }}
                >
                  需要生成的新素材
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
                    ? "万相正在生成..."
                    : "生成全部缺失素材"}
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
                              ? "1px solid #8b4ab8"
                              : "1px solid #efc27b",

                          background:
                            "#ffffff",
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
                                "1px solid #ddd",

                              background:
                                "#f4f1ea",
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
                              ? "整体地图底图名称"
                              : "素材名称"}

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
                                  "1px solid #c8c5bd",
                              }}
                            />
                          </label>

                          <div
                            style={{
                              marginTop:
                                "6px",

                              color:
                                isMapBackground
                                  ? "#8b4ab8"
                                  : "#686868",

                              fontWeight:
                                isMapBackground
                                  ? 600
                                  : 400,
                            }}
                          >
                            {index + 1}.{" "}

                            {isMapBackground
                              ? "整体地图底图"
                              : request.category}
                          </div>

                          <div
                            style={{
                              marginTop:
                                "5px",

                              color:
                                "#68513a",
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
                                "#686868",
                            }}
                          >
                            图片生成定义

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
                                  "1px solid #c8c5bd",

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
                              ? "正在重新生成..."
                              : generatedAsset
                                ? (
                                    isMapBackground
                                      ? "重新生成整体底图"
                                      : "重新生成这个素材"
                                  )
                                : (
                                    isMapBackground
                                      ? "生成整体地图底图"
                                      : "单独生成这个素材"
                                  )}
                          </button>

                          {generatedAsset && (
                            <div
                              style={{
                                marginTop:
                                  "7px",

                                color:
                                  "#1f7a4f",
                              }}
                            >
                              {isMapBackground
                                ? "整体地图底图已经生成。"
                                : "素材图片已生成，可以继续修改后重新生成。"}
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
            "1px solid #c8c5bd",

          backgroundColor:
            "#f4f1ea",

          backgroundImage:
            "linear-gradient(#d8d4cb 1px, transparent 1px), linear-gradient(90deg, #d8d4cb 1px, transparent 1px)",

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
                    "2px solid #2869ff",

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
                      "#ffffff",

                    border:
                      "1px solid #2869ff",

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
                  "1px solid #c8c5bd",

                background:
                  "#ffffff",
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
                    "1px solid #ddd",
                }}
              />

              <label
                style={{
                  display: "grid",
                  gap: "4px",
                }}
              >
                元素 {index + 1}

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
                      "1px solid #c8c5bd",
                  }}
                />
              </label>

              <label
                style={{
                  display: "grid",
                  gap: "4px",
                }}
              >
                详细理解

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
                      "1px solid #c8c5bd",
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
                删除
              </button>
            </div>
          ),
        )}
      </div>
    </section>
  );
}