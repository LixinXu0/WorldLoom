import { sketchStyles, strokeStyle } from "../../core/sketch/semanticStyles";
import { AssetVisual } from "../assets/AssetVisual";
import { useEffect, useRef, useState } from "react";
import { assetById } from "../../assets/mockAssetLibrary";
import { boundsForRawStroke } from "../../core/sketch/rawStrokeGeometry";
import type { RawStroke } from "../../core/sketch/types";
import { GameplayGraphLayer } from "../gameplay/GameplayGraphLayer";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import { surfaceMaterial } from "../../core/baseMap";
import { BaseMapLayer, type BaseMapDraft } from "../base-map/BaseMapLayer";
import type { BaseMapEditingSettings } from "../base-map/BaseMapEditingPanel";
import type { SurfaceMaterialId } from "../../core/types";
import type { GameplayNodeType, GameplayRelationType, GameplayRouteType } from "../../core/gameplay/types";

function strokePoints(stroke: RawStroke): string {
  return stroke.points.map((point) => `${point.x},${point.y}`).join(" ");
}

type BoardCamera = { x: number; y: number; zoom: number };
type GameplayTool = "select" | "node" | "relation" | "route";

export function AssetSandboxCanvas({ camera, placementMode = false, onSemanticPlacement, showEditLayer = true, showSketchLayer, showGameplayLayer = true, gameplayEditing = false, gameplayTool = "select", gameplayNodeType = "start", gameplayRelationType = "leads_to", gameplayRouteType = "main_route", baseMapUrl, baseMapEditing = false, baseMapSettings, readOnly = false }: { camera?: BoardCamera; placementMode?: boolean; onSemanticPlacement?: (point: { x: number; y: number }, targetId?: string) => void; showEditLayer?: boolean; /** @deprecated alias for older callers */ showSketchLayer?: boolean; showGameplayLayer?: boolean; gameplayEditing?: boolean; gameplayTool?: GameplayTool; gameplayNodeType?: GameplayNodeType; gameplayRelationType?: GameplayRelationType; gameplayRouteType?: GameplayRouteType; baseMapUrl?: string; baseMapEditing?: boolean; baseMapSettings?: BaseMapEditingSettings; readOnly?: boolean } = {}) {
  const { project, activeTool, selected: appSelected, select, placeAssetInstance, selectSketchIds, beginRawStroke, appendRawStrokePoint, completeRawStroke, deleteRawStroke, deleteSketchMark, moveAssetInstance, duplicateAssetInstance, toggleAssetLock, deleteAssetInstance, interpretTogether, addBaseMapSurface, addAccessibilityZone, addCollisionShape, deleteBaseMapElement, setMapLayerVisible, gameplaySelectionId, selectGameplayElement, createGameplayElement, moveGameplayElement, addGameplayNode, updateGameplayNode, addGameplayRelation, addGameplayRoute } = useWorldloomStore();
  const editLayerVisible = showEditLayer && (showSketchLayer ?? true);
  const selected = new Set(project.sketchSelection.ids);
  const dragRef = useRef<{ assetId: string; startX: number; startY: number; originX: number; originY: number; dx: number; dy: number } | null>(null);
  const gameplayDragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number; dx: number; dy: number } | null>(null);
  const [gameplayConnectionSourceId, setGameplayConnectionSourceId] = useState<string | null>(null);
  const canDraw = !baseMapEditing && activeTool === "pen" && !readOnly && editLayerVisible;
  const canErase = !baseMapEditing && activeTool === "eraser" && !readOnly && editLayerVisible;
  // Assets remain selectable while sketching so an object click always opens
  // its single-element workspace without forcing a tool switch first.
  const canSelect = !baseMapEditing && editLayerVisible && (activeTool === "select" || activeTool === "move" || activeTool === "annotation" || activeTool === "pen");
  const [baseMapDraft, setBaseMapDraft] = useState<BaseMapDraft>(null);
  const [brushHover, setBrushHover] = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ assetId: string; x: number; y: number } | null>(null);
  const [strokeContextMenu, setStrokeContextMenu] = useState<{ strokeId: string; x: number; y: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Keep the upgraded Gameplay Graph as the canonical gameplay layer.
  const gameplayGraph = project.sharedLevelDesignState.gameplay.graph;
  const selectedGameplayNodeIds = Array.from(new Set([...(appSelected?.kind === "gameplay-node" ? [appSelected.id] : []), ...(gameplayConnectionSourceId ? [gameplayConnectionSourceId] : [])]));
  const selectedGameplayRelationIds = appSelected?.kind === "gameplay-relation" ? [appSelected.id] : [];
  const selectedGameplayRouteIds = appSelected?.kind === "gameplay-route" ? [appSelected.id] : [];
  useEffect(() => { setGameplayConnectionSourceId(null); }, [gameplayTool, gameplayRelationType, gameplayRouteType]);
  const openSelectedElement = (assetId: string) => {
    selectSketchIds([assetId]);
    select({ kind: "asset", id: assetId });
  };
  const requestDelete = (assetId: string) => {
    const asset = project.sketchState.assetInstances.find((item) => item.id === assetId);
    if (!asset || asset.locked) return;
    const dependent = project.sketchState.relations.some((relation) => relation.sourceId === assetId || relation.targetId === assetId) || project.sketchState.annotations.some((note) => note.targetId === assetId) || Boolean(project.committedCompositionIntent?.assetInstanceIds.includes(assetId));
    if (dependent) setPendingDelete(assetId); else deleteAssetInstance(assetId);
    setContextMenu(null);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,button")) return;
      const selectedAsset = project.sketchState.assetInstances.find((asset) => project.sketchSelection.ids.includes(asset.id));
      if (selectedAsset) { event.preventDefault(); requestDelete(selectedAsset.id); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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
  const distanceToSegment = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
    return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
  };
  const pointNearPolyline = (x: number, y: number, points: Array<{ x: number; y: number }>, radius: number) => points.some((point, index) => index === 0 ? Math.hypot(point.x - x, point.y - y) <= radius : distanceToSegment(x, y, points[index - 1].x, points[index - 1].y, point.x, point.y) <= radius);
  const pointInPolygon = (x: number, y: number, points: Array<{ x: number; y: number }>) => points.reduce((inside, point, index) => { const previous = points[(index + points.length - 1) % points.length]; const crosses = ((point.y > y) !== (previous.y > y)) && x < ((previous.x - point.x) * (y - point.y)) / (previous.y - point.y) + point.x; return crosses ? !inside : inside; }, false);
  const selectBaseMapAt = (x: number, y: number) => {
    if (!baseMapSettings) return;
    if (baseMapSettings.mode === "surface") {
      const item = [...project.baseMap.surfaces].reverse().find((surface) => surface.geometry === "fill" || pointNearPolyline(x, y, surface.points, surface.brushSize / 2 + 6));
      select(item ? { kind: "base-surface", id: item.id } : null);
    } else if (baseMapSettings.mode === "accessibility") {
      const item = [...project.baseMap.accessibilityZones].reverse().find((zone) => zone.geometry === "polygon" ? pointInPolygon(x, y, zone.points) || pointNearPolyline(x, y, zone.points, 8) : pointNearPolyline(x, y, zone.points, zone.brushSize / 2 + 6));
      select(item ? { kind: "base-accessibility", id: item.id } : null);
    } else {
      const item = [...project.baseMap.collisions].reverse().find((shape) => shape.type === "polygon" ? pointInPolygon(x, y, shape.geometry) || pointNearPolyline(x, y, shape.geometry, 12) : pointNearPolyline(x, y, shape.geometry, 12));
      select(item ? { kind: "base-collision", id: item.id } : null);
    }
  };
  const eraseBaseMapAt = (x: number, y: number) => {
    if (!baseMapSettings) return;
    if (baseMapSettings.mode === "accessibility") {
      const item = [...project.baseMap.accessibilityZones].reverse().find((zone) => zone.source === "manual" && pointNearPolyline(x, y, zone.points, zone.brushSize / 2 + 6));
      if (item) deleteBaseMapElement("accessibility", item.id);
    } else if (baseMapSettings.mode === "collision") {
      const item = [...project.baseMap.collisions].reverse().find((shape) => shape.source === "manual" && pointNearPolyline(x, y, shape.geometry, 14));
      if (item) deleteBaseMapElement("collision", item.id);
    }
  };
  const eraseAt = (x: number, y: number) => {
    if (pendingDelete) return;
    const asset = [...project.sketchState.assetInstances].reverse().find((item) => !item.locked && Math.abs(item.position.x - x) <= 66 && Math.abs(item.position.y - y) <= 68);
    if (asset) {
      requestDelete(asset.id);
      return;
    }
    const stroke = project.sketchState.rawStrokes.find((item) => !item.deleted && pointNearPolyline(x, y, item.points, 18));
    if (stroke) {
      deleteRawStroke(stroke.id);
      return;
    }
    const mark = [...project.sketchState.marks].reverse().find((item) => pointNearPolyline(x, y, item.points, 20));
    if (mark) deleteSketchMark(mark.id);
  };

  return <div
    className={`asset-sandbox-canvas ${canDraw ? "pen-mode" : ""} ${canErase ? "eraser-mode" : ""} ${canSelect ? "select-mode" : ""} ${baseMapEditing ? "base-map-editing" : ""} ${gameplayEditing ? "gameplay-editing" : ""}`}
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => {
      event.preventDefault();
      if (readOnly) return;
      const assetDefinitionId = event.dataTransfer.getData("application/worldloom-asset");
      const materialId = event.dataTransfer.getData("application/worldloom-material") as SurfaceMaterialId;
      const point = pointFromClient(event.clientX, event.clientY, event.currentTarget);
      if (baseMapEditing && baseMapSettings?.mode === "surface" && materialId) {
        const material = surfaceMaterial(materialId); addBaseMapSurface({ geometry: "stroke", operation: "paint", points: [point], materialId, textureReference: material.textureReference, brushSize: baseMapSettings.brushSize, materialScale: baseMapSettings.materialScale }); setMapLayerVisible("surfaceVisible", true);
      } else if (assetDefinitionId && editLayerVisible) placeAssetInstance(assetDefinitionId, { ...point, time: Date.now() });
    }}
    onDoubleClick={(event) => { if (baseMapEditing) { event.preventDefault(); const point = pointFromClient(event.clientX, event.clientY, event.currentTarget); selectBaseMapAt(point.x, point.y); } }}
    onPointerDown={(event) => {
      const point = pointFromEvent(event);
      if (gameplayEditing && event.button === 0) {
        const locked = Boolean(project.mapLayers?.gameplayLocked || project.gameplaySemanticLayer?.locked);
        if (locked) return;
        if (gameplayTool === "select") select(null);
        if (gameplayTool === "node") addGameplayNode({ type: gameplayNodeType, label: gameplayNodeType.replaceAll("_", " ").replace(/^./, (letter)=>letter.toUpperCase()), position: point, requirement: gameplayNodeType === "reward" || gameplayNodeType === "branch" ? "optional" : "mandatory" });
        return;
      }
      if (baseMapEditing && baseMapSettings && !readOnly && event.button === 0) {
        event.currentTarget.setPointerCapture(event.pointerId);
        if (baseMapSettings.mode === "surface") {
          setMapLayerVisible("surfaceVisible", true);
          if (baseMapSettings.surfaceTool === "fill") { const material = surfaceMaterial(baseMapSettings.materialId); addBaseMapSurface({ geometry: "fill", operation: "paint", points: [], materialId: baseMapSettings.materialId, textureReference: material.textureReference, brushSize: baseMapSettings.brushSize, materialScale: baseMapSettings.materialScale }); return; }
          setBaseMapDraft({ kind: "surface", points: [point], brushSize: baseMapSettings.brushSize, materialId: baseMapSettings.materialId, operation: baseMapSettings.surfaceTool === "erase" ? "erase" : "paint", materialScale: baseMapSettings.materialScale });
        } else if (baseMapSettings.mode === "accessibility") {
          setMapLayerVisible("accessibilityVisible", true);
          if (baseMapSettings.accessibilityTool === "erase") { eraseBaseMapAt(point.x, point.y); return; }
          setBaseMapDraft({ kind: "accessibility", points: [point], brushSize: baseMapSettings.brushSize, state: baseMapSettings.accessibilityTool });
        } else {
          setMapLayerVisible("collisionVisible", true);
          if (baseMapSettings.collisionTool === "erase") { eraseBaseMapAt(point.x, point.y); return; }
          setBaseMapDraft({ kind: "collision", points: [point], collisionType: baseMapSettings.collisionTool === "shape" ? "polygon" : "line" });
        }
        return;
      }
      if (placementMode && !readOnly && event.button === 0) {
        const hit = project.sketchState.assetInstances.find((asset) => Math.abs(asset.position.x - point.x) < 62 && Math.abs(asset.position.y - point.y) < 34);
        onSemanticPlacement?.(point, hit?.id);
        return;
      }
      if (canDraw) {
        event.currentTarget.setPointerCapture(event.pointerId);
        beginRawStroke(point);
      } else if (canErase) {
        event.currentTarget.setPointerCapture(event.pointerId);
        eraseAt(point.x, point.y);
      } else if (canSelect) {
        const hit = project.sketchState.assetInstances.find((asset) => Math.abs(asset.position.x - point.x) < 62 && Math.abs(asset.position.y - point.y) < 34);
        if (hit) {
          if (event.shiftKey) selectSketchIds(Array.from(new Set([...project.sketchSelection.ids, hit.id])));
          else openSelectedElement(hit.id);
        } else selectSketchIds([]);
      }
    }}
    onPointerMove={(event) => {
      const basePoint = pointFromEvent(event);
      if (baseMapEditing) setBrushHover(basePoint);
      if (baseMapEditing && baseMapDraft && event.buttons > 0) {
        setBaseMapDraft((current) => {
          if (!current) return null;
          if (current.kind === "collision") {
            const start = current.points[0];
            if (current.collisionType === "line") return { ...current, points: [start, basePoint] };
            return { ...current, points: [start, { x: basePoint.x, y: start.y }, basePoint, { x: start.x, y: basePoint.y }] };
          }
          const last = current.points[current.points.length - 1];
          return Math.hypot(last.x - basePoint.x, last.y - basePoint.y) < 3 ? current : { ...current, points: [...current.points, basePoint] };
        });
        return;
      }
      if (canDraw && event.buttons > 0) appendRawStrokePoint(pointFromEvent(event));
      if (canErase && event.buttons > 0) {
        const point = pointFromEvent(event);
        eraseAt(point.x, point.y);
      }
    }}
    onPointerUp={(event) => {
      if (baseMapEditing && baseMapDraft && baseMapSettings) {
        if (baseMapDraft.kind === "surface" && baseMapDraft.materialId && baseMapDraft.operation) { const material = surfaceMaterial(baseMapDraft.materialId); addBaseMapSurface({ geometry: "stroke", operation: baseMapDraft.operation, points: baseMapDraft.points, materialId: baseMapDraft.materialId, textureReference: material.textureReference, brushSize: baseMapDraft.brushSize ?? baseMapSettings.brushSize, materialScale: baseMapDraft.materialScale ?? 1 }); }
        if (baseMapDraft.kind === "accessibility" && baseMapDraft.state) addAccessibilityZone({ geometry: "stroke", points: baseMapDraft.points, state: baseMapDraft.state, brushSize: baseMapDraft.brushSize ?? baseMapSettings.brushSize });
        if (baseMapDraft.kind === "collision" && baseMapDraft.points.length > 1) addCollisionShape({ geometry: baseMapDraft.points, type: baseMapDraft.collisionType ?? "line", blocksMovement: true });
        setBaseMapDraft(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); return;
      }
      if (canDraw) {
        event.currentTarget.releasePointerCapture(event.pointerId);
        completeRawStroke();
      }
      if (canErase && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerLeave={() => setBrushHover(null)}
  >
    {baseMapUrl && <img className="ai-base-map-layer" src={baseMapUrl} alt="AI base map" />}
    {(project.mapLayers?.baseMapVisible ?? true) && <BaseMapLayer project={project} draft={baseMapDraft} hover={baseMapEditing && baseMapSettings && baseMapSettings.mode !== "collision" ? { point: brushHover ?? { x: -100, y: -100 }, radius: baseMapSettings.brushSize / 2 } : null}/>} 
    {showGameplayLayer && <svg className="gameplay-semantic-layer" viewBox={`0 0 ${project.metadata.canvasWidth} ${project.metadata.canvasHeight}`} style={{ pointerEvents: "none", opacity: gameplayEditing ? 1 : .75 }} aria-label="Gameplay semantic elements">
      <defs><marker id="gameplay-patrol-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="var(--note)" strokeWidth="1.5"/></marker></defs>
      {(project.gameplaySemanticLayer?.elements ?? []).map((element) => {
        const isSelected = gameplaySelectionId === element.id;
        const locked = Boolean(project.mapLayers?.gameplayLocked || project.gameplaySemanticLayer?.locked);
        const beginGameplayDrag = (event: React.PointerEvent<SVGGElement>) => {
          if (!gameplayEditing || gameplayTool !== "select" || event.button !== 0) return;
          event.preventDefault(); event.stopPropagation();
          selectGameplayElement(element.id);
          if (locked) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          gameplayDragRef.current = { id: element.id, startX: event.clientX, startY: event.clientY, originX: element.position.x, originY: element.position.y, dx: 0, dy: 0 };
        };
        const moveGameplayPreview = (event: React.PointerEvent<SVGGElement>) => {
          const drag = gameplayDragRef.current;
          if (!drag || drag.id !== element.id) return;
          event.preventDefault(); event.stopPropagation();
          const rect = event.currentTarget.closest(".board-viewport")?.getBoundingClientRect(); if (!rect) return;
          const zoom = camera?.zoom ?? 1;
          drag.dx = ((event.clientX - drag.startX) / zoom / rect.width) * project.metadata.canvasWidth;
          drag.dy = ((event.clientY - drag.startY) / zoom / rect.height) * project.metadata.canvasHeight;
          event.currentTarget.setAttribute("transform", `translate(${drag.dx} ${drag.dy})`);
        };
        const finishGameplayDrag = (event: React.PointerEvent<SVGGElement>) => {
          const drag = gameplayDragRef.current;
          event.preventDefault(); event.stopPropagation();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          event.currentTarget.removeAttribute("transform");
          gameplayDragRef.current = null;
          if (drag?.id === element.id && Math.abs(drag.dx) + Math.abs(drag.dy) >= .5) moveGameplayElement(element.id, { x: drag.originX + drag.dx, y: drag.originY + drag.dy });
        };
        const handlers = { onPointerDown: beginGameplayDrag, onPointerMove: moveGameplayPreview, onPointerUp: finishGameplayDrag, onPointerCancel: finishGameplayDrag };
        if (element.type === "npc_patrol_route") {
          const points = element.waypoints ?? [element.position, element.endPoint ?? element.position];
          return <g key={element.id} className={`gameplay-element ${isSelected ? "selected" : ""}`} style={{ color: "var(--note)" }} {...handlers}><polyline points={points.map((point)=>`${point.x},${point.y}`).join(" ")} fill="none" stroke="var(--note)" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#gameplay-patrol-arrow)"/><text className="gameplay-label" x={element.position.x} y={element.position.y-16} fill="var(--note)">{element.name}</text>{points.map((point,index)=><circle key={index} cx={point.x} cy={point.y} r={isSelected?8:5} fill="var(--bg)" stroke="var(--note)" strokeWidth="3"/>)}</g>;
        }
        if (element.type === "enemy_stronghold") return <g key={element.id} className={`gameplay-element ${isSelected ? "selected" : ""}`} style={{ color: "var(--invalid)" }} {...handlers}><rect x={element.position.x-element.region.width/2} y={element.position.y-element.region.height/2} width={element.region.width} height={element.region.height} rx="12" fill="#b85d5522" stroke="var(--invalid)" strokeWidth={isSelected?5:3}/><text className="gameplay-icon" x={element.position.x} y={element.position.y+6} textAnchor="middle" fill="var(--invalid)">⚑</text><text className="gameplay-label" x={element.position.x} y={element.position.y-element.region.height/2-12} textAnchor="middle" fill="var(--invalid)">{element.name}</text></g>;
        const color = element.type === "player_spawn" ? "var(--branch)" : "var(--warning)";
        return <g key={element.id} className={`gameplay-element ${isSelected ? "selected" : ""}`} style={{ color }} {...handlers}><circle cx={element.position.x} cy={element.position.y} r={element.type === "player_spawn" ? 25 : 22} fill="#091923cc" stroke={color} strokeWidth={isSelected?5:3}/><text className="gameplay-icon" x={element.position.x} y={element.position.y+6} textAnchor="middle" fill={color}>{element.type === "player_spawn" ? "↟" : "●"}</text><text className="gameplay-label" x={element.position.x} y={element.position.y-34} textAnchor="middle" fill={color}>{element.name}</text></g>;
      })}
    </svg>}
    <svg preserveAspectRatio="none" className="asset-sketch-layer" style={{ display: editLayerVisible || showGameplayLayer ? "block" : "none" }} viewBox={`0 0 ${project.metadata.canvasWidth} ${project.metadata.canvasHeight}`} aria-hidden="true">
      <defs>{Object.entries(sketchStyles).map(([id,style])=><marker key={id} id={`semantic-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1Q5 4 9 5L2 9" fill="none" stroke={style.color} strokeWidth="1.4"/></marker>)}{["flow","warning","invalid","text"].map(c=><marker key={c} id={`arrow-${c}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 9 5 1 9" fill="none" stroke={`var(--${c})`} strokeWidth="1.5"/></marker>)}</defs>
      {editLayerVisible && project.sketchState.rawStrokes.filter(stroke=>!stroke.deleted).map(stroke=>{const style=strokeStyle(stroke.semanticStyle);return <polyline key={stroke.id} data-semantic={stroke.semanticStyle??"main-route"} className={selected.has(stroke.id)?"raw-stroke selected":"raw-stroke"} points={strokePoints(stroke)} fill="none" style={{stroke:style.color,strokeWidth:selected.has(stroke.id)?3:2.4,pointerEvents:"stroke"}} strokeDasharray={style.dash} markerEnd={style.arrow?`url(#semantic-${stroke.semanticStyle})`:undefined} strokeLinecap="round" strokeLinejoin="round" onContextMenu={(event)=>{event.preventDefault();event.stopPropagation();selectSketchIds([stroke.id]);setStrokeContextMenu({strokeId:stroke.id,x:event.nativeEvent.offsetX,y:event.nativeEvent.offsetY});}}/>;})}
      {editLayerVisible && project.sketchState.marks.map((mark) => <polyline
        key={mark.id}
        points={mark.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill={mark.kind === "loop" || mark.kind === "region" ? "rgba(173,133,237,0.06)" : "none"}
        stroke={mark.kind === "arrow" ? "var(--flow)" : mark.kind === "boundary" ? "var(--branch)" : "var(--branch)"}
        strokeWidth={mark.kind === "arrow" ? 3 : 2}
        strokeDasharray={mark.kind === "loop" || mark.kind === "region" ? "6 4" : undefined}
      />)}
      {editLayerVisible && project.sketchState.annotations.map(note => { const a=project.sketchState.assetInstances.find(a=>a.id===note.targetId); return a ? <g key={note.id}><path d={`M${a.position.x-15} ${a.position.y-42}q-20 -15 -35 -15`} stroke="var(--text)" fill="none"/><text x={a.position.x-130} y={a.position.y-65} className="sketch-note">{note.text}</text></g> : null; })}
      {showGameplayLayer && project.sketchState.relations.map((relation) => {
        const source = project.sketchState.assetInstances.find((asset) => asset.id === relation.sourceId)?.position;
        const target = project.sketchState.assetInstances.find((asset) => asset.id === relation.targetId)?.position;
        if (!source || !target) return null;
        const color = /gat|block/.test(relation.relationType) ? "invalid" : /leads/.test(relation.relationType) ? "warning" : /guard|connect/.test(relation.relationType) ? "flow" : "text";
        return <line markerEnd={`url(#arrow-${color})`} key={relation.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={`var(--${color})`} strokeWidth="2" strokeDasharray={relation.relationType === "related_to" || relation.relationType === "relates_to" ? "5 5" : undefined} />;
      })}
    </svg>
    {showGameplayLayer && (
      <GameplayGraphLayer
        graph={gameplayGraph}
        width={project.metadata.canvasWidth}
        height={project.metadata.canvasHeight}
        selectedNodeIds={selectedGameplayNodeIds}
        selectedRelationIds={selectedGameplayRelationIds}
        selectedRouteIds={selectedGameplayRouteIds}
        nodesDraggable={gameplayEditing && gameplayTool === "select"}
        onMoveNode={(nodeId, position)=>updateGameplayNode(nodeId,{position})}
        onSelectNode={(nodeId) => {
          if (!gameplayEditing && !canSelect) return;
          selectSketchIds([]);
          if (gameplayEditing && (gameplayTool === "relation" || gameplayTool === "route")) {
            if (!gameplayConnectionSourceId) { setGameplayConnectionSourceId(nodeId); select({ kind: "gameplay-node", id: nodeId }); return; }
            if (gameplayConnectionSourceId === nodeId) { setGameplayConnectionSourceId(null); return; }
            if (gameplayTool === "relation") addGameplayRelation({ type: gameplayRelationType, sourceNodeId: gameplayConnectionSourceId, targetNodeId: nodeId, requirement: "mandatory" });
            else addGameplayRoute({ type: gameplayRouteType, sourceNodeId: gameplayConnectionSourceId, targetNodeId: nodeId, requirement: gameplayRouteType === "optional_route" || gameplayRouteType === "shortcut" ? "optional" : "mandatory" });
            setGameplayConnectionSourceId(null);
            return;
          }
          select({ kind: "gameplay-node", id: nodeId });
        }}
        onSelectRelation={(relationId) => {
          if (!canSelect) return;
          selectSketchIds([]);
          select({ kind: "gameplay-relation", id: relationId });
        }}
        onSelectRoute={(routeId) => {
          if (!canSelect) return;
          selectSketchIds([]);
          select({ kind: "gameplay-route", id: routeId });
        }}
      />
    )}
    {project.sketchState.assetInstances.map((asset) => {
      const definition = assetById(asset.assetDefinitionId);
      return <button
        key={asset.id}
        aria-label={`Select ${definition?.name ?? asset.assetDefinitionId}`}
        className={`asset-instance ${selected.has(asset.id) ? "active" : ""} ${asset.locked ? "locked" : ""} ${project.committedCompositionIntent?.assetInstanceIds.includes(asset.id) ? "committed" : ""}`}
        style={{ left: `${(asset.position.x / project.metadata.canvasWidth) * 100}%`, top: `${(asset.position.y / project.metadata.canvasHeight) * 100}%`, transform: `translate(-50%, -50%) rotate(${asset.rotation}deg) scale(${asset.scale ?? 1})`, pointerEvents: canSelect && !gameplayEditing ? "auto" : "none", display: editLayerVisible ? "grid" : "none" }}
        onPointerDown={(event) => {
          if (!canSelect || event.button !== 0) return;
          event.stopPropagation();
          event.currentTarget.setPointerCapture(event.pointerId);
          if (event.shiftKey) selectSketchIds(Array.from(new Set([...project.sketchSelection.ids, asset.id])));
          else openSelectedElement(asset.id);
          if (!readOnly) dragRef.current = { assetId: asset.id, startX: event.clientX, startY: event.clientY, originX: asset.position.x, originY: asset.position.y, dx: 0, dy: 0 };
        }}
        onPointerMove={(event) => {
          if (!canSelect || readOnly || dragRef.current?.assetId !== asset.id) return;
          event.stopPropagation();
          const rect = event.currentTarget.closest(".board-viewport")?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
          if (!rect) return;
          const zoom = camera?.zoom ?? 1;
          const dx = ((event.clientX - dragRef.current.startX) / zoom / rect.width) * project.metadata.canvasWidth;
          const dy = ((event.clientY - dragRef.current.startY) / zoom / rect.height) * project.metadata.canvasHeight;
          dragRef.current.dx = dx;
          dragRef.current.dy = dy;
          event.currentTarget.style.left = `${((dragRef.current.originX + dx) / project.metadata.canvasWidth) * 100}%`;
          event.currentTarget.style.top = `${((dragRef.current.originY + dy) / project.metadata.canvasHeight) * 100}%`;
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
          const drag = dragRef.current;
          dragRef.current = null;
          if (drag?.assetId === asset.id && Math.abs(drag.dx) + Math.abs(drag.dy) >= 0.5) moveAssetInstance(asset.id, drag.dx, drag.dy);
        }}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setContextMenu({ assetId: asset.id, x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY }); selectSketchIds([asset.id]); }}
      >
        <AssetVisual id={asset.assetDefinitionId} />
        <strong>{definition?.name ?? asset.assetDefinitionId}</strong>
        <small>{asset.roleAssignments[0] ?? (asset.locked ? "locked" : "unassigned")}</small>
      </button>;
    })}
    {contextMenu && <div className="asset-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event)=>event.stopPropagation()}>
      <button onClick={()=>{openSelectedElement(contextMenu.assetId);setContextMenu(null);}}>Select</button>
      <button onClick={()=>{duplicateAssetInstance(contextMenu.assetId);setContextMenu(null);}}>Duplicate</button>
      <button onClick={()=>{selectSketchIds([contextMenu.assetId]);interpretTogether();setContextMenu(null);}}>Interpret with AI</button>
      <button onClick={()=>{selectSketchIds([contextMenu.assetId]);interpretTogether();setContextMenu(null);}}>Add AI card</button>
      <button onClick={()=>{toggleAssetLock(contextMenu.assetId);setContextMenu(null);}}>{project.sketchState.assetInstances.find(a=>a.id===contextMenu.assetId)?.locked ? "Release constraint" : "Edit constraint"}</button>
      <button className="danger-action" onClick={()=>requestDelete(contextMenu.assetId)}>Delete element</button>
    </div>}
    {strokeContextMenu && <div className="asset-context-menu" style={{ left: strokeContextMenu.x, top: strokeContextMenu.y }} onPointerDown={(event)=>event.stopPropagation()}>
      <button onClick={()=>{selectSketchIds([strokeContextMenu.strokeId]);setStrokeContextMenu(null);}}>Select</button>
      <button onClick={()=>{selectSketchIds([strokeContextMenu.strokeId]);interpretTogether();setStrokeContextMenu(null);}}>Interpret with AI</button>
      <button onClick={()=>{const target=project.sketchState.assetInstances[0];if(target) useWorldloomStore.getState().createSemanticItem("reading",target.id);setStrokeContextMenu(null);}}>Add AI card</button>
      <button onClick={()=>{useWorldloomStore.getState().setSketchSemantic("optional-path");setStrokeContextMenu(null);}}>Change style</button>
      <button className="danger-action" onClick={()=>{deleteRawStroke(strokeContextMenu.strokeId);setStrokeContextMenu(null);}}>Delete</button>
    </div>}
    {pendingDelete && <div className="asset-delete-dialog" role="dialog" aria-modal="true"><strong>Delete this element?</strong><p>Relations, notes, and dependent interpretation links will be cleaned up.</p><div><button onClick={()=>setPendingDelete(null)}>Cancel</button><button className="danger-action" onClick={()=>{deleteAssetInstance(pendingDelete);setPendingDelete(null);}}>Delete element</button></div></div>}
  </div>;
}

