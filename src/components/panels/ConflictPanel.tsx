import { useWorldloomStore } from "../../store/useWorldloomStore";

export function ConflictPanel() {
  const conflicts = useWorldloomStore((state) => state.project.conflicts);
  if (conflicts.length === 0) return <section><h3>Conflicts</h3><p>No rule conflicts detected.</p></section>;
  return <section><h3>Conflicts</h3>{conflicts.map((conflict) => <div className={`conflict ${conflict.severity}`} key={conflict.id}><strong>{conflict.type}</strong><p>{conflict.message}</p><small>{conflict.suggestedResolutions.join(" / ")}</small></div>)}</section>;
}
