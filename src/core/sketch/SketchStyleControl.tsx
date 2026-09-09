import {
  sketchStyles,
  type SketchSemantic,
} from "../../core/sketch/semanticStyles";

type SketchStyleControlProps = {
  value: SketchSemantic;
  onChange: (value: SketchSemantic) => void;
  compact?: boolean;
};

export function SketchStyleControl({
  value,
  onChange,
  compact = false,
}: SketchStyleControlProps) {
  const entries = Object.entries(sketchStyles) as Array<
    [SketchSemantic, (typeof sketchStyles)[SketchSemantic]]
  >;

  return (
    <div
      className={
        compact
          ? "sketch-style-control sketch-style-control--compact"
          : "sketch-style-control"
      }
    >
      {entries.map(([key, style]) => {
        const active = value === key;

        return (
          <button
            key={key}
            type="button"
            className={
              active
                ? "sketch-style-option is-active"
                : "sketch-style-option"
            }
            onClick={() => onChange(key)}
            title={style.label}
            aria-pressed={active}
          >
            <span
              className="sketch-style-option__swatch"
              style={{
                borderColor: style.color,
                background: "transparent",
              }}
            />

            {!compact && (
              <span className="sketch-style-option__label">
                {style.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
