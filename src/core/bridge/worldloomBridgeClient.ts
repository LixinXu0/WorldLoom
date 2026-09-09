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
const OPEN_GODOT_URL =
  "http://127.0.0.1:4318/open";


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
      "Unable to connect to Worldloom Bridge. Make sure the bridge process is running.",
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
        ? `${data.error ?? "Godot generation failed"}: ${data.details}`
        : data.error ??
            "Godot generation failed.",
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

export async function openGodotScene(): Promise<BridgeGenerationResult> {
  let response: Response;
  try {
    response = await fetch(OPEN_GODOT_URL, { method: "POST" });
  } catch {
    throw new Error("Unable to connect to Worldloom Bridge. Start the bridge before opening Godot.");
  }
  const data = await response.json() as Partial<BridgeGenerationResult> & { error?: string; details?: string };
  if (!response.ok) throw new Error(data.details ? `${data.error ?? "Unable to open Godot"}: ${data.details}` : data.error ?? "Unable to open Godot.");
  return { ok: Boolean(data.ok), message: data.message ?? "Godot opened.", scenePath: data.scenePath ?? "res://generated/worldloom_generated_map.tscn", savedAssets: data.savedAssets ?? [] };
}
