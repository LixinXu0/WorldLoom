import { sketchStyles, strokeStyle } from "../../core/sketch/semanticStyles";
import { AssetVisual } from "../assets/AssetVisual";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { assetById } from "../../assets/mockAssetLibrary";
import { boundsForRawStroke } from "../../core/sketch/rawStrokeGeometry";
import type { RawStroke } from "../../core/sketch/types";
import type { GameplaySemanticElement, GameplaySemanticPoint, GameplaySemanticType } from "../../core/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";

function strokePoints(stroke: RawStroke): string {
  return stroke.points.map((point) => `${point.x},${point.y}`).join(" ");
}

type BoardCamera = { x: number; y: number; zoom: number };
type GameplayTool = "select" | "spawn" | "stronghold" | "npc" | "patrol";

export function AssetSandboxCanvas({ camera, placementMode = false, onSemanticPlacement, showEditLayer = true, showSketchLayer, showGameplayLayer = true, gameplayEditing = false, gameplayTool = "select", baseMapUrl, readOnly = false }: { camera?: BoardCamera; placementMode?: boolean; onSemanticPlacement?: (point: { x: number; y: number }, targetId?: string) => void; showEditLayer?: boolean; /** @deprecated alias for older callers */ showSketchLayer?: boolean; showGameplayLayer?: boolean; gameplayEditing?: boolean; gameplayTool?: GameplayTool; baseMapUrl?: string; readOnly?: boolean } = {}) {
  const { project, activeTool, placeAssetInstance, selectSketchIds, beginRawStroke, appendRawStrokePoint, completeRawStroke, deleteRawStroke, deleteSketchMark, moveAssetInstance, duplicateAssetInstance, toggleAssetLock, deleteAssetInstance, interpretTogether } = useWorldloomStore();
  const editLayerVisible = showEditLayer && (showSketchLayer ?? true);
  const selected = new Set(project.sketchSelection.ids);
  const dragRef = useRef<{ assetId: string; x: number; y: number } | null>(null);
  const canDraw = activeTool === "pen" && !readOnly && editLayerVisible;
  const canErase = activeTool === "eraser" && !readOnly && editLayerVisible;
  // Assets remain selectable while sketching so an object click always opens
  // its single-element workspace without forcing a tool switch first.
  const canSelect = editLayerVisible && (activeTool === "select" || activeTool === "move" || activeTool === "annotation" || activeTool === "pen");
  const [contextMenu, setContextMenu] = useState<{ assetId: string; x: number; y: number } | null>(null);
  const [strokeContextMenu, setStrokeContextMenu] = useState<{ strokeId: string; x: number; y: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const openSelectedElement = (assetId: string) => {
    selectSketchIds([assetId]);
    const hypothesis = useWorldloomStore.getState().project.compositionHypothesis;
    if (!hypothesis?.assetRoles.some((role) => role.assetInstanceId === assetId)) interpretTogether();
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
    className={`asset-sandbox-canvas ${canDraw ? "pen-mode" : ""} ${canErase ? "eraser-mode" : ""} ${canSelect ? "select-mode" : ""} ${gameplayEditing ? "gameplay-editing" : ""}`}
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => {
      event.preventDefault();
      if (readOnly || !editLayerVisible) return;
      const assetDefinitionId = event.dataTransfer.getData("application/worldloom-asset");
      const point = pointFromClient(event.clientX, event.clientY, event.currentTarget);
      if (assetDefinitionId) placeAssetInstance(assetDefinitionId, { ...point, time: Date.now() });
    }}
    onPointerDown={(event) => {
      const point = pointFromEvent(event);
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
          event.currentTarget.setPointerCapture(event.pointerId);
          if (event.shiftKey) selectSketchIds(Array.from(new Set([...project.sketchSelection.ids, hit.id])));
          else openSelectedElement(hit.id);
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
      if (canErase && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      dragRef.current = null;
    }}
  >
    {baseMapUrl && <img className="ai-base-map-layer" src={baseMapUrl} alt="AI base map" />}
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
    <GameplaySemanticOverlay visible={showGameplayLayer} editing={gameplayEditing} tool={gameplayTool} camera={camera} />
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
          if (!readOnly) dragRef.current = { assetId: asset.id, x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          if (!canSelect || readOnly || dragRef.current?.assetId !== asset.id) return;
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

function GameplaySemanticOverlay({ visible, editing, tool, camera }: { visible: boolean; editing: boolean; tool: GameplayTool; camera?: BoardCamera }) {
  const { project, gameplaySelectionId, selectGameplayElement, createGameplayElement, moveGameplayElement, resizeGameplayElement, moveGameplayWaypoint, addGameplayWaypoint, deleteGameplayWaypoint, reverseGameplayRoute, deleteGameplayElement, selectSketchIds } = useWorldloomStore();
  const [context, setContext] = useState<{ id: string; point: GameplaySemanticPoint } | null>(null);
  const dragRef = useRef<{ id: string; kind: "element" | "resize" | "waypoint"; index?: number } | null>(null);
  const layer = project.gameplaySemanticLayer ?? { elements: [], locked: project.mapLayers?.gameplayLocked ?? false };
  const locked = layer.locked || Boolean(project.mapLayers?.gameplayLocked);
  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.closest(".board-viewport")?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    const zoom = camera?.zoom ?? 1;
    return { x: Math.max(0, Math.min(project.metadata.canvasWidth, (event.clientX - rect.left - (camera?.x ?? 0)) / zoom / rect.width * project.metadata.canvasWidth)), y: Math.max(0, Math.min(project.metadata.canvasHeight, (event.clientY - rect.top - (camera?.y ?? 0)) / zoom / rect.height * project.metadata.canvasHeight)) };
  };
  const startDrag = (event: ReactPointerEvent<SVGGElement>, id: string, kind: "element" | "resize" | "waypoint", index?: number) => {
    if (!editing || locked) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    selectGameplayElement(id); dragRef.current = { id, kind, index };
  };
  const label = (type: GameplaySemanticType) => ({ player_spawn: "SPAWN", enemy_stronghold: "STRONGHOLD", npc: "NPC", npc_patrol_route: "PATROL" })[type];
  const color = (type: GameplaySemanticType) => ({ player_spawn: "#20c7ee", enemy_stronghold: "#ff526b", npc: "#ffbb3e", npc_patrol_route: "#b27aff" })[type];
  const routePoints = (item: GameplaySemanticElement) => item.waypoints?.length ? item.waypoints : [item.startPoint ?? item.position, item.endPoint ?? item.position];
  if (!visible) return null;
  return <>
    <svg className="gameplay-semantic-layer" viewBox={`0 0 ${project.metadata.canvasWidth} ${project.metadata.canvasHeight}`} preserveAspectRatio="none" style={{ pointerEvents: editing ? "auto" : "none" }}
      onPointerDown={(event) => {
        if (!editing || locked || event.button !== 0) return;
        const point = pointFromEvent(event);
        const type = tool === "spawn" ? "player_spawn" : tool === "stronghold" ? "enemy_stronghold" : tool === "npc" ? "npc" : tool === "patrol" ? "npc_patrol_route" : null;
        if (type) createGameplayElement(type, point);
        else selectGameplayElement(null);
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current; if (!drag || locked) return;
        const point = pointFromEvent(event); const item = layer.elements.find((element) => element.id === drag.id); if (!item) return;
        if (drag.kind === "element") moveGameplayElement(drag.id, point);
        if (drag.kind === "resize") resizeGameplayElement(drag.id, { width: Math.abs(point.x - item.position.x) * 2, height: Math.abs(point.y - item.position.y) * 2 });
        if (drag.kind === "waypoint" && drag.index !== undefined) moveGameplayWaypoint(drag.id, drag.index, point);
      }}
      onPointerUp={(event) => { dragRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
      <defs><marker id="gameplay-route-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M1 1 9 5 1 9" fill="none" stroke="#b27aff" strokeWidth="1.5" /></marker></defs>
      {layer.elements.map((item) => {
        const selected = gameplaySelectionId === item.id; const c = color(item.type); const x = item.position.x; const y = item.position.y;
        if (item.type === "npc_patrol_route") { const points = routePoints(item); return <g key={item.id} className={`gameplay-element route ${selected ? "selected" : ""}`} onContextMenu={(event)=>{event.preventDefault();event.stopPropagation();selectGameplayElement(item.id);setContext({id:item.id,point:{x,y}});}}><polyline points={points.map(point=>`${point.x},${point.y}`).join(" ")} fill="none" stroke={c} strokeWidth={selected ? 5 : 3} strokeDasharray="9 5" markerEnd="url(#gameplay-route-arrow)" onPointerDown={(event)=>startDrag(event,item.id,"element")}/>{points.map((point,index)=><g key={index} onPointerDown={(event)=>startDrag(event,item.id,"waypoint",index)}><circle cx={point.x} cy={point.y} r={index === 0 || index === points.length-1 ? 10 : 6} fill={index === 0 ? "#20c7ee" : index === points.length-1 ? "#ff526b" : c} stroke="#0b1c27" strokeWidth="3"/><text x={point.x+11} y={point.y-10} className="gameplay-waypoint-label">{index === 0 ? "Start" : index === points.length-1 ? "End" : `${index}`}</text></g>)}<text x={points[0].x} y={points[0].y-20} className="gameplay-label" fill={c}>{item.name}</text></g>; }
        const isRegion = item.type === "enemy_stronghold"; return <g key={item.id} className={`gameplay-element ${item.type} ${selected ? "selected" : ""}`} onPointerDown={(event)=>startDrag(event,item.id,"element")} onContextMenu={(event)=>{event.preventDefault();event.stopPropagation();selectGameplayElement(item.id);setContext({id:item.id,point:{x,y}});}}>{isRegion && <><rect x={x-item.region.width/2} y={y-item.region.height/2} width={item.region.width} height={item.region.height} rx="8" fill="rgba(255,82,107,.13)" stroke={c} strokeWidth={selected ? 4 : 2.5} strokeDasharray="8 4"/><g onPointerDown={(event)=>startDrag(event,item.id,"resize")}><rect x={x+item.region.width/2-8} y={y+item.region.height/2-8} width="16" height="16" fill={c} /></g></>}<circle cx={x} cy={y} r={isRegion ? 18 : 15} fill="#0b1c27" stroke={c} strokeWidth="4"/><text x={x} y={y+5} textAnchor="middle" className="gameplay-icon" fill={c}>{item.type === "player_spawn" ? "↟" : item.type === "npc" ? "●" : "⚑"}</text><text x={x+22} y={y-16} className="gameplay-label" fill={c}>{item.name}</text><text x={x+22} y={y} className="gameplay-type" fill={c}>{label(item.type)}</text></g>;
      })}
    </svg>
    {context && (() => { const item = layer.elements.find((element) => element.id === context.id); if (!item) return null; return <div className="gameplay-context-menu" style={{ left: `${context.point.x / project.metadata.canvasWidth * 100}%`, top: `${context.point.y / project.metadata.canvasHeight * 100}%` }}><button onClick={()=>{selectGameplayElement(item.id);setContext(null);}}>Edit</button><button onClick={()=>{selectGameplayElement(item.id);setContext(null);}}>Move</button>{item.type === "enemy_stronghold" && <button onClick={()=>{resizeGameplayElement(item.id,{width:item.region.width+30,height:item.region.height+20});setContext(null);}}>Change Size</button>}{item.type === "npc_patrol_route" && <><button onClick={()=>{addGameplayWaypoint(item.id,{x:item.position.x+70,y:item.position.y+40});setContext(null);}}>Add Waypoint</button><button onClick={()=>{reverseGameplayRoute(item.id);setContext(null);}}>Reverse Direction</button></>}<button onClick={()=>{if(item.sourceDoodleId!=="manual") selectSketchIds([item.sourceDoodleId]);setContext(null);}}>Focus Source Doodle</button><button className="danger-action" onClick={()=>{deleteGameplayElement(item.id);setContext(null);}}>Delete</button></div>; })()}
  </>;
}
