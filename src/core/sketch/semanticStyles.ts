export type SketchSemantic =
  | "main-route"
  | "optional-path"
  | "region-contour"
  | "conflict-zone"
  | "uncertain-bypass"
  | "note-arrow";

export const sketchStyles: Record<
  SketchSemantic,
  {
    label: string;
    color: string;
    dash?: string;
    arrow?: boolean;
  }
> = {
  "main-route": {
    label: "Main route",
    color: "var(--text)",
  },

  "optional-path": {
    label: "Optional path",
    color: "var(--flow)",
    dash: "9 6",
  },

  "region-contour": {
    label: "Region contour",
    color: "var(--branch)",
    dash: "7 5",
  },

  "conflict-zone": {
    label: "Conflict zone",
    color: "var(--invalid)",
    dash: "9 5",
  },

  "uncertain-bypass": {
    label: "Uncertain bypass",
    color: "var(--warning)",
    dash: "7 5",
    arrow: true,
  },

  "note-arrow": {
    label: "Note arrow",
    color: "var(--text)",
    arrow: true,
  },
};

export function strokeStyle(value?: string) {
  return (
    sketchStyles[value as SketchSemantic] ??
    sketchStyles["main-route"]
  );
}

export type SemanticItemKind =
  | "question"
  | "reading"
  | "constraint"
  | "uncertainty"
  | "conflict";

export type SemanticItemSource =
  | "demo"
  | "model"
  | "user"
  | "auto_detected"
  | "user_created"
  | "ai_generated"
  | "committed_from_candidate";

export type SemanticItem = {
  id: string;
  kind: SemanticItemKind;

  targetId: string;
  text: string;

  source: SemanticItemSource;

  offset: {
    x: number;
    y: number;
  };

  visualPosition?: {
    x: number;
    y: number;
  };

  status?:
    | "open"
    | "candidate"
    | "committed"
    | "hidden";
};