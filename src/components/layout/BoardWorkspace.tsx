import { WorkspaceIcon } from "./WorkspaceIcon";
import { SketchStyleControl } from "../sketch/SketchStyleControl";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from "react";
import { AnnotationComposer, DesignTrace, HypothesisContent, InterpretationSpace, LocalNotes, MiniMap, SelectedElementContent } from "./SemanticPanels";
import { MapUnderstandingPanel } from "../intent-review/MapUnderstandingPanel";
import { WorldSettingPanel } from "../intent-review/WorldSettingPanel";
import { AssetLibraryPanel } from "../assets/AssetLibraryPanel";

import { AssetSandboxCanvas } from "../sketch/AssetSandboxCanvas";
import { useWorldloomStore } from "../../store/useWorldloomStore";

export type BoardPanel = "assets" | "world" | "map";
type PanelPosition = { x: number; y: number };

function FloatingCard({ title, eyebrow, className = "", position, onMove, onClose, children }: { title: string; eyebrow?: string; className?: string; position: PanelPosition; onMove: (position: PanelPosition) => void; onClose?: () => void; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1100 && !className.includes("assets"));
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1099px)");
    const update = () => { if (media.matches && !className.includes("assets")) setCollapsed(true); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [className]);
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: position.x, y: position.y, startX: event.clientX, startY: event.clientY };
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const rect = event.currentTarget.parentElement!.getBoundingClientRect();
    const dx = event.clientX - dragRef.current.startX + dragRef.current.x - position.x;
    const dy = event.clientY - dragRef.current.startY + dragRef.current.y - position.y;
    onMove({ x: position.x + Math.max(8-rect.left, Math.min(window.innerWidth-rect.right-8, dx)), y: position.y + Math.max(60-rect.top, Math.min(window.innerHeight-rect.top-100, dy)) });
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <section className={`floating-card ${className} ${collapsed ? "is-collapsed" : ""}`} style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}>
    <div className="floating-card-header" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag}>
      <div>{eyebrow && <span className="floating-eyebrow">{eyebrow}</span>}<strong>{title}</strong></div>
      <button className="icon-button" aria-label={`${collapsed ? "Expand" : "Collapse"} ${title}`} onPointerDown={e => e.stopPropagation()} onClick={() => setCollapsed(c => !c)}>{collapsed ? "+" : "−"}</button>{onClose && <button className="icon-button" aria-label={`Close ${title}`} title={`Close ${title}`} onPointerDown={(event) => event.stopPropagation()} onClick={onClose}>×</button>}
    </div>
    {!collapsed && <div className="floating-card-content">{children}</div>}
  </section>;
}

export function BoardWorkspace({ openPanel, onOpenPanel }: { openPanel: BoardPanel | null; onOpenPanel: (panel: BoardPanel | null) => void }) {
  const { activeTool, project, interpretTogether, selectSketchIds, setTool } = useWorldloomStore();
  const [positions, setPositions] = useState<Record<BoardPanel | "inspector" | "response" | "space" | "trace" | "mini", PanelPosition>>({ assets: { x: 0, y: 0 }, world: { x: 0, y: 0 }, map: { x: 0, y: 0 }, inspector: { x: 0, y: 0 }, response: { x: 0, y: 0 }, space: { x: 0, y: 0 }, trace: { x: 0, y: 0 }, mini: { x: 0, y: 0 } });
  const [responseOpen, setResponseOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(true);
  const [traceOpen, setTraceOpen] = useState(true);
  const [miniOpen, setMiniOpen] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [connectMode, setConnectMode] = useState(false);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasSelection = project.sketchSelection.ids.length > 0;
  const hasSketch = project.sketchState.assetInstances.length > 0 || project.sketchState.rawStrokes.some((stroke) => !stroke.deleted) || project.sketchState.marks.length > 0 || project.sketchState.objects.length > 0;

  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.code === "Space" && !event.repeat && !(event.target as HTMLElement).closest("input, textarea, select, button, summary, [contenteditable=true]")) { event.preventDefault(); setSpaceDown(true); } };
    const up = (event: KeyboardEvent) => { if (event.code === "Space") setSpaceDown(false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);
  useEffect(() => {
    const summonAssets = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key.toLowerCase() === "a" && target?.tagName !== "INPUT" && target?.tagName !== "TEXTAREA" && target?.isContentEditable !== true) onOpenPanel("assets");
    };
    window.addEventListener("keydown", summonAssets);
    return () => window.removeEventListener("keydown", summonAssets);
  }, [onOpenPanel]);
  useEffect(() => { if (project.compositionHypothesis || project.assetEditPlan) setResponseOpen(true); }, [project.compositionHypothesis, project.assetEditPlan]);

  const movePanel = (panel: keyof typeof positions, position: PanelPosition) => setPositions((current) => ({ ...current, [panel]: position }));
  useEffect(() => { setInspectorOpen(true); }, [project.sketchSelection.ids]);
  const shouldPan = (event: ReactPointerEvent<HTMLDivElement>) => !(event.target as HTMLElement).closest(".floating-card, .board-bottom-tools, .panel-recovery, .local-note, .sketch-style-control, button") && (spaceDown || event.button === 1 || activeTool === "move");
  const handlePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!shouldPan(event)) return;
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { x: camera.x, y: camera.y, startX: event.clientX, startY: event.clientY }; setIsPanning(true);
  };
  const handlePointerMoveCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return;
    event.preventDefault(); event.stopPropagation();
    setCamera((current) => ({ ...current, x: panRef.current!.x + event.clientX - panRef.current!.startX, y: panRef.current!.y + event.clientY - panRef.current!.startY }));
  };
  const handlePointerUpCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current) return;
    event.preventDefault(); event.stopPropagation(); panRef.current = null; setIsPanning(false);
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
  const askAI = () => { if (!hasSketch) return; interpretTogether(); setResponseOpen(true); };

  return <main className="board-workspace"><div ref={viewportRef} className={`board-viewport ${isPanning || spaceDown ? "is-panning" : ""}`} onWheel={handleWheel} onContextMenu={(event) => { if (event.target === event.currentTarget || (event.target as HTMLElement).closest(".asset-sandbox-canvas")) { event.preventDefault(); onOpenPanel("assets"); } }} onPointerDownCapture={handlePointerDownCapture} onPointerMoveCapture={handlePointerMoveCapture} onPointerUpCapture={handlePointerUpCapture} onPointerDown={(event) => { if (event.target === event.currentTarget && !isPanning) selectSketchIds([]); }}>
    <div className="board-camera" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})` }}><AssetSandboxCanvas camera={camera} /><LocalNotes /></div>
    {!hasSketch && <div className="board-empty"><span>Sketch → Interpret → Negotiate → Commit → Playtest</span><h1>Give a place its meaning.</h1><p>Place assets and sketch routes to begin a shared spatial interpretation.</p><button onClick={() => useWorldloomStore.getState().loadV4DemoScene("high-ground")}>Open high-ground example →</button></div>}
    <div className="board-bottom-tools" role="toolbar" aria-label="Canvas tools">{([ ["select","Select"], ["pen","Sketch"], ["connect","Connect"], ["annotation","Annotate"] ] as const).map(([tool,label]) => <button key={tool} className={(tool === "connect" ? connectMode : !connectMode && activeTool === tool) ? "active" : ""} onClick={() => { setConnectMode(tool === "connect"); setTool(tool === "connect" ? "select" : tool); if (tool === "connect") setInspectorOpen(true); }}><WorkspaceIcon name={tool}/>{label}</button>)}</div>
    {activeTool === "pen" && <SketchStyleControl />}
    {activeTool === "annotation" && <AnnotationComposer />}
    {connectMode && <div className="connect-hint">Shift-select two assets, then connect <button disabled={project.sketchSelection.ids.length !== 2} onClick={() => { useWorldloomStore.getState().addSketchRelation(project.sketchSelection.ids[0], project.sketchSelection.ids[1], "connects"); setConnectMode(false); }}>Connect selection →</button></div>}
    <div className="panel-recovery"><button onClick={() => onOpenPanel(openPanel === "assets" ? null : "assets")}>Assets</button><button onClick={() => setResponseOpen(o=>!o)}>Hypothesis</button><button onClick={() => setSpaceOpen(o=>!o)}>Meaning</button><button onClick={() => setTraceOpen(o=>!o)}>Trace</button><button onClick={() => setMiniOpen(o=>!o)}>Mini map</button>{hasSelection && <button onClick={()=>setInspectorOpen(o=>!o)}>Selection</button>}<button disabled={!hasSketch} onClick={askAI}>Interpret selection →</button></div>
    <div className="board-zoom-controls"><button aria-label="Zoom out" onClick={()=>setCamera(c=>({...c,zoom:Math.max(.65,c.zoom-.1)}))}>−</button><span>{Math.round(camera.zoom*100)}%</span><button aria-label="Zoom in" onClick={()=>setCamera(c=>({...c,zoom:Math.min(1.35,c.zoom+.1)}))}>+</button><button onClick={()=>setCamera({x:0,y:0,zoom:1})}>Fit</button></div>
    {openPanel === "assets" && <FloatingCard title="Assets" className="floating-assets" position={positions.assets} onMove={(position) => movePanel("assets", position)} onClose={() => onOpenPanel(null)}><AssetLibraryPanel /></FloatingCard>}
    {openPanel === "world" && <FloatingCard title="World Setting" eyebrow="PROJECT" className="floating-world" position={positions.world} onMove={(position) => movePanel("world", position)} onClose={() => onOpenPanel(null)}><WorldSettingPanel /></FloatingCard>}
    {openPanel === "map" && <FloatingCard title="Map Understanding" eyebrow="REVIEW" className="floating-map" position={positions.map} onMove={(position) => movePanel("map", position)} onClose={() => onOpenPanel(null)}><MapUnderstandingPanel /></FloatingCard>}
    {hasSelection && inspectorOpen && <FloatingCard title="Selected Element" className="floating-inspector" position={positions.inspector} onMove={(position) => movePanel("inspector", position)} onClose={() => setInspectorOpen(false)}><SelectedElementContent /></FloatingCard>}
    {responseOpen && <FloatingCard title="Interpretation Hypothesis" eyebrow="INTERPRETATION HYPOTHESIS" className="floating-response" position={positions.response} onMove={(position) => movePanel("response", position)} onClose={() => setResponseOpen(false)}><HypothesisContent /></FloatingCard>}
    {spaceOpen && <FloatingCard title="Interpretation Space" className="floating-space" position={positions.space} onMove={(position) => movePanel("space", position)} onClose={() => setSpaceOpen(false)}><InterpretationSpace /></FloatingCard>}
    {traceOpen && <FloatingCard title="Design Trace" className="floating-trace" position={positions.trace} onMove={position=>movePanel("trace",position)} onClose={()=>setTraceOpen(false)}><DesignTrace /></FloatingCard>}
    {miniOpen && <FloatingCard title="Mini Map" className="floating-minimap" position={positions.mini} onMove={position=>movePanel("mini",position)} onClose={()=>setMiniOpen(false)}><MiniMap camera={camera}/></FloatingCard>}
  </div></main>;
}
