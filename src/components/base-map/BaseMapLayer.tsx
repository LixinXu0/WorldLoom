import { useEffect, useRef } from "react";
import { surfaceMaterial } from "../../core/baseMap";
import type { BaseMapPoint, SurfaceMaterialId, WorldloomProject } from "../../core/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";

export type BaseMapDraft = { kind: "surface" | "accessibility" | "collision"; points: BaseMapPoint[]; brushSize?: number; state?: "walkable" | "blocked"; collisionType?: "line" | "polygon"; materialId?: SurfaceMaterialId; operation?: "paint" | "erase"; materialScale?: number } | null;

function patternFor(context: CanvasRenderingContext2D, materialId: SurfaceMaterialId, scale: number) {
  const material = surfaceMaterial(materialId);
  const size = Math.max(12, Math.round(28 * scale));
  const tile = document.createElement("canvas");
  tile.width = tile.height = size;
  const tileContext = tile.getContext("2d")!;
  tileContext.fillStyle = material.colors[0];
  tileContext.fillRect(0, 0, size, size);
  if (materialId === "water") {
    tileContext.strokeStyle = material.colors[1]; tileContext.globalAlpha = .65; tileContext.lineWidth = Math.max(1, scale);
    for (let y = size * .25; y < size; y += size * .4) { tileContext.beginPath(); tileContext.moveTo(-2, y); tileContext.quadraticCurveTo(size * .25, y - 3, size * .5, y); tileContext.quadraticCurveTo(size * .75, y + 3, size + 2, y); tileContext.stroke(); }
  } else if (materialId === "stone") {
    tileContext.strokeStyle = material.colors[2]; tileContext.globalAlpha = .52; tileContext.lineWidth = 1;
    tileContext.strokeRect(1, 1, size * .62, size * .48); tileContext.strokeRect(size * .45, size * .58, size * .55, size * .4);
  } else if (materialId === "grass") {
    tileContext.strokeStyle = material.colors[1]; tileContext.globalAlpha = .7; tileContext.lineWidth = 1;
    [[.18,.7],[.48,.35],[.76,.78]].forEach(([x,y]) => { tileContext.beginPath(); tileContext.moveTo(size*x,size*y); tileContext.lineTo(size*(x+.07),size*(y-.22)); tileContext.stroke(); });
  } else {
    tileContext.fillStyle = material.colors[1]; tileContext.globalAlpha = .48;
    [[.18,.22,1.5],[.63,.3,1],[.42,.73,1.3],[.86,.82,.8]].forEach(([x,y,r]) => { tileContext.beginPath(); tileContext.arc(size*x,size*y,Math.max(1,r*scale),0,Math.PI*2); tileContext.fill(); });
  }
  return context.createPattern(tile, "repeat")!;
}

function drawSurface(context: CanvasRenderingContext2D, surface: { geometry: "stroke" | "fill"; operation: "paint" | "erase"; points: BaseMapPoint[]; materialId: SurfaceMaterialId; brushSize: number; materialScale: number }, width: number, height: number) {
  context.save();
  context.globalCompositeOperation = surface.operation === "erase" ? "destination-out" : "source-over";
  context.fillStyle = patternFor(context, surface.materialId, surface.materialScale);
  context.strokeStyle = context.fillStyle;
  if (surface.geometry === "fill") context.fillRect(0, 0, width, height);
  else if (surface.points.length) {
    context.lineWidth = surface.brushSize; context.lineCap = "round"; context.lineJoin = "round";
    context.beginPath(); context.moveTo(surface.points[0].x, surface.points[0].y);
    if (surface.points.length === 1) context.lineTo(surface.points[0].x + .01, surface.points[0].y + .01);
    else surface.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  }
  context.restore();
}

const points = (items: BaseMapPoint[]) => items.map((point) => `${point.x},${point.y}`).join(" ");

export function BaseMapLayer({ project, draft, hover }: { project: WorldloomProject; draft: BaseMapDraft; hover?: { point: BaseMapPoint; radius: number } | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { canvasWidth: width, canvasHeight: height } = project.metadata;
  const surfaceVisible = project.mapLayers?.surfaceVisible ?? true;
  useEffect(() => {
    const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (!canvas || !context) return;
    context.clearRect(0, 0, width, height);
    if (!surfaceVisible) return;
    project.baseMap.surfaces.forEach((surface) => drawSurface(context, surface, width, height));
    if (draft?.kind === "surface" && draft.materialId && draft.operation) drawSurface(context, { geometry: "stroke", operation: draft.operation, points: draft.points, materialId: draft.materialId, brushSize: draft.brushSize ?? 48, materialScale: draft.materialScale ?? 1 }, width, height);
  }, [project.baseMap.surfaces, draft, height, surfaceVisible, width]);

  const selected = useWorldloomStore((state) => state.selected?.id);
  const accessibilityVisible = project.mapLayers?.accessibilityVisible ?? false;
  const collisionVisible = project.mapLayers?.collisionVisible ?? false;
  return <div className="base-map-canvas-layer" aria-hidden="true">
    <canvas ref={canvasRef} width={width} height={height}/>
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {accessibilityVisible && project.baseMap.accessibilityZones.map((zone) => zone.geometry === "polygon" ? <polygon key={zone.id} points={points(zone.points)} fill={zone.state === "walkable" ? "#6e9a7838" : "#a26e6838"} stroke={zone.state === "walkable" ? "#6e9a78" : "#a26e68"} strokeWidth={selected === zone.id ? 3 : 1} strokeDasharray="2 4" className={selected === zone.id ? "selected" : ""}/> : <polyline key={zone.id} points={points(zone.points)} fill="none" stroke={zone.state === "walkable" ? "#6e9a78" : "#a26e68"} strokeOpacity=".34" strokeWidth={zone.brushSize} strokeLinecap="round" strokeLinejoin="round" className={selected === zone.id ? "selected" : ""}/>)}
      {accessibilityVisible && draft?.kind === "accessibility" && draft.state && <polyline points={points(draft.points)} fill="none" stroke={draft.state === "walkable" ? "#6e9a78" : "#a26e68"} strokeOpacity=".34" strokeWidth={draft.brushSize} strokeLinecap="round" strokeLinejoin="round"/>}
      {collisionVisible && project.baseMap.collisions.map((shape) => <g key={shape.id} className={shape.source === "asset-derived" ? "asset-derived-collision" : "manual-collision"}>{shape.type === "polygon" ? <polygon points={points(shape.geometry)} fill="#b47b7418" stroke="#b47b74" strokeWidth={selected === shape.id ? 4 : 2} strokeDasharray={shape.source === "asset-derived" ? "2 4" : "7 5"}/> : <polyline points={points(shape.geometry)} fill="none" stroke="#b47b74" strokeWidth={selected === shape.id ? 5 : 2.5} strokeDasharray={shape.source === "asset-derived" ? "2 4" : "7 5"} strokeLinecap="round" strokeLinejoin="round"/>}{shape.source === "asset-derived" && shape.geometry[0] && <rect x={shape.geometry[0].x - 3} y={shape.geometry[0].y - 3} width="6" height="6" rx="1" fill="#b47b74"/>}</g>)}
      {collisionVisible && draft?.kind === "collision" && (draft.collisionType === "polygon" ? <polygon points={points(draft.points)} fill="#b47b7418" stroke="#b47b74" strokeWidth="2" strokeDasharray="7 5"/> : <polyline points={points(draft.points)} fill="none" stroke="#b47b74" strokeWidth="2.5" strokeDasharray="7 5"/>)}
      {hover && <circle cx={hover.point.x} cy={hover.point.y} r={hover.radius} fill="none" stroke="#d5d0c5" strokeWidth="1.5" strokeDasharray="4 3" opacity=".8"/>}
    </svg>
  </div>;
}
