import { sketchStyles, strokeStyle } from "../../core/sketch/semanticStyles";
import { AssetVisual } from "../assets/AssetVisual";
import { useRef } from "react";
import { assetById } from "../../assets/mockAssetLibrary";
import { boundsForRawStroke } from "../../core/sketch/rawStrokeGeometry";
import type { RawStroke } from "../../core/sketch/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";

function strokePoints(stroke: RawStroke): string {
  return stroke.points.map((point) => `${point.x},${point.y}`).join(" ");
}

type BoardCamera = { x: number; y: number; zoom: number };

export function AssetSandboxCanvas({ camera }: { camera?: BoardCamera } = {}) {
  const { project, activeTool, placeAssetInstance, selectSketchIds, beginRawStroke, appendRawStrokePoint, completeRawStroke, deleteRawStroke, moveAssetInstance } = useWorldloomStore();
  const selected = new Set(project.sketchSelection.ids);
  const dragRef = useRef<{ assetId: string; x: number; y: number } | null>(null);
  const canDraw = activeTool === "pen";
  const canErase = activeTool === "eraser";
  const canSelect = activeTool === "select" || activeTool === "move" || activeTool === "annotation";

  const pointFromClient = (clientX: number, clientY: number, target: Element) => {
    const rect = target.closest(".board-viewport")?.getBoundingClientRect() ?? target.getBoundingClientRect();
    const zoom = camera?.zoom ?? 1;
    const offsetX = camera?.x ?? 0;
    const offsetY = camera?.y ?? 0;
    return {
      x: ((clientX - rect.left - offsetX) / zoom / rect.width) * project.metadata.canvasWidth,
      y: ((clientY - rect.top - offsetY) / zoom / rect.height) * project.metadata.canvasHeight,
    };
  };
  const pointFromEvent = (event: React.PointerEvent<HTMLElement>) => ({
      ...pointFromClient(event.clientX, event.clientY, event.currentTarget),
      pressure: event.pressure || undefined,
      pointerType: event.pointerType,
  });
  const eraseAt = (x: number, y: number) => {
    const target = project.sketchState.rawStrokes.find((stroke) => {
      if (stroke.deleted) return false;
      const bounds = boundsForRawStroke(stroke);
      if (x < bounds.x - 12 || x > bounds.x + bounds.width + 12 || y < bounds.y - 12 || y > bounds.y + bounds.height + 12) return false;
      return stroke.points.some((point) => Math.hypot(point.x - x, point.y - y) < 14);
    });
    if (target) deleteRawStroke(target.id);
  };

  return <div
    className={`asset-sandbox-canvas ${canDraw ? "pen-mode" : ""} ${canSelect ? "select-mode" : ""}`}
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => {
      event.preventDefault();
      const assetDefinitionId = event.dataTransfer.getData("application/worldloom-asset");
      const point = pointFromClient(event.clientX, event.clientY, event.currentTarget);
      if (assetDefinitionId) placeAssetInstance(assetDefinitionId, { ...point, time: Date.now() });
    }}
    onPointerDown={(event) => {
      const point = pointFromEvent(event);
      if (canDraw) {
        event.currentTarget.setPointerCapture(event.pointerId);
        beginRawStroke(point);
      } else if (canErase) {
        eraseAt(point.x, point.y);
      } else if (canSelect) {
        const hit = project.sketchState.assetInstances.find((asset) => Math.abs(asset.position.x - point.x) < 62 && Math.abs(asset.position.y - point.y) < 34);
        if (hit) {
          event.currentTarget.setPointerCapture(event.pointerId);
          selectSketchIds(event.shiftKey ? Array.from(new Set([...project.sketchSelection.ids, hit.id])) : [hit.id]);
          dragRef.current = { assetId: hit.id, x: event.clientX, y: event.clientY };
        } else selectSketchIds([]);
      }
    }}
    onPointerMove={(event) => {
      if (canDraw && event.buttons > 0) appendRawStrokePoint(pointFromEvent(event));
      if (canErase && event.buttons > 0) {
        const point = pointFromEvent(event);
        eraseAt(point.x, point.y);
      }
      if (canSelect && dragRef.current) {
        const rect = event.currentTarget.closest(".board-viewport")?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
        const zoom = camera?.zoom ?? 1;
        const dx = ((event.clientX - dragRef.current.x) / zoom / rect.width) * project.metadata.canvasWidth;
        const dy = ((event.clientY - dragRef.current.y) / zoom / rect.height) * project.metadata.canvasHeight;
        if (Math.abs(dx) + Math.abs(dy) >= 0.5) {
          moveAssetInstance(dragRef.current.assetId, dx, dy);
          dragRef.current = { ...dragRef.current, x: event.clientX, y: event.clientY };
        }
      }
    }}
    onPointerUp={(event) => {
      if (canDraw) {
        event.currentTarget.releasePointerCapture(event.pointerId);
        completeRawStroke();
      }
      if (canSelect && dragRef.current) event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null;
    }}
  >
    <svg preserveAspectRatio="none" className="asset-sketch-layer" viewBox={`0 0 ${project.metadata.canvasWidth} ${project.metadata.canvasHeight}`} aria-hidden="true">
      <defs>{Object.entries(sketchStyles).map(([id,style])=><marker key={id} id={`semantic-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1Q5 4 9 5L2 9" fill="none" stroke={style.color} strokeWidth="1.4"/></marker>)}{["flow","warning","invalid","text"].map(c=><marker key={c} id={`arrow-${c}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke={`var(--${c})`} strokeWidth="1.5"/></marker>)}</defs>
      {project.sketchState.rawStrokes.filter(stroke=>!stroke.deleted).map(stroke=>{const style=strokeStyle(stroke.semanticStyle);return <polyline key={stroke.id} data-semantic={stroke.semanticStyle??"main-route"} className={selected.has(stroke.id)?"raw-stroke selected":"raw-stroke"} points={strokePoints(stroke)} fill="none" style={{stroke:style.color,strokeWidth:selected.has(stroke.id)?3:2.4}} strokeDasharray={style.dash} markerEnd={style.arrow?`url(#semantic-${stroke.semanticStyle})`:undefined} strokeLinecap="round" strokeLinejoin="round"/>;})}
      {project.sketchState.marks.map((mark) => <polyline
        key={mark.id}
        points={mark.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill={mark.kind === "loop" || mark.kind === "region" ? "rgba(173,133,237,0.06)" : "none"}
        stroke={mark.kind === "arrow" ? "var(--flow)" : mark.kind === "boundary" ? "var(--branch)" : "var(--branch)"}
        strokeWidth={mark.kind === "arrow" ? 3 : 2}
        strokeDasharray={mark.kind === "loop" || mark.kind === "region" ? "6 4" : undefined}
      />)}
      {project.sketchState.annotations.map(note => { const a=project.sketchState.assetInstances.find(a=>a.id===note.targetId); return a ? <g key={note.id}><path d={`M${a.position.x-15} ${a.position.y-42}q-20 -15 -35 -15`} stroke="var(--text)" fill="none"/><text x={a.position.x-130} y={a.position.y-65} className="sketch-note">{note.text}</text></g> : null; })}
      {project.sketchState.relations.map((relation) => {
        const source = project.sketchState.assetInstances.find((asset) => asset.id === relation.sourceId)?.position;
        const target = project.sketchState.assetInstances.find((asset) => asset.id === relation.targetId)?.position;
        if (!source || !target) return null;
        const color = /gat|block/.test(relation.relationType) ? "invalid" : /leads/.test(relation.relationType) ? "warning" : /guard|connect/.test(relation.relationType) ? "flow" : "text";
        return <line markerEnd={`url(#arrow-${color})`} key={relation.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={`var(--${color})`} strokeWidth="2" strokeDasharray={relation.relationType === "related_to" || relation.relationType === "relates_to" ? "5 5" : undefined} />;
      })}
    </svg>
    {project.sketchState.assetInstances.map((asset) => {
      const definition = assetById(asset.assetDefinitionId);
      return <button
        key={asset.id}
        aria-label={`Select ${definition?.name ?? asset.assetDefinitionId}`}
        className={`asset-instance ${selected.has(asset.id) ? "active" : ""} ${asset.locked ? "locked" : ""} ${project.committedCompositionIntent?.assetInstanceIds.includes(asset.id) ? "committed" : ""}`}
        style={{ left: `${(asset.position.x / project.metadata.canvasWidth) * 100}%`, top: `${(asset.position.y / project.metadata.canvasHeight) * 100}%`, transform: `translate(-50%, -50%) rotate(${asset.rotation}deg) scale(${asset.scale ?? 1})`, pointerEvents: canSelect ? "auto" : "none" }}
        onPointerDown={(event) => {
          if (!canSelect) return;
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          selectSketchIds(event.shiftKey ? Array.from(new Set([...project.sketchSelection.ids, asset.id])) : [asset.id]);
          dragRef.current = { assetId: asset.id, x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          if (!canSelect || dragRef.current?.assetId !== asset.id) return;
          event.stopPropagation();
          const rect = event.currentTarget.closest(".board-viewport")?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
          if (!rect) return;
          const zoom = camera?.zoom ?? 1;
          const dx = ((event.clientX - dragRef.current.x) / zoom / rect.width) * project.metadata.canvasWidth;
          const dy = ((event.clientY - dragRef.current.y) / zoom / rect.height) * project.metadata.canvasHeight;
          if (Math.abs(dx) + Math.abs(dy) < 0.5) return;
          moveAssetInstance(asset.id, dx, dy);
          dragRef.current = { assetId: asset.id, x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          event.currentTarget.releasePointerCapture(event.pointerId);
          dragRef.current = null;
        }}
      >
        <AssetVisual id={asset.assetDefinitionId} />
        <strong>{definition?.name ?? asset.assetDefinitionId}</strong>
        <small>{asset.roleAssignments[0] ?? (asset.locked ? "locked" : "unassigned")}</small>
      </button>;
    })}
  </div>;
}
