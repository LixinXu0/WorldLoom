import {
  SEMANTIC_STYLES,
  type SemanticStyleKey,
} from "../../core/sketch/semanticStyles";

type SketchStyleControlProps = {
  value: SemanticStyleKey;
  onChange: (value: SemanticStyleKey) => void;
  compact?: boolean;
};

export function SketchStyleControl({
  value,
  onChange,
  compact = false,
}: SketchStyleControlProps) {
  const entries = Object.values(SEMANTIC_STYLES);

  return (
    <div
      className={
        compact
          ? "sketch-style-control sketch-style-control--compact"
          : "sketch-style-control"
      }
    >
      {entries.map((style) => {
        const active = value === style.key;

        return (
          <button
            key={style.key}
            type="button"
            className={
              active
                ? "sketch-style-option is-active"
                : "sketch-style-option"
            }
            onClick={() => onChange(style.key)}
            title={style.label}
            aria-pressed={active}
          >
            <span
              className="sketch-style-option__swatch"
              style={{
                borderColor: style.stroke,
                background: style.fill,
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