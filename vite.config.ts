import {
  defineConfig,
  loadEnv,
} from "vite";

import react from "@vitejs/plugin-react";


const DASHSCOPE_BASE_URL =
  "https://dashscope.aliyuncs.com";


function wait(
  milliseconds: number,
) {
  return new Promise((resolve) => {
    setTimeout(
      resolve,
      milliseconds,
    );
  });
}


export default defineConfig(
  ({ mode }) => {
    const env = loadEnv(
      mode,
      process.cwd(),
      "",
    );

    const dashscopeApiKey =
      env.DASHSCOPE_API_KEY;

    return {
      plugins: [
        react(),

        {
          name: "qwen-local-api",

          configureServer(server) {
            server.middlewares.use(
              "/api/qwen/interpret",

              async (
                request,
                response,
                next,
              ) => {
                if (
                  request.method !==
                  "POST"
                ) {
                  next();
                  return;
                }

                response.setHeader(
                  "Content-Type",
                  "application/json; charset=utf-8",
                );

                if (!dashscopeApiKey) {
                  response.statusCode =
                    500;

                  response.end(
                    JSON.stringify({
                      error:
                        "没有找到 DASHSCOPE_API_KEY，请检查 .env.local。",
                    }),
                  );

                  return;
                }

                try {
                  let rawBody = "";

                  for await (
                    const chunk
                    of request
                  ) {
                    rawBody +=
                      chunk.toString();
                  }

                  const body =
                    JSON.parse(
                      rawBody,
                    ) as {
                      imageDataUrl?: string;
                      prompt?: string;
                    };

                  if (
                    !body.imageDataUrl
                  ) {
                    response.statusCode =
                      400;

                    response.end(
                      JSON.stringify({
                        error:
                          "请求中没有涂鸦图片。",
                      }),
                    );

                    return;
                  }

                  const prompt =
                    body.prompt ??
                    [
                      "这是一张玩家为2D游戏地图绘制的新增涂鸦。",
                      "请判断玩家可能想表达什么。",
                      "涂鸦既可能是环境，也可能是游戏玩法元素。",
                      "",
                      "需要重点考虑这些含义：",
                      "1. 普通环境：地形、道路、水域、建筑、障碍物或地标。",
                      "2. 敌人据点：敌人营地、敌方基地、怪物巢穴或危险区域。",
                      "3. 玩家出生点：玩家进入地图时的起始位置。",
                      "4. NPC：友方角色、商人、任务角色或普通居民。",
                      "5. NPC移动路线：玩家可能使用带方向的箭头表达NPC移动方向。",
                      "",
                      "如果图像是箭头：",
                      "- 优先考虑它是否表示NPC移动路线或巡逻方向。",
                      "- 箭尾表示起点，箭头表示终点。",
                      "- 描述中明确说明移动起点、移动方向和终点。",
                      "- 不要把箭头默认理解为道路素材。",
                      "",
                      "给出三个简短、不同且适合玩家确认的候选含义。",
                      "候选名称应该清楚说明功能，例如“敌人据点”“玩家出生点”“NPC巡逻路线”。",
                      "不要生成地图，不要生成代码。",
                      "只返回JSON，不要使用Markdown。",
                      "",
                      "返回格式：",
                      "{",
                      '  "summary": "对涂鸦的简短描述",',
                      '  "candidates": [',
                      "    {",
                      '      "label": "简短选项名称",',
                      '      "description": "一句话解释其地图或玩法含义",',
                      '      "confidence": 0.0',
                      "    }",
                      "  ]",
                      "}",
                    ].join("\n");

                  const qwenResponse =
                    await fetch(
                      `${DASHSCOPE_BASE_URL}/compatible-mode/v1/chat/completions`,
                      {
                        method: "POST",

                        headers: {
                          Authorization:
                            `Bearer ${dashscopeApiKey}`,

                          "Content-Type":
                            "application/json",
                        },

                        body:
                          JSON.stringify({
                            model:
                              "qwen-vl-plus",

                            messages: [
                              {
                                role:
                                  "system",

                                content:
                                  "你是一个帮助玩家理解2D游戏地图草图和玩法标记的视觉助手。",
                              },
                              {
                                role:
                                  "user",

                                content: [
                                  {
                                    type:
                                      "image_url",

                                    image_url: {
                                      url:
                                        body.imageDataUrl,
                                    },
                                  },
                                  {
                                    type:
                                      "text",

                                    text:
                                      prompt,
                                  },
                                ],
                              },
                            ],

                            temperature:
                              0.35,
                          }),
                      },
                    );

                  const responseText =
                    await qwenResponse
                      .text();

                  if (
                    !qwenResponse.ok
                  ) {
                    response.statusCode =
                      qwenResponse.status;

                    response.end(
                      JSON.stringify({
                        error:
                          "千问 API 请求失败。",

                        details:
                          responseText,
                      }),
                    );

                    return;
                  }

                  response.statusCode =
                    200;

                  response.end(
                    responseText,
                  );

                } catch (error) {
                  response.statusCode =
                    500;

                  response.end(
                    JSON.stringify({
                      error:
                        error instanceof
                        Error
                          ? error.message
                          : "调用千问时发生未知错误。",
                    }),
                  );
                }
              },
            );


            server.middlewares.use(
              "/api/qwen/generation-plan",

              async (
                request,
                response,
                next,
              ) => {
                if (
                  request.method !==
                  "POST"
                ) {
                  next();
                  return;
                }

                response.setHeader(
                  "Content-Type",
                  "application/json; charset=utf-8",
                );

                if (!dashscopeApiKey) {
                  response.statusCode =
                    500;

                  response.end(
                    JSON.stringify({
                      error:
                        "没有找到 DASHSCOPE_API_KEY，请检查 .env.local。",
                    }),
                  );

                  return;
                }

                try {
                  let rawBody = "";

                  for await (
                    const chunk
                    of request
                  ) {
                    rawBody +=
                      chunk.toString();
                  }

                  const body =
                    JSON.parse(
                      rawBody,
                    ) as {
                      map?: unknown;
                      assetManifest?:
                        unknown;
                    };

                  if (
                    !body.map ||
                    !body.assetManifest
                  ) {
                    response.statusCode =
                      400;

                    response.end(
                      JSON.stringify({
                        error:
                          "缺少地图理解或素材清单。",
                      }),
                    );

                    return;
                  }

                  const mapData =
                    body.map as {
                      worldSetting?:
                        unknown;
                    };

                  const worldSetting =
                    typeof mapData
                      .worldSetting ===
                    "string"
                      ? mapData
                          .worldSetting
                          .trim()
                      : "";

                  const prompt = [
                    "你是一个2D游戏地图生成规划助手。",
                    "请分析每一个地图元素，并判断素材库中是否有语义明确且合适的素材。",
                    "整体背景设定必须影响素材选择、名称、颜色、美术风格和图片生成提示词。",
                    "",
                    "整体背景设定：",
                    worldSetting ||
                      "未设置，使用默认风格。",
                    "",
                    "地图元素可能属于以下类型：",
                    "- environment：普通环境、地形、道路、水域、建筑或障碍。",
                    "- enemy_base：敌人据点、敌方营地、怪物巢穴或危险区域。",
                    "- player_spawn：玩家出生位置或游戏起始点。",
                    "- npc：友方角色、商人、居民或任务角色。",
                    "- npc_patrol_route：由箭头表达的NPC移动或巡逻路线。",
                    "",
                    "箭头处理规则：",
                    "- 箭尾是移动起点，箭头是移动终点。",
                    "- 箭头只表达方向和起止位置，不需要选择或生成道路图片。",
                    "- 不要把NPC移动箭头作为普通路径或环境素材。",
                    "",
                    "素材处理规则：",
                    "1. 如果有合适素材，把元素放入placements。",
                    "2. assetId只能使用素材清单中真实存在的id。",
                    "3. 如果没有合适素材，把元素放入missingAssets。",
                    "4. 不要勉强使用语义不相关的素材。",
                    "5. generic_area只能用于普通区域、未知区域或通用地形。",
                    "6. 每个地图元素只能出现一次。",
                    "7. 位置和尺寸使用地图原始画布坐标。",
                    "8. rotation使用角度，默认值为0。",
                    "9. 普通素材的imagePrompt必须使用英文。",
                    "10. 普通素材的imagePrompt应描述正俯视2D游戏中的单独物体。",
                    "11. 所有素材保持统一时代、色彩和美术风格。",
                    "12. 玩家出生点应该使用清晰的小型标记，不应生成大型环境。",
                    "13. 敌人据点可以生成营地、堡垒、巢穴或危险区域素材。",
                    "14. NPC应该生成为单独角色素材。",
                    "15. NPC移动路线不要加入missingAssets，不要生成图片。",
                    "16. enemy_base、player_spawn、npc和npc_patrol_route必须放入gameplayElements。",
                    "17. 玩法元素不要重复放入placements或missingAssets。",
                    "18. npc_patrol_route必须提供至少两个routePoints。",
                    "19. routePoints第一个点是箭尾起点，最后一个点是箭头终点。",
                    "20. 普通玩法点的routePoints返回空数组。",
                    "21. 只返回JSON，不要使用Markdown。",
                    "",
                    "返回格式：",
                    "{",
                    '  "placements": [',
                    "    {",
                    '      "id": "placement-1",',
                    '      "sourceElementId": "原始元素id",',
                    '      "assetId": "已有素材id",',
                    '      "rationale": "选择原因",',
                    '      "position": { "x": 0, "y": 0 },',
                    '      "size": { "width": 100, "height": 100 },',
                    '      "rotation": 0,',
                    '      "layer": 0,',
                    '      "collision": false',
                    "    }",
                    "  ],",
                    '  "missingAssets": [',
                    "    {",
                    '      "id": "missing-asset-1",',
                    '      "sourceElementId": "原始元素id",',
                    '      "suggestedAssetId": "建议的新素材id",',
                    '      "name": "新素材名称",',
                    '      "category": "environment",',
                    '      "rationale": "缺少原因",',
                    '      "imagePrompt": "English image prompt",',
                    '      "size": { "width": 128, "height": 128 },',
                    '      "layer": 1,',
                    '      "collision": false',
                    "    }",
                    "  ]",
                    '  "gameplayElements": [',
                    "    {",
                    '      "id": "gameplay-1",',
                    '      "sourceElementId": "原始元素id",',
                    '      "type": "enemy_base、player_spawn、npc或npc_patrol_route",',
                    '      "name": "玩法元素名称",',
                    '      "description": "玩法功能说明",',
                    '      "position": { "x": 0, "y": 0 },',
                    '      "size": { "width": 80, "height": 80 },',
                    '      "routePoints": [',
                    '        { "x": 0, "y": 0 },',
                    '        { "x": 100, "y": 100 }',
                    "      ],",
                    '      "layer": 10',
                    "    }",
                    "  ]",
                    "}",
                    "",
                    "地图理解结果：",
                    JSON.stringify(
                      body.map,
                    ),
                    "",
                    "可用素材清单：",
                    JSON.stringify(
                      body.assetManifest,
                    ),
                  ].join("\n");

                  const qwenResponse =
                    await fetch(
                      `${DASHSCOPE_BASE_URL}/compatible-mode/v1/chat/completions`,
                      {
                        method: "POST",

                        headers: {
                          Authorization:
                            `Bearer ${dashscopeApiKey}`,

                          "Content-Type":
                            "application/json",
                        },

                        body:
                          JSON.stringify({
                            model:
                              "qwen3.8-flash",

                            messages: [
                              {
                                role:
                                  "system",

                                content:
                                  "你负责把地图环境和玩法语义转换为受素材库约束的结构化放置计划。",
                              },
                              {
                                role:
                                  "user",

                                content:
                                  prompt,
                              },
                            ],

                            temperature:
                              0.2,
                          }),
                      },
                    );

                  const responseText =
                    await qwenResponse
                      .text();

                  if (
                    !qwenResponse.ok
                  ) {
                    response.statusCode =
                      qwenResponse.status;

                    response.end(
                      JSON.stringify({
                        error:
                          "千问生成计划请求失败。",

                        details:
                          responseText,
                      }),
                    );

                    return;
                  }

                  response.statusCode =
                    200;

                  response.end(
                    responseText,
                  );

                } catch (error) {
                  response.statusCode =
                    500;

                  response.end(
                    JSON.stringify({
                      error:
                        "生成计划时发生错误。",

                      details:
                        error instanceof
                        Error
                          ? error.message
                          : "未知错误",
                    }),
                  );
                }
              },
            );


            server.middlewares.use(
              "/api/wan/generate-asset",

              async (
                request,
                response,
                next,
              ) => {
                if (
                  request.method !==
                  "POST"
                ) {
                  next();
                  return;
                }

                response.setHeader(
                  "Content-Type",
                  "application/json; charset=utf-8",
                );

                if (!dashscopeApiKey) {
                  response.statusCode =
                    500;

                  response.end(
                    JSON.stringify({
                      error:
                        "没有找到 DASHSCOPE_API_KEY。",
                    }),
                  );

                  return;
                }

                try {
                  let rawBody = "";

                  for await (
                    const chunk
                    of request
                  ) {
                    rawBody +=
                      chunk.toString();
                  }

                  const body =
                    JSON.parse(
                      rawBody,
                    ) as {
                      requestId?: string;
                      sourceElementId?:
                        string;
                      assetId?: string;
                      name?: string;
                      category?: string;
                      prompt?: string;
                    };

                  if (
                    !body.prompt ||
                    !body.assetId
                  ) {
                    response.statusCode =
                      400;

                    response.end(
                      JSON.stringify({
                        error:
                          "缺少素材提示词或素材ID。",
                      }),
                    );

                    return;
                  }

                  const isMapBackground =
                    body.category ===
                    "map_background";

                  const finalPrompt =
                    isMapBackground
                      ? [
                          body.prompt,
                          "complete top-down 2D game map ground background",
                          "continuous flat terrain",
                          "fill the entire rectangular canvas from edge to edge",
                          "soft low-contrast background",
                          "no central subject",
                          "no isolated object",
                          "no floating island",
                          "no platform",
                          "no card",
                          "no decorative frame",
                          "no border",
                          "no text",
                          "no user interface",
                          "no transparent background",
                        ].join(", ")

                      : [
                          body.prompt,
                          "top-down 2D game asset",
                          "single isolated object",
                          "centered composition",
                          "plain white background",
                          "no text",
                          "no interface",
                          "consistent clean game art style",
                        ].join(", ");

                  const negativePrompt =
                    isMapBackground
                      ? [
                          "central object",
                          "single object",
                          "cube",
                          "floating island",
                          "platform",
                          "card",
                          "frame",
                          "border",
                          "text",
                          "letters",
                          "logo",
                          "watermark",
                          "user interface",
                          "transparent background",
                          "white empty background",
                        ].join(", ")

                      : [
                          "text",
                          "letters",
                          "logo",
                          "watermark",
                          "user interface",
                          "multiple objects",
                          "people",
                          "hands",
                          "blurry",
                          "low quality",
                        ].join(", ");

                  const createResponse =
                    await fetch(
                      `${DASHSCOPE_BASE_URL}/api/v1/services/aigc/text2image/image-synthesis`,
                      {
                        method: "POST",

                        headers: {
                          Authorization:
                            `Bearer ${dashscopeApiKey}`,

                          "Content-Type":
                            "application/json",

                          "X-DashScope-Async":
                            "enable",
                        },

                        body:
                          JSON.stringify({
                            model:
                              "wan2.2-t2i-flash",

                            input: {
                              prompt:
                                finalPrompt,

                              negative_prompt:
                                negativePrompt,
                            },

                            parameters: {
                              size:
                                "1024*1024",

                              n: 1,

                              prompt_extend:
                                false,

                              watermark:
                                false,
                            },
                          }),
                      },
                    );

                  const createText =
                    await createResponse
                      .text();

                  if (
                    !createResponse.ok
                  ) {
                    response.statusCode =
                      createResponse.status;

                    response.end(
                      JSON.stringify({
                        error:
                          "万相任务创建失败。",

                        details:
                          createText,
                      }),
                    );

                    return;
                  }

                  const createData =
                    JSON.parse(
                      createText,
                    ) as {
                      output?: {
                        task_id?: string;
                      };
                    };

                  const taskId =
                    createData.output
                      ?.task_id;

                  if (!taskId) {
                    response.statusCode =
                      500;

                    response.end(
                      JSON.stringify({
                        error:
                          "万相没有返回任务ID。",

                        details:
                          createText,
                      }),
                    );

                    return;
                  }

                  let imageUrl = "";
                  let taskStatus =
                    "PENDING";

                  for (
                    let attempt = 0;
                    attempt < 30;
                    attempt += 1
                  ) {
                    await wait(3000);

                    const taskResponse =
                      await fetch(
                        `${DASHSCOPE_BASE_URL}/api/v1/tasks/${taskId}`,
                        {
                          headers: {
                            Authorization:
                              `Bearer ${dashscopeApiKey}`,
                          },
                        },
                      );

                    const taskText =
                      await taskResponse
                        .text();

                    if (
                      !taskResponse.ok
                    ) {
                      throw new Error(
                        taskText,
                      );
                    }

                    const taskData =
                      JSON.parse(
                        taskText,
                      ) as {
                        output?: {
                          task_status?:
                            string;

                          results?: Array<{
                            url?: string;
                          }>;

                          choices?: Array<{
                            message?: {
                              content?: Array<{
                                image?:
                                  string;
                              }>;
                            };
                          }>;
                        };

                        message?: string;
                      };

                    taskStatus =
                      taskData.output
                        ?.task_status ??
                      "UNKNOWN";

                    if (
                      taskStatus ===
                      "SUCCEEDED"
                    ) {
                      imageUrl =
                        taskData.output
                          ?.results?.[0]
                          ?.url ??
                        taskData.output
                          ?.choices?.[0]
                          ?.message
                          ?.content?.[0]
                          ?.image ??
                        "";

                      break;
                    }

                    if (
                      taskStatus ===
                        "FAILED" ||
                      taskStatus ===
                        "CANCELED" ||
                      taskStatus ===
                        "UNKNOWN"
                    ) {
                      throw new Error(
                        taskData.message ??
                          `万相任务状态：${taskStatus}`,
                      );
                    }
                  }

                  if (!imageUrl) {
                    response.statusCode =
                      504;

                    response.end(
                      JSON.stringify({
                        error:
                          "等待万相生成图片超时。",

                        details:
                          `最后状态：${taskStatus}`,
                      }),
                    );

                    return;
                  }

                  response.statusCode =
                    200;

                  response.end(
                    JSON.stringify({
                      requestId:
                        body.requestId ??
                        "",

                      sourceElementId:
                        body
                          .sourceElementId ??
                        "",

                      assetId:
                        body.assetId,

                      name:
                        body.name ??
                        body.assetId,

                      category:
                        body.category ??
                        "object",

                      imageUrl,
                    }),
                  );

                } catch (error) {
                  response.statusCode =
                    500;

                  response.end(
                    JSON.stringify({
                      error:
                        "生成新素材时发生错误。",

                      details:
                        error instanceof
                        Error
                          ? error.message
                          : "未知错误",
                    }),
                  );
                }
              },
            );
          },
        },
      ],

      server: {
        watch: {
          ignored: [
            "**/.vs/**",
          ],

          usePolling: true,
          interval: 500,
        },
      },
    };
  },
);