import type {
  GodotMapExport,
} from "../export/godotMapExporter";

import type {
  GodotGenerationPlan,
} from "../../ai/qwenGenerationPlanner";

import type {
  GeneratedAsset,
} from "../../ai/wanAssetGenerator";


const BRIDGE_BASE_URL =
  "http://127.0.0.1:4318";


export type WorldloomBridgeGenerateRequest = {
  map:
    GodotMapExport;

  plan:
    GodotGenerationPlan;

  generatedAssets:
    GeneratedAsset[];

  generationContract:
    GodotMapExport["generationContract"];

  validation:
    GodotMapExport["validation"];

  regenerationScope:
    GodotMapExport["regenerationScope"];
};


export type WorldloomBridgeGenerateResult = {
  ok: boolean;

  scenePath: string;

  message?: string;

  mode?:
    | "full"
    | "local";
};


function buildGenerateRequest(
  map:
    GodotMapExport,

  plan:
    GodotGenerationPlan,

  generatedAssets:
    GeneratedAsset[],
): WorldloomBridgeGenerateRequest {
  return {
    map,

    plan,

    generatedAssets,

    generationContract:
      map.generationContract,

    validation:
      map.validation,

    regenerationScope:
      map.regenerationScope,
  };
}


export async function generateInGodot(
  map:
    GodotMapExport,

  plan:
    GodotGenerationPlan,

  generatedAssets:
    GeneratedAsset[],
): Promise<
  WorldloomBridgeGenerateResult
> {
  const request =
    buildGenerateRequest(
      map,
      plan,
      generatedAssets,
    );

  const response =
    await fetch(
      `${BRIDGE_BASE_URL}/generate`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            request,
          ),
      },
    );

  let result:
    WorldloomBridgeGenerateResult;

  try {
    result =
      await response.json();
  } catch {
    throw new Error(
      "Worldloom Bridge 返回了无法解析的响应。",
    );
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      result.message ??
        `Worldloom Bridge 请求失败：${response.status}`,
    );
  }

  return result;
}