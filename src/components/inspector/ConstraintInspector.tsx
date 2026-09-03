import { useWorldloomStore } from "../../store/useWorldloomStore";

export function ConstraintInspector({ id }: { id: string }) {
  const constraint = useWorldloomStore((state) => state.project.constraints.find((item) => item.id === id));
  if (!constraint) return null;
  return <section><h3>Constraint</h3><dl><dt>id</dt><dd>{constraint.id}</dd><dt>source strokes</dt><dd>{constraint.sourceStrokeIds.join(", ") || "default"}</dd><dt>target</dt><dd>{constraint.target}</dd><dt>preferred</dt><dd>{constraint.preferredValue.toFixed(2)}</dd><dt>confidence</dt><dd>{constraint.weight.toFixed(2)}</dd><dt>hard</dt><dd>{constraint.hard ? "yes" : "no"}</dd><dt>enabled</dt><dd>{constraint.enabled ? "yes" : "no"}</dd></dl><p>{constraint.explanation}</p></section>;
}
