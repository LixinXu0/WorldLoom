import { useWorldloomStore } from "../../store/useWorldloomStore";

export function StrokeInspector({ id }: { id: string }) {
  const { project, updateSelectedStroke, deleteStroke } = useWorldloomStore();
  const stroke = project.strokes.find((item) => item.id === id);
  if (!stroke) return null;
  const length = stroke.points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - stroke.points[index].x, point.y - stroke.points[index].y), 0);
  const xs = stroke.points.map((point) => point.x);
  const ys = stroke.points.map((point) => point.y);
  const possible = project.constraints.filter((constraint) => constraint.sourceStrokeIds.includes(stroke.id));
  return <section><h3>Stroke</h3><dl><dt>id</dt><dd>{stroke.id}</dd><dt>type</dt><dd>{stroke.type}</dd><dt>length</dt><dd>{Math.round(length)}</dd><dt>coverage</dt><dd>{Math.round(Math.min(...xs))},{Math.round(Math.min(...ys))} / {Math.round(Math.max(...xs) - Math.min(...xs))}x{Math.round(Math.max(...ys) - Math.min(...ys))}</dd></dl><label>Intensity<input type="range" min="0.1" max="1" step="0.05" value={stroke.intensity} onChange={(event) => updateSelectedStroke({ intensity: Number(event.target.value) })} /></label><label>Width<input type="range" min="4" max="34" value={stroke.width} onChange={(event) => updateSelectedStroke({ width: Number(event.target.value) })} /></label><label className="inline"><input type="checkbox" checked={stroke.enabled} onChange={(event) => updateSelectedStroke({ enabled: event.target.checked })} /> Enabled</label><h4>Likely constraints</h4>{possible.length === 0 ? <p>Compile intent to inspect mappings.</p> : possible.map((constraint) => <button className="row-button" key={constraint.id} onClick={() => useWorldloomStore.setState({ selected: { kind: "constraint", id: constraint.id } })}>{constraint.target}</button>)}<button className="danger" onClick={() => deleteStroke(stroke.id)}>Delete stroke</button></section>;
}
