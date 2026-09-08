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
            const modelApiKey = env.MODEL_API_KEY || dashscopeApiKey;
            const modelBaseUrl = env.MODEL_BASE_URL || `${DASHSCOPE_BASE_URL}/compatible-mode/v1`;
            const modelName = env.MODEL_NAME || "qwen3.8-flash";
            const readJsonBody = async (request: any) => {
              let rawBody = "";
              for await (const chunk of request) rawBody += chunk.toString();
              return JSON.parse(rawBody || "{}");
            };
            const callModel = async (messages: unknown[]) => {
              if (!modelApiKey) throw new Error("MODEL_API_KEY or DASHSCOPE_API_KEY is not configured on the server.");
              const result = await fetch(`${modelBaseUrl}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${modelApiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: modelName, messages, temperature: 0.2, response_format: { type: "json_object" } }) });
              const payload = await result.json().catch(() => ({}));
              if (!result.ok) throw new Error(payload?.error?.message || `Model service returned ${result.status}`);
              const content = payload?.choices?.[0]?.message?.content;
              const text = typeof content === "string" ? content : Array.isArray(content) ? content.map((part: any) => part.text || "").join("") : "{}";
              return JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
            };
            server.middlewares.use("/api/interpret", async (request, response, next) => {
              if (request.method !== "POST") { next(); return; }
              response.setHeader("Content-Type", "application/json; charset=utf-8");
              try {
                const body = await readJsonBody(request);
                const interpretation = await callModel([
                  { role: "system", content: "You interpret a player's 2D level sketch for Worldloom. Return JSON only with summary, confidence (0..1), dimensions (six semantic axis values 0..1), exactly three candidates [{name,type,description,confidence,dimensions}], alternative_readings [{summary,rationale}], and questions [string]. Types must distinguish environment (terrain, road, water, building, obstacle) from gameplay (enemy stronghold, player spawn, NPC, NPC movement/patrol arrow). Do not generate 3D or code." },
                  { role: "user", content: JSON.stringify(body) },
                ]);
                response.statusCode = 200;
                response.end(JSON.stringify({ ...interpretation, source: "model", model: modelName }));
              } catch (error) {
                response.statusCode = 503;
                response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Model request failed" }));
              }
            });
            server.middlewares.use("/api/generate-contract", async (request, response, next) => {
              if (request.method !== "POST") { next(); return; }
              response.setHeader("Content-Type", "application/json; charset=utf-8");
              try {
                const body = await readJsonBody(request);
                const result = await callModel([{ role: "system", content: "Validate this Worldloom Playable Generation Contract. Return JSON only with status ('ready' or 'needs_review') and note. Never claim to have generated a playable 3D level." }, { role: "user", content: JSON.stringify(body) }]);
                response.statusCode = 200;
                response.end(JSON.stringify({ ...result, source: "model", model: modelName }));
              } catch (error) {
                response.statusCode = 503;
                response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Contract validation failed" }));
              }
            });
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
                        "DASHSCOPE_API_KEY was not found. Check .env.local.",
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
                          "The request does not contain a sketch image.",
                      }),
                    );

                    return;
                  }

                  const prompt =
                    body.prompt ??
                    [
                      "This is a new sketch mark drawn by a player for a 2D game map.",
                      "Determine what the player may intend.",
                      "The mark may represent either an environment element or a gameplay element.",
                      "",
                      "Consider these meanings:",
                      "1. Environment: terrain, road, water, building, obstacle, or landmark.",
                      "2. Enemy base: enemy camp, hostile base, monster lair, or danger zone.",
                      "3. Player spawn: the starting position when the player enters the map.",
                      "4. NPC: a friendly character, merchant, quest character, or resident.",
                      "5. NPC route: a directional arrow showing NPC movement.",
                      "",
                      "If the image is an arrow:",
                      "- First consider whether it shows an NPC route or patrol direction.",
                      "- The tail is the start and the arrowhead is the destination.",
                      "- Describe the start, direction, and destination clearly.",
                      "- Do not assume an arrow is a road asset.",
                      "",
                      "Provide three short, distinct candidate interpretations for the player to confirm.",
                      "Candidate names should clearly describe their function, such as enemy base, player spawn, or NPC patrol route.",
                      "Do not generate a map or code.",
                      "Return JSON only; do not use Markdown.",
                      "",
                      "Response format:",
                      "{",
                      '  "summary": "A short description of the sketch",',
                      '  "candidates": [',
                      "    {",
                      '      "label": "Short option name",',
                      '      "description": "One-sentence explanation of its map or gameplay meaning",',
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
                                  "You help players understand 2D game map sketches and gameplay marks.",
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
                          "Qwen API request failed.",

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
                          : "An unknown error occurred while calling Qwen.",
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
                        "DASHSCOPE_API_KEY was not found. Check .env.local.",
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
                          "Map understanding or asset manifest is missing.",
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
                    "You are a 2D game map generation planning assistant.",
                    "Analyze each map element and decide whether the asset library contains a clear, suitable asset.",
                    "The world setting must influence asset selection, names, colors, art direction, and image prompts.",
                    "",
                    "World setting:",
                    worldSetting ||
                      "Not set; use the default style.",
                    "",
                    "Map elements may use these types:",
                    "- environment: terrain, road, water, building, or obstacle.",
                    "- enemy_base: enemy base, hostile camp, monster lair, or danger zone.",
                    "- player_spawn: player starting position.",
                    "- npc: friendly character, merchant, resident, or quest character.",
                    "- npc_patrol_route: NPC movement or patrol route shown by an arrow.",
                    "",
                    "Arrow rules:",
                    "- The tail is the movement start and the arrowhead is the destination.",
                    "- An arrow expresses direction and endpoints; do not select or generate a road image for it.",
                    "- Do not treat an NPC movement arrow as an ordinary path or environment asset.",
                    "",
                    "Asset rules:",
                    "1. If a suitable asset exists, put the element in placements.",
                    "2. assetId may only use an id that exists in the asset manifest.",
                    "3. If no suitable asset exists, put the element in missingAssets.",
                    "4. Do not force a semantically unrelated asset.",
                    "5. generic_area is only for ordinary, unknown, or generic terrain.",
                    "6. Each map element may appear only once.",
                    "7. Use the map's original canvas coordinates for positions and sizes.",
                    "8. rotation is in degrees and defaults to 0.",
                    "9. imagePrompt for ordinary assets must be in English.",
                    "10. Ordinary imagePrompt text should describe a single object in a top-down 2D game.",
                    "11. Keep all assets consistent in era, colors, and art direction.",
                    "12. Use a clear small marker for player spawn; do not generate a large environment.",
                    "13. Enemy bases may use camp, fortress, lair, or danger-zone assets.",
                    "14. NPCs should be generated as standalone character assets.",
                    "15. Do not put NPC routes in missingAssets or generate an image for them.",
                    "16. enemy_base, player_spawn, npc, and npc_patrol_route must go in gameplayElements.",
                    "17. Do not duplicate gameplay elements in placements or missingAssets.",
                    "18. npc_patrol_route must provide at least two routePoints.",
                    "19. The first routePoint is the tail/start and the last is the arrowhead/destination.",
                    "20. Ordinary gameplay points return an empty routePoints array.",
                    "21. Return JSON only; do not use Markdown.",
                    "",
                    "Response format:",
                    "{",
                    '  "placements": [',
                    "    {",
                    '      "id": "placement-1",',
                    '      "sourceElementId": "source map element id",',
                    '      "assetId": "existing asset id",',
                    '      "rationale": "selection rationale",',
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
                    '      "sourceElementId": "source map element id",',
                    '      "suggestedAssetId": "suggested generated asset id",',
                    '      "name": "new asset name",',
                    '      "category": "environment",',
                    '      "rationale": "why the asset is missing",',
                    '      "imagePrompt": "English image prompt",',
                    '      "size": { "width": 128, "height": 128 },',
                    '      "layer": 1,',
                    '      "collision": false',
                    "    }",
                    "  ]",
                    '  "gameplayElements": [',
                    "    {",
                    '      "id": "gameplay-1",',
                    '      "sourceElementId": "source map element id",',
                    '      "type": "enemy_base, player_spawn, npc, or npc_patrol_route",',
                    '      "name": "gameplay element name",',
                    '      "description": "gameplay function description",',
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
                    "Map understanding result:",
                    JSON.stringify(
                      body.map,
                    ),
                    "",
                    "Available asset manifest:",
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
                                  "Convert map environment and gameplay semantics into a structured placement plan constrained by the asset library.",
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
                          "Qwen generation plan request failed.",

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
                        "An error occurred while generating the plan.",

                      details:
                        error instanceof
                        Error
                          ? error.message
                          : "Unknown error",
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
                        "DASHSCOPE_API_KEY was not found.",
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
                          "Asset prompt or asset id is missing.",
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
                          "Wanxiang task creation failed.",

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
                          "Wanxiang did not return a task id.",

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
                          `Wanxiang task status: ${taskStatus}`,
                      );
                    }
                  }

                  if (!imageUrl) {
                    response.statusCode =
                      504;

                    response.end(
                      JSON.stringify({
                        error:
                          "Timed out waiting for Wanxiang to generate the image.",

                        details:
                          `Last status: ${taskStatus}`,
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
                        "An error occurred while generating the new asset.",

                      details:
                        error instanceof
                        Error
                          ? error.message
                          : "Unknown error",
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
