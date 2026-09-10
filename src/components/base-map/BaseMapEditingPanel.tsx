import { surfaceMaterial, surfaceMaterials } from "../../core/baseMap";
import type { SurfaceMaterialId } from "../../core/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";

export type BaseMapMode = "surface" | "accessibility" | "collision";
export type SurfaceTool = "paint" | "fill" | "erase";
export type AccessibilityTool = "walkable" | "blocked" | "erase";
export type CollisionTool = "line" | "shape" | "erase";

export type BaseMapEditingSettings = {
  mode: BaseMapMode;
  surfaceTool: SurfaceTool;
  accessibilityTool: AccessibilityTool;
  collisionTool: CollisionTool;
  materialId: SurfaceMaterialId;
  brushSize: number;
  materialScale: number;
};

export function BaseMapEditingPanel({ settings, onChange, onExit }: {
  settings: BaseMapEditingSettings;
  onChange: (patch: Partial<BaseMapEditingSettings>) => void;
  onExit: () => void;
}) {
  const { project, setMapLayerVisible } = useWorldloomStore();
  const layers = project.mapLayers;
  const tools = settings.mode === "surface"
    ? (["paint", "fill", "erase"] as const)
    : settings.mode === "accessibility"
      ? (["walkable", "blocked", "erase"] as const)
      : (["line", "shape", "erase"] as const);
  const activeTool = settings.mode === "surface" ? settings.surfaceTool : settings.mode === "accessibility" ? settings.accessibilityTool : settings.collisionTool;
  const setActiveTool = (tool: string) => onChange(settings.mode === "surface" ? { surfaceTool: tool as SurfaceTool } : settings.mode === "accessibility" ? { accessibilityTool: tool as AccessibilityTool } : { collisionTool: tool as CollisionTool });

  return <div className="base-map-editor">
    <div className="segmented-control" aria-label="Base map editing mode">
      {(["surface", "accessibility", "collision"] as const).map((mode) => <button key={mode} className={settings.mode === mode ? "active" : ""} aria-pressed={settings.mode === mode} onClick={() => onChange({ mode })}>{mode}</button>)}
    </div>
    <div className="base-map-tool-row" role="toolbar" aria-label={`${settings.mode} tools`}>
      {tools.map((tool) => <button key={tool} className={activeTool === tool ? "active" : ""} aria-pressed={activeTool === tool} onClick={() => setActiveTool(tool)}>{tool}</button>)}
    </div>

    {settings.mode === "surface" && <>
      <section className="material-library"><h3>Materials</h3><div className="material-grid">
        {surfaceMaterials.map((material) => <button key={material.id} className={`material-card material-${material.id} ${settings.materialId === material.id ? "active" : ""}`} draggable onDragStart={(event) => event.dataTransfer.setData("application/worldloom-material", material.id)} onClick={() => onChange({ materialId: material.id })} title={`Use ${material.name}`}><span className="material-thumbnail"/><strong>{material.name}</strong></button>)}
      </div></section>
      <label className="compact-slider"><span>Brush Size</span><input aria-label="Brush Size" type="range" min="12" max="140" step="4" value={settings.brushSize} onChange={(event) => onChange({ brushSize: Number(event.target.value) })}/><small>{settings.brushSize}</small></label>
      <label className="compact-slider"><span>Material Scale</span><input aria-label="Material Scale" type="range" min="50" max="180" step="10" value={Math.round(settings.materialScale * 100)} onChange={(event) => onChange({ materialScale: Number(event.target.value) / 100 })}/><small>{settings.materialScale.toFixed(1)}×</small></label>
      <small className="base-map-help">{settings.surfaceTool === "fill" ? `Click the board to fill it with ${surfaceMaterial(settings.materialId).name}.` : "Paint directly on the board. Double-click a mark to inspect it."}</small>
    </>}
    {settings.mode === "accessibility" && <><label className="compact-slider"><span>Brush Size</span><input aria-label="Accessibility Brush Size" type="range" min="18" max="180" step="4" value={settings.brushSize} onChange={(event) => onChange({ brushSize: Number(event.target.value) })}/><small>{settings.brushSize}</small></label><small className="base-map-help">Marks occupancy only; it does not create a route or collision.</small></>}
    {settings.mode === "collision" && <small className="base-map-help">Drag a line boundary or drag out a closed obstacle shape.</small>}

    <section className="base-map-view"><h3>View</h3>{([
      ["surfaceVisible", "Surface"],
      ["accessibilityVisible", "Accessibility"],
      ["collisionVisible", "Collision"],
    ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={layers?.[key] ?? key === "surfaceVisible"} onChange={(event) => setMapLayerVisible(key, event.target.checked)}/><span>{label}</span></label>)}</section>
    <button className="text-action base-map-exit" onClick={onExit}>Exit Base Map Editing</button>
  </div>;
}
