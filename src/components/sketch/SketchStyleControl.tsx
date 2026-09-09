import { useWorldloomStore } from "../../store/useWorldloomStore";
import { sketchStyles, type SketchSemantic } from "../../core/sketch/semanticStyles";

export function SketchStyleControl() {
  const { sketchSemantic, setSketchSemantic } = useWorldloomStore();
  const entries = Object.entries(sketchStyles) as Array<
    [SketchSemantic, (typeof sketchStyles)[SketchSemantic]]
  >;

  return (
    <div className="sketch-style-control" role="toolbar" aria-label="Sketch semantics">
      {entries.map(([id, style]) => (
        <button
          key={id}
          aria-pressed={sketchSemantic === id}
          title={style.label}
          onClick={() => setSketchSemantic(id)}
        >
          <svg viewBox="0 0 30 12" width="26" height="12" aria-hidden="true">
            <path d="M2 8Q10 1 28 5" fill="none" stroke={style.color} strokeWidth="2" strokeDasharray={style.dash ? "4 3" : undefined} />
            {style.arrow && <path d="m24 1 4 4-5 3" fill="none" stroke={style.color} />}
          </svg>
          <span>{style.label}</span>
        </button>
      ))}
    </div>
  );
}
