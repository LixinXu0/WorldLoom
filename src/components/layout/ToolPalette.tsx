import type { Tool } from "../../core/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import { AssetLibraryPanel } from "../assets/AssetLibraryPanel";

const tools: Array<{ id: Tool; label: string }> = [
  { id: "select", label: "Select" },
  { id: "flow", label: "Flow" },
  { id: "pressure", label: "Pressure" },
  { id: "relief", label: "Relief" },
  { id: "branch", label: "Branch" },
  { id: "eraser", label: "Eraser" },
  { id: "delete", label: "Delete" },
];

export function ToolPalette() {
  const { activeTool, setTool, brushWidth, brushIntensity, setBrushWidth, setBrushIntensity, clearStrokes, selected, deleteStroke, project } = useWorldloomStore();
  const isLegacy = project.researchMode === "legacy-rule-based" || project.researchMode === "c1-rule-based";

  if (!isLegacy) return <AssetLibraryPanel />;

  return (
    <aside className="tool-palette">
      <h3>Legacy Intent Tools</h3>
      {tools.map((tool) => <button key={tool.id} className={activeTool === tool.id ? "active" : ""} onClick={() => tool.id === "delete" && selected?.kind === "stroke" ? deleteStroke(selected.id) : setTool(tool.id)}>{tool.label}</button>)}
      <div className="tool-controls">
        <label>Width<input type="range" min="4" max="34" value={brushWidth} onChange={(event) => setBrushWidth(Number(event.target.value))} /></label>
        <label>Intensity<input type="range" min="0.1" max="1" step="0.05" value={brushIntensity} onChange={(event) => setBrushIntensity(Number(event.target.value))} /></label>
        <button onClick={clearStrokes}>Clear</button>
      </div>
    </aside>
  );
}
