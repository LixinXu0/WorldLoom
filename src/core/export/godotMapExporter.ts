import type {
  FinalMapUnderstanding,
} from "../../store/useDoodleInterpretationStore";


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


export type GodotMapExport = {
  schemaVersion: "1.1";
  targetEngine: "godot";
  generatedAt: string;

  worldSetting: string;

  canvas: {
    width: number;
    height: number;
  };

  mapUnderstandingId: string;
  elements: GodotMapElement[];
};


export function buildGodotMapExport(
  understanding:
    FinalMapUnderstanding,

  canvasWidth: number,
  canvasHeight: number,
): GodotMapExport {
  const elements =
    understanding.doodles.map(
      (doodle) => {
        const bounds =
          doodle.boundingBox;

        const centerX = bounds
          ? bounds.x +
            bounds.width / 2
          : canvasWidth / 2;

        const centerY = bounds
          ? bounds.y +
            bounds.height / 2
          : canvasHeight / 2;

        return {
          id: doodle.id,

          name:
            doodle.selectedLabel,

          description:
            doodle.selectedDescription,

          source: doodle.source,

          position: {
            x: centerX,
            y: centerY,

            normalizedX:
              centerX / canvasWidth,

            normalizedY:
              centerY / canvasHeight,
          },

          bounds: bounds
            ? {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
              }
            : null,
        };
      },
    );

  return {
    schemaVersion: "1.1",
    targetEngine: "godot",
    generatedAt:
      new Date().toISOString(),

    worldSetting:
      understanding.worldSetting,

    canvas: {
      width: canvasWidth,
      height: canvasHeight,
    },

    mapUnderstandingId:
      understanding.id,

    elements,
  };
}


export function downloadGodotMapJson(
  mapExport: GodotMapExport,

  filename =
    "worldloom-godot-map.json",
): void {
  const json = JSON.stringify(
    mapExport,
    null,
    2,
  );

  const blob = new Blob(
    [json],
    {
      type: "application/json",
    },
  );

  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}