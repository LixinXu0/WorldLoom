import type {
  GodotMapExport,
} from "../export/godotMapExporter";

import type {
  GodotGenerationPlan,
} from "../../ai/qwenGenerationPlanner";

import type {
  GeneratedAsset,
} from "../../ai/wanAssetGenerator";


const BRIDGE_URL =
  "http://127.0.0.1:4318/generate";


export type BridgeGenerationResult = {
  ok: boolean;
  message: string;
  scenePath: string;
  savedAssets: string[];
};


export async function generateInGodot(
  map: GodotMapExport,
  generationPlan: GodotGenerationPlan,
  generatedAssets: GeneratedAsset[] = [],
): Promise<BridgeGenerationResult> {
  let response: Response;

  try {
    response = await fetch(
      BRIDGE_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          map,
          generationPlan,
          generatedAssets,
        }),
      },
    );

  } catch {
    throw new Error(
      "无法连接 Worldloom Bridge。请确认 bridge 程序正在运行。",
    );
  }

  const data = (
    await response.json()
  ) as {
    ok?: boolean;
    message?: string;
    scenePath?: string;
    savedAssets?: string[];
    error?: string;
    details?: string;
  };

  if (!response.ok) {
    throw new Error(
      data.details
        ? `${data.error ?? "Godot 生成失败"}：${data.details}`
        : data.error ??
            "Godot 生成失败。",
    );
  }

  return {
    ok: Boolean(data.ok),

    message:
      data.message ??
      "Worldloom scene generated.",

    scenePath:
      data.scenePath ??
      "res://generated/worldloom_generated_map.tscn",

    savedAssets:
      data.savedAssets ?? [],
  };
}