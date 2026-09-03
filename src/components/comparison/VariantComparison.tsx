import type { LevelVariant } from "../../core/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";

function metric(variant: LevelVariant) {
  const combat = variant.rooms.filter((room) => room.role === "combat").length;
  const relief = variant.rooms.filter((room) => room.role === "relief").length;
  const optional = variant.edges.filter((edge) => edge.role === "optional").length;
  const openness = Math.round(variant.rooms.reduce((sum, room) => sum + room.width * room.height, 0) / Math.max(1, variant.rooms.length * 52));
  const resources = variant.rooms.filter((room) => room.role === "reward" || room.role === "relief").length;
  return { combat, relief, optional, openness, resources };
}

export function VariantComparison() {
  const { project, setWorkingVariant } = useWorldloomStore();
  if (project.variants.length === 0) return <section><h3>Compare Variants</h3><p>Generate variants first.</p></section>;
  const rows = [
    ["Intent Fit", (v: LevelVariant) => v.intentFit],
    ["Flow", (v: LevelVariant) => v.intentFitBreakdown.flow],
    ["Pressure", (v: LevelVariant) => v.intentFitBreakdown.pressure],
    ["Relief", (v: LevelVariant) => v.intentFitBreakdown.relief],
    ["Branch", (v: LevelVariant) => v.intentFitBreakdown.branch],
    ["Critical Path", (v: LevelVariant) => v.validation.criticalPathLength],
    ["Optional Rooms", (v: LevelVariant) => metric(v).optional],
    ["Combat Rooms", (v: LevelVariant) => metric(v).combat],
    ["Relief Rooms", (v: LevelVariant) => metric(v).relief],
    ["Average Openness", (v: LevelVariant) => metric(v).openness],
    ["Estimated Resources", (v: LevelVariant) => metric(v).resources],
    ["Reachable", (v: LevelVariant) => v.validation.reachable ? "yes" : "invalid"],
  ] as const;
  return <section className="comparison"><h3>Compare Variants</h3><table><thead><tr><th>Metric</th>{project.variants.map((variant) => <th key={variant.id}>{variant.name}</th>)}</tr></thead><tbody>{rows.map(([label, read]) => <tr key={label}><td>{label}</td>{project.variants.map((variant) => <td key={variant.id}>{read(variant)}</td>)}</tr>)}</tbody></table><div className="button-row">{project.variants.map((variant) => <button key={variant.id} className={project.workingVariantId === variant.id ? "active" : ""} onClick={() => setWorkingVariant(variant.id)}>Set {variant.name} as Working</button>)}</div></section>;
}