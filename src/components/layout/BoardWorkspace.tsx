import { WorkspaceIcon } from "./WorkspaceIcon";
import { SketchStyleControl } from "../sketch/SketchStyleControl";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from "react";
import { AnnotationComposer, DesignTrace, GameplayLogicPanel, GeneratedContent, LocalNotes, MapUnderstandingReview, MiniMap, SelectedElementContent } from "./SemanticPanels";
import { WorldSettingPanel } from "../intent-review/WorldSettingPanel";
import { MapUnderstandingPanel } from "../intent-review/MapUnderstandingPanel";
import { AssetLibraryPanel } from "../assets/AssetLibraryPanel";

import { AssetSandboxCanvas } from "../sketch/AssetSandboxCanvas";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import type { SemanticItemKind } from "../../core/sketch/semanticStyles";
import { BaseMapEditingPanel, type BaseMapEditingSettings } from "../base-map/BaseMapEditingPanel";
import type { GameplayNodeType, GameplayRelationType, GameplayRouteType } from "../../core/gameplay/types";

export type BoardPanel = "assets" | "world" | "map";
type PanelPosition = { x: number; y: number };
type WorkflowStage = "edit" | "understand" | "plan" | "generate" | "generated";
type GameplayTool = "select" | "node" | "relation" | "route";

function FloatingCard({ title, eyebrow, className = "", position, onMove, onClose, children }: { title: string; eyebrow?: string; className?: string; position: PanelPosition | null; onMove: (position: PanelPosition) => void; onClose?: () => void; children: ReactNode }) {
  const shouldAutoCollapse = !/(assets|floating-inspector|floating-map|floating-plan|floating-generate|floating-generated)/.test(className);
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1100 && shouldAutoCollapse);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1099px)");
    const update = () => { if (media.matches && shouldAutoCollapse) setCollapsed(true); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [shouldAutoCollapse]);
  const dragRef = useRef<{ originX: number; originY: number; startX: number; startY: number; minDx: number; maxDx: number; minDy: number; maxDy: number; pending?: PanelPosition } | null>(null);
  const cardRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const onMoveRef = useRef(onMove);
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);
  useEffect(() => {
    const flushMove = () => {
      frameRef.current = null;
      const next = dragRef.current?.pending;
      if (!next) return;
      const card = cardRef.current;
      if (!card) return;
      card.style.left = `${next.x}px`;
      card.style.top = `${next.y}px`;
      card.style.right = "auto";
      card.style.bottom = "auto";
      card.style.transform = "none";
    };
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      const dx = Math.min(drag.maxDx, Math.max(drag.minDx, event.clientX - drag.startX));
      const dy = Math.min(drag.maxDy, Math.max(drag.minDy, event.clientY - drag.startY));
      const next = { x: drag.originX + dx, y: drag.originY + dy };
      if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) return;
      drag.pending = next;
      if (frameRef.current === null) frameRef.current = window.requestAnimationFrame(flushMove);
    };
    const end = () => {
      const pending = dragRef.current?.pending;
      dragRef.current = null;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        if (pending && cardRef.current) {
          cardRef.current.style.left = `${pending.x}px`;
          cardRef.current.style.top = `${pending.y}px`;
          cardRef.current.style.right = "auto";
          cardRef.current.style.bottom = "auto";
          cardRef.current.style.transform = "none";
        }
      }
      frameRef.current = null;
      if (pending) onMoveRef.current(pending);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button, input, select, textarea")) return;
    event.preventDefault();
    const cardRect = event.currentTarget.closest(".floating-card")?.getBoundingClientRect();
    const viewportRect = event.currentTarget.closest(".board-viewport")?.getBoundingClientRect();
    if (!cardRect || !viewportRect) return;
    dragRef.current = {
      originX: cardRect.left - viewportRect.left,
      originY: cardRect.top - viewportRect.top,
      startX: event.clientX,
      startY: event.clientY,
      minDx: viewportRect.left - cardRect.left,
      maxDx: Math.max(viewportRect.left - cardRect.left, viewportRect.right - cardRect.right),
      minDy: viewportRect.top - cardRect.top,
      maxDy: Math.max(viewportRect.top - cardRect.top, viewportRect.bottom - cardRect.bottom),
    };
  };
  return <section ref={cardRef} className={`floating-card ${className} ${collapsed ? "is-collapsed" : ""}`} style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto", transform: "none" } : undefined}>
    <div className="floating-card-header" onPointerDown={startDrag}>
      <div>{eyebrow && <span className="floating-eyebrow">{eyebrow}</span>}<strong>{title}</strong></div>
      <button className="icon-button" aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`} onPointerDown={e => e.stopPropagation()} onClick={() => setCollapsed(c => !c)}>{collapsed ? "+" : "−"}</button>{onClose && <button className="icon-button" aria-label={`Close ${title}`} title={`Close ${title}`} onPointerDown={(event) => event.stopPropagation()} onClick={onClose}>×</button>}
    </div>
    {!collapsed && <div className="floating-card-content">{children}</div>}
  </section>;
}

export function BoardWorkspace({ boardPanel, onBoardPanelChange }: { boardPanel: BoardPanel | null; onBoardPanelChange: (panel: BoardPanel | null) => void }) {
  const { activeTool, project, selected, select, clearUnsubmittedSketch, selectSketchIds, setTool, setMapLayerVisible, setGameplayLayerLocked, gameplaySelectionId, selectGameplayElement, focusRequest, generateAssetPlan, setGeneratedOutput } = useWorldloomStore();
  const [positions, setPositions] = useState<Record<BoardPanel | "inspector" | "trace" | "layers" | "baseMap" | "plan" | "generate" | "generated", PanelPosition | null>>({ assets: null, world: null, map: null, inspector: null, trace: null, layers: null, baseMap: null, plan: null, generate: null, generated: null });
  const [traceOpen, setTraceOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [workflowStage, setWorkflowStage] = useState<WorkflowStage>("edit");
  const [generatedOpen, setGeneratedOpen] = useState(false);
  const [connectMode, setConnectMode] = useState(false);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [semanticPlacement, setSemanticPlacement] = useState<{ point: { x: number; y: number }; targetId?: string } | null>(null);
  const [canvasMenu, setCanvasMenu] = useState<{ point: { x: number; y: number }; screen: { x: number; y: number } } | null>(null);
  const [gameplayEditing, setGameplayEditing] = useState(false);
  const [gameplayTool, setGameplayTool] = useState<GameplayTool>("select");
  const [gameplayNodeType, setGameplayNodeType] = useState<GameplayNodeType>("start");
  const [gameplayRelationType, setGameplayRelationType] = useState<GameplayRelationType>("leads_to");
  const [gameplayRouteType, setGameplayRouteType] = useState<GameplayRouteType>("main_route");
  const [baseMapEditing, setBaseMapEditing] = useState(false);
  const [baseMapSettings, setBaseMapSettings] = useState<BaseMapEditingSettings>({ mode: "surface", surfaceTool: "paint", accessibilityTool: "walkable", collisionTool: "line", materialId: "grass", brushSize: 64, materialScale: 1 });
  const panRef = useRef<{ x: number; y: number; startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const boardCameraRef = useRef<HTMLDivElement>(null);
  const hasSelection = project.sketchSelection.ids.length > 0 || Boolean(gameplaySelectionId) || Boolean(selected?.kind.startsWith("base-")) || Boolean(selected?.kind.startsWith("gameplay-"));

  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.code === "Space" && !event.repeat && !(event.target as HTMLElement).closest("input, textarea, select, button, summary, [contenteditable=true]")) { event.preventDefault(); setSpaceDown(true); } };
    const up = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  useEffect(() => {
    const summonAssets = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key.toLowerCase() === "a" && target?.tagName !== "INPUT" && target?.tagName !== "TEXTAREA" && target?.isContentEditable !== true) onBoardPanelChange("assets");
    };
    window.addEventListener("keydown", summonAssets);
    return () => window.removeEventListener("keydown", summonAssets);
  }, [onBoardPanelChange]);
  const movePanel = (panel: keyof typeof positions, position: PanelPosition) => setPositions((current) => ({ ...current, [panel]: position }));
  useEffect(() => { setInspectorOpen(true); }, [project.sketchSelection.ids, gameplaySelectionId, selected?.id]);
  useEffect(() => {
    if (!focusRequest) return;
    const asset = project.sketchState.assetInstances.find((item) => item.id === focusRequest.assetId);
    const viewport = viewportRef.current;
    if (!asset || !viewport) return;
    const rect = viewport.getBoundingClientRect();
    const assetScreenX = (asset.position.x / project.metadata.canvasWidth) * rect.width;
    const assetScreenY = (asset.position.y / project.metadata.canvasHeight) * rect.height;
    setCamera((current) => ({
      ...current,
      x: rect.width / 2 - assetScreenX * current.zoom,
      y: rect.height / 2 - assetScreenY * current.zoom,
    }));
    setBaseMapEditing(false);
    setGameplayEditing(false);
    onBoardPanelChange(null);
  }, [focusRequest?.requestId]);
  useEffect(() => {
    if (project.wholeLevelState === "generated" || (project.generatedOutput && project.generatedOutput.status !== "failed")) {
      setWorkflowStage("generated");
      setGeneratedOpen(true);
    } else if (project.mapUnderstandingLocked) {
      setWorkflowStage("plan");
    }
  }, [project.generatedOutput, project.wholeLevelState]);
  const shouldPan = (event: ReactPointerEvent<HTMLDivElement>) => !(event.target as HTMLElement).closest(".floating-card, .board-bottom-tools, .panel-recovery, .local-note, .sketch-style-control, button") && (spaceDown || event.button === 1 || activeTool === "move");
  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!shouldPan(event)) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { x: camera.x, y: camera.y, startX: event.clientX, startY: event.clientY, currentX: camera.x, currentY: camera.y }; setIsPanning(true);
  };
  const handlePointerMoveCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return;
    event.preventDefault(); event.stopPropagation();
    const nextX = panRef.current.x + event.clientX - panRef.current.startX;
    const nextY = panRef.current.y + event.clientY - panRef.current.startY;
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return;
    panRef.current.currentX = nextX;
    panRef.current.currentY = nextY;
    if (boardCameraRef.current) boardCameraRef.current.style.transform = `translate(${nextX}px, ${nextY}px) scale(${camera.zoom})`;
  };
  const handlePointerUpCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return;
    event.preventDefault(); event.stopPropagation();
    const completedPan = panRef.current;
    panRef.current = null;
    setCamera((current) => ({ ...current, x: completedPan.currentX, y: completedPan.currentY }));
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".floating-card, .local-note, .panel-recovery, .sketch-style-control")) return;
    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect(); if (!rect) return;
    const nextZoom = Math.min(1.35, Math.max(0.65, camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08)));
    const cursorX = event.clientX - rect.left; const cursorY = event.clientY - rect.top;
    const boardX = (cursorX - camera.x) / camera.zoom; const boardY = (cursorY - camera.y) / camera.zoom;
    setCamera({ zoom: nextZoom, x: cursorX - boardX * nextZoom, y: cursorY - boardY * nextZoom });
  };
  const goToStage = (stage: WorkflowStage) => {
    setWorkflowStage(stage);
    if (stage === "generated") { setGeneratedOpen(true); onBoardPanelChange(null); return; }
    setGeneratedOpen(false);
    if (stage === "understand") onBoardPanelChange("map");
    if (stage === "plan" || stage === "generate") onBoardPanelChange(null);
    if (stage === "edit") onBoardPanelChange(null);
  };

  const createManualCard = (kind: SemanticItemKind) => { if (!semanticPlacement) return; const targetId = semanticPlacement.targetId ?? project.sketchState.assetInstances.find((asset) => Math.hypot(asset.position.x - semanticPlacement.point.x, asset.position.y - semanticPlacement.point.y) < 120)?.id ?? project.sketchState.assetInstances[0]?.id; if (targetId) useWorldloomStore.getState().createSemanticItem(kind, targetId, semanticPlacement.point); setSemanticPlacement(null); };
  const editLayerVisible = project.mapLayers?.editVisible ?? project.mapLayers?.sketchVisible ?? true;
  const gameplayLayerVisible = project.mapLayers?.gameplayVisible ?? true;
  const openCanvasMenu = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".asset-instance, .local-note-anchor, .floating-card")) return;
    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect(); if (!rect) return;
    setCanvasMenu({ point: { x: (event.clientX - rect.left - camera.x) / camera.zoom, y: (event.clientY - rect.top - camera.y) / camera.zoom }, screen: { x: event.clientX - rect.left, y: event.clientY - rect.top } });
  };
  const createCanvasCard = (kind: SemanticItemKind, text?: string) => { if (!canvasMenu) return; const target = project.sketchState.assetInstances.find((asset) => Math.hypot(asset.position.x - canvasMenu.point.x, asset.position.y - canvasMenu.point.y) < 180) ?? project.sketchState.assetInstances[0]; if (target) useWorldloomStore.getState().createSemanticItem(kind, target.id, canvasMenu.point, text); setCanvasMenu(null); };
  const pasteCanvasNote = () => { void navigator.clipboard?.readText().then((text) => createCanvasCard("constraint", text.trim() || undefined)).catch(() => createCanvasCard("constraint")); };
  return <main className="board-workspace"><div ref={viewportRef} className={`board-viewport ${isPanning || spaceDown ? "is-panning" : ""}`} onWheel={handleWheel} onContextMenu={openCanvasMenu} onPointerDownCapture={handlePointerDownCapture} onPointerMoveCapture={handlePointerMoveCapture} onPointerUpCapture={handlePointerUpCapture} onPointerDown={(event) => { if (event.target === event.currentTarget && !isPanning) { selectSketchIds([]); setCanvasMenu(null); } }}>
    <div ref={boardCameraRef} className="board-camera" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})` }}><AssetSandboxCanvas camera={camera} placementMode={Boolean(semanticPlacement)} onSemanticPlacement={(point,targetId)=>setSemanticPlacement({point,targetId})} showEditLayer={editLayerVisible} showGameplayLayer={gameplayLayerVisible} gameplayEditing={gameplayEditing} gameplayTool={gameplayTool} gameplayNodeType={gameplayNodeType} gameplayRelationType={gameplayRelationType} gameplayRouteType={gameplayRouteType} baseMapUrl={project.mapLayers?.baseMapVisible ? project.mapLayers?.baseMapUrl : undefined} baseMapEditing={baseMapEditing} baseMapSettings={baseMapSettings} readOnly={Boolean(project.mapUnderstandingLocked)} />{editLayerVisible && !baseMapEditing && <LocalNotes />}</div>
    <nav className="top-workflow" aria-label="Workflow stages">{(["edit", "understand", "plan", "generate", "generated"] as WorkflowStage[]).map((stage, index) => <span key={stage}>{index > 0 && <b aria-hidden="true">→</b>}<button className={`${workflowStage === stage ? "active" : ""} ${stage === "edit" ? "workflow-edit-stage" : ""}`} onClick={() => goToStage(stage)}>{stage.toUpperCase()}</button></span>)}</nav>
    {gameplayEditing ? <div className="board-bottom-tools gameplay-toolbar" role="toolbar" aria-label="Gameplay graph tools"><strong>Gameplay Layer</strong><button className={gameplayTool === "select" ? "active" : ""} onClick={()=>setGameplayTool("select")}>Select</button><label>Node<select aria-label="Gameplay node type" value={gameplayNodeType} onChange={event=>setGameplayNodeType(event.target.value as GameplayNodeType)}>{(["start","goal","encounter","objective","reward","gate","trigger","checkpoint","branch","boss"] as GameplayNodeType[]).map(type=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}</select></label><button className={gameplayTool === "node" ? "active" : ""} onClick={()=>setGameplayTool("node")}>Add Node</button><label>Relation<select aria-label="Gameplay relation type" value={gameplayRelationType} onChange={event=>setGameplayRelationType(event.target.value as GameplayRelationType)}>{(["leads_to","requires","unlocks","triggers","rewards","blocks","reconnects"] as GameplayRelationType[]).map(type=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}</select></label><button className={gameplayTool === "relation" ? "active" : ""} onClick={()=>setGameplayTool("relation")}>Connect</button><label>Route<select aria-label="Gameplay route type" value={gameplayRouteType} onChange={event=>setGameplayRouteType(event.target.value as GameplayRouteType)}>{(["main_route","optional_route","shortcut","return_path","gated_route"] as GameplayRouteType[]).map(type=><option key={type} value={type}>{type.replaceAll("_"," ")}</option>)}</select></label><button className={gameplayTool === "route" ? "active" : ""} onClick={()=>setGameplayTool("route")}>Add Route</button><button onClick={()=>{setGameplayEditing(false);selectGameplayElement(null);}}>Exit Layer</button></div> : <div className="board-bottom-tools" role="toolbar" aria-label="Canvas tools">{([ ["select","Select"], ["pen","Sketch"], ["eraser","Erase"], ["connect","Connect"], ["annotation","Annotate"] ] as const).map(([tool,label]) => <button key={tool} className={(tool === "connect" ? connectMode : !connectMode && activeTool === tool) ? "active" : ""} onClick={() => { setConnectMode(false); setTool(tool === "connect" ? "select" : tool); if (tool === "connect") setInspectorOpen(true); }}><WorkspaceIcon name={tool}/>{label}</button>)}<button className={semanticPlacement ? "active" : ""} onClick={()=>setSemanticPlacement(semanticPlacement ? null : { point: { x: 0, y: 0 } })}>＋ New AI Card</button></div>}
    {semanticPlacement && semanticPlacement.point.x !== 0 && <div className="semantic-create-menu" style={{ left: `${semanticPlacement.point.x/project.metadata.canvasWidth*100}%`, top: `${semanticPlacement.point.y/project.metadata.canvasHeight*100}%` }}><strong>New AI Card</strong><button onClick={()=>createManualCard("question")}>Ask AI Question</button><button onClick={()=>createManualCard("reading")}>Create Candidate Reading</button><button onClick={()=>createManualCard("constraint")}>Add Constraint Note</button><button onClick={()=>setSemanticPlacement(null)}>Cancel</button></div>}
    {activeTool === "pen" && !baseMapEditing && <SketchStyleControl />}
    {activeTool === "annotation" && <AnnotationComposer />}
    {connectMode && <div className="connect-hint">Shift-select two assets, then connect <button disabled={project.sketchSelection.ids.length !== 2} onClick={() => { useWorldloomStore.getState().addSketchRelation(project.sketchSelection.ids[0], project.sketchSelection.ids[1], "connects"); setConnectMode(false); }}>Connect selection →</button></div>}
    <div className="panel-recovery"><button onClick={() => onBoardPanelChange(boardPanel === "assets" ? null : "assets")}>Assets</button><button onClick={() => onBoardPanelChange(boardPanel === "world" ? null : "world")}>World Setting</button><button onClick={() => goToStage("understand")}>Map Understanding</button><button onClick={() => setTraceOpen(o=>!o)}>Trace & Mini Map</button>{hasSelection && <button onClick={()=>setInspectorOpen(o=>!o)}>Selected Element</button>}<button onClick={clearUnsubmittedSketch}>Clear current doodle</button></div>
    <FloatingCard title="Layers" className="floating-layers" position={positions.layers} onMove={position=>movePanel("layers", position)}>
      <div className="layer-control-content" aria-label="Map layers">
        <div className="gameplay-layer-row"><label><span className="layer-swatch base-map" /><input type="checkbox" checked={project.mapLayers?.baseMapVisible ?? true} onChange={event=>setMapLayerVisible("baseMapVisible",event.target.checked)}/><span>Base Map Editing</span></label><button className={baseMapEditing ? "active" : ""} onClick={()=>{if(baseMapEditing)select(null);setBaseMapEditing(value=>!value);setGameplayEditing(false);selectGameplayElement(null);selectSketchIds([]);setTool("select");setMapLayerVisible("baseMapVisible",true);}}>Edit</button></div>
        <label><span className="layer-swatch edit" /><input type="checkbox" checked={editLayerVisible} onChange={event=>setMapLayerVisible("editVisible",event.target.checked)}/><span>Doodle + Asset Editing</span></label>
        <div className="gameplay-layer-row"><label><span className="layer-swatch gameplay" /><input type="checkbox" checked={gameplayLayerVisible} onChange={event=>setMapLayerVisible("gameplayVisible",event.target.checked)}/><span>Gameplay Semantic Layer</span></label><button className={project.mapLayers?.gameplayLocked ? "active" : ""} onClick={()=>setGameplayLayerLocked(!(project.mapLayers?.gameplayLocked ?? false))}>{project.mapLayers?.gameplayLocked ? "Unlock" : "Lock"}</button><button className={gameplayEditing ? "active" : ""} disabled={!gameplayLayerVisible || Boolean(project.mapLayers?.gameplayLocked)} onClick={()=>{setGameplayEditing(value=>!value);setGameplayTool("select");selectSketchIds([]);setTool("select");}}>Edit</button></div>
      </div>
    </FloatingCard>
    {baseMapEditing && <FloatingCard title="Base Map Editing" eyebrow="2D FOUNDATION" className="floating-base-map" position={positions.baseMap} onMove={(position) => movePanel("baseMap", position)} onClose={() => {setBaseMapEditing(false);select(null);}}><BaseMapEditingPanel settings={baseMapSettings} onChange={(patch)=>setBaseMapSettings((current)=>({...current,...patch}))} onExit={()=>{setBaseMapEditing(false);select(null);}}/></FloatingCard>}
    {canvasMenu && <div className="canvas-context-menu" style={{ left: canvasMenu.screen.x, top: canvasMenu.screen.y }} onPointerDown={(event) => event.stopPropagation()}><button onClick={() => createCanvasCard("question")}>Add AI Question</button><button onClick={() => createCanvasCard("reading")}>Add Candidate Note</button><button onClick={() => createCanvasCard("constraint")}>Add Constraint Note</button><button onClick={() => { useWorldloomStore.getState().addSketchMark("symbol"); setCanvasMenu(null); }}>Add Marker</button><button onClick={pasteCanvasNote}>Paste note</button></div>}
    <div className="board-zoom-controls"><button aria-label="Zoom out" onClick={()=>setCamera(c=>({...c,zoom:Math.max(.65,c.zoom-.1)}))}>−</button><span>{Math.round(camera.zoom*100)}%</span><button aria-label="Zoom in" onClick={()=>setCamera(c=>({...c,zoom:Math.min(1.35,c.zoom+.1)}))}>+</button><button onClick={()=>setCamera({x:0,y:0,zoom:1})}>Fit</button></div>
    {boardPanel === "assets" && <FloatingCard title="Assets" className="floating-assets" position={positions.assets} onMove={(position) => movePanel("assets", position)} onClose={() => onBoardPanelChange(null)}><AssetLibraryPanel /></FloatingCard>}
    {boardPanel === "world" && <FloatingCard title="World Setting" eyebrow="PROJECT" className="floating-world" position={positions.world} onMove={(position) => movePanel("world", position)} onClose={() => onBoardPanelChange(null)}><WorldSettingPanel /></FloatingCard>}
    {boardPanel === "map" && <FloatingCard title="Map Understanding" eyebrow="SHARED DECISIONS" className="floating-map" position={positions.map} onMove={(position) => movePanel("map", position)} onClose={() => onBoardPanelChange(null)}><MapUnderstandingReview /></FloatingCard>}
    {hasSelection && inspectorOpen && <FloatingCard title="Selected Element" className="floating-inspector" position={positions.inspector} onMove={(position) => movePanel("inspector", position)} onClose={() => setInspectorOpen(false)}><SelectedElementContent /></FloatingCard>}
    {workflowStage === "plan" && <FloatingCard title="Generation Plan" eyebrow="PLAN" className="floating-plan" position={positions.plan} onMove={position=>movePanel("plan", position)}><div className="plan-content"><p>Review the gameplay structure and prepare the generation plan.</p><GameplayLogicPanel /><button className="primary" disabled={!project.mapUnderstandingLocked} onClick={() => { generateAssetPlan(); goToStage("generate"); }}>Generate Plan</button></div></FloatingCard>}
    {workflowStage === "generate" && <FloatingCard title="Generate" eyebrow="GLOBAL OUTPUT" className="floating-generate" position={positions.generate} onMove={position=>movePanel("generate", position)}><div className="embedded-generation-panel"><p className="generation-intro">Generate from the confirmed map understanding, Gameplay Graph, spatial constraints, validation state, repairs, and Generation Contract.</p><MapUnderstandingPanel /></div></FloatingCard>}
    {generatedOpen && <FloatingCard title="Generated" eyebrow="FINAL OUTPUT" className="floating-generated" position={positions.generated} onMove={position=>movePanel("generated", position)} onClose={()=>setGeneratedOpen(false)}><GeneratedContent onReturnToEdit={()=>goToStage("edit")} onRegenerate={()=>goToStage("generate")} onOpenGodot={()=>goToStage("generate")} /></FloatingCard>}
    {traceOpen && <FloatingCard title="Design Trace & Mini Map" className="floating-trace" position={positions.trace} onMove={position=>movePanel("trace",position)} onClose={()=>setTraceOpen(false)}><MiniMap camera={camera}/><DesignTrace /></FloatingCard>}
  </div></main>;
}
