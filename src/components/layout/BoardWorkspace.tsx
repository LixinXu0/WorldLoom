import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from "react";
import { IntentReviewPanel } from "../intent-review/IntentReviewPanel";
import { MapUnderstandingPanel } from "../intent-review/MapUnderstandingPanel";
import { WorldSettingPanel } from "../intent-review/WorldSettingPanel";
import { AssetLibraryPanel } from "../assets/AssetLibraryPanel";
import { SketchSandboxPanel } from "../sketch/SketchSandboxPanel";
import { AssetSandboxCanvas } from "../sketch/AssetSandboxCanvas";
import { useWorldloomStore } from "../../store/useWorldloomStore";

export type BoardPanel = "assets" | "world" | "map";
type PanelPosition = { x: number; y: number };

function FloatingCard({ title, eyebrow, className = "", position, onMove, onClose, children }: { title: string; eyebrow?: string; className?: string; position: PanelPosition; onMove: (position: PanelPosition) => void; onClose?: () => void; children: ReactNode }) {
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: position.x, y: position.y, startX: event.clientX, startY: event.clientY };
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    onMove({ x: dragRef.current.x + event.clientX - dragRef.current.startX, y: dragRef.current.y + event.clientY - dragRef.current.startY });
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <section className={`floating-card ${className}`} style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}>
    <div className="floating-card-header" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag}>
      <div>{eyebrow && <span className="floating-eyebrow">{eyebrow}</span>}<strong>{title}</strong></div>
      {onClose && <button className="icon-button" aria-label={`Close ${title}`} title={`Close ${title}`} onPointerDown={(event) => event.stopPropagation()} onClick={onClose}>×</button>}
    </div>
    <div className="floating-card-content">{children}</div>
  </section>;
}

function AIPresence({ onAsk }: { onAsk: () => void }) {
  const { project } = useWorldloomStore();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const hasConflict = project.conflicts.length > 0 || project.compositionHypothesis?.status === "clarifying";
  const state = hasConflict ? "conflict" : project.compositionHypothesis ? "proposal" : "neutral";
  const glyph = state === "conflict" ? "!" : state === "proposal" ? "✦" : "●";
  return <div className={`ai-presence ai-${state}`} style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }} title="Drag Worldloom here to ask about local board context" onPointerDown={(event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { ...position, startX: event.clientX, startY: event.clientY };
  }} onPointerMove={(event) => {
    if (!dragRef.current) return;
    setPosition({ x: dragRef.current.x + event.clientX - dragRef.current.startX, y: dragRef.current.y + event.clientY - dragRef.current.startY });
  }} onPointerUp={(event) => {
    const wasDragged = Boolean(dragRef.current && Math.hypot(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY) > 6);
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!wasDragged) onAsk();
  }}><span>{glyph}</span><div><strong>AI Presence</strong><small>{state === "conflict" ? "Needs your attention" : state === "proposal" ? "Proposal ready" : "Ask about this area"}</small></div></div>;
}

export function BoardWorkspace({ openPanel, onOpenPanel }: { openPanel: BoardPanel | null; onOpenPanel: (panel: BoardPanel | null) => void }) {
  const { activeTool, project, researchLog, interpretTogether, selectSketchIds } = useWorldloomStore();
  const [positions, setPositions] = useState<Record<BoardPanel | "inspector" | "response" | "space", PanelPosition>>({ assets: { x: 18, y: 18 }, world: { x: 334, y: 92 }, map: { x: 328, y: 116 }, inspector: { x: 0, y: 124 }, response: { x: 346, y: 78 }, space: { x: 346, y: 462 } });
  const [responseOpen, setResponseOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(false);
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const hasSelection = project.sketchSelection.ids.length > 0;
  const hasSketch = project.sketchState.assetInstances.length > 0 || project.sketchState.rawStrokes.some((stroke) => !stroke.deleted) || project.sketchState.marks.length > 0 || project.sketchState.objects.length > 0;

  useEffect(() => {
    const down = (event: KeyboardEvent) => { if (event.code === "Space" && !event.repeat) { event.preventDefault(); setSpaceDown(true); } };
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
  const shouldPan = (event: ReactPointerEvent<HTMLDivElement>) => spaceDown || event.button === 1 || activeTool === "move";
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
    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect(); if (!rect) return;
    const nextZoom = Math.min(1.35, Math.max(0.65, camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08)));
    const cursorX = event.clientX - rect.left; const cursorY = event.clientY - rect.top;
    const boardX = (cursorX - camera.x) / camera.zoom; const boardY = (cursorY - camera.y) / camera.zoom;
    setCamera({ zoom: nextZoom, x: cursorX - boardX * nextZoom, y: cursorY - boardY * nextZoom });
  };
  const askAI = () => { if (!hasSketch) return; interpretTogether(); setResponseOpen(true); };

  return <main className="board-workspace"><div ref={viewportRef} className={`board-viewport ${isPanning || spaceDown ? "is-panning" : ""}`} onWheel={handleWheel} onContextMenu={(event) => { if (event.target === event.currentTarget || (event.target as HTMLElement).closest(".asset-sandbox-canvas")) { event.preventDefault(); onOpenPanel("assets"); } }} onPointerDownCapture={handlePointerDownCapture} onPointerMoveCapture={handlePointerMoveCapture} onPointerUpCapture={handlePointerUpCapture} onPointerDown={(event) => { if (event.target === event.currentTarget && !isPanning) selectSketchIds([]); }}>
    <div className="board-camera" style={{ transform: `translate3d(${camera.x}px, ${camera.y}px, 0) scale(${camera.zoom})` }}><AssetSandboxCanvas camera={camera} /></div>
    <div className="board-hud"><span className="board-status-dot" /><strong>{project.name}</strong><span>{project.sketchState.assetInstances.length} assets</span><span>{project.sketchState.rawStrokes.filter((stroke) => !stroke.deleted).length} strokes</span><span>{researchLog.length} events</span></div>
    <div className="board-zoom-controls" aria-label="Canvas zoom controls"><button title="Zoom out" onClick={() => setCamera((current) => ({ ...current, zoom: Math.max(0.65, current.zoom - 0.1) }))}>−</button><span>{Math.round(camera.zoom * 100)}%</span><button title="Zoom in" onClick={() => setCamera((current) => ({ ...current, zoom: Math.min(1.35, current.zoom + 0.1) }))}>+</button><button title="Reset canvas view" onClick={() => setCamera({ x: 0, y: 0, zoom: 1 })}>Fit</button></div>
    <AIPresence onAsk={askAI} />
    <div className="board-bottom-tools"><span className="current-tool">{activeTool === "pen" ? "Draw" : activeTool === "select" ? "Select" : activeTool === "eraser" ? "Erase" : "Pan"}</span><span>Space + drag to pan</span><span>Scroll to zoom</span></div>
    {openPanel === "assets" && <FloatingCard title="Asset Tray" eyebrow="INSERT" className="floating-assets" position={positions.assets} onMove={(position) => movePanel("assets", position)} onClose={() => onOpenPanel(null)}><AssetLibraryPanel onPlaced={() => onOpenPanel(null)} /></FloatingCard>}
    {openPanel === "world" && <FloatingCard title="World Setting" eyebrow="PROJECT" className="floating-world" position={positions.world} onMove={(position) => movePanel("world", position)} onClose={() => onOpenPanel(null)}><WorldSettingPanel /></FloatingCard>}
    {openPanel === "map" && <FloatingCard title="Map Understanding" eyebrow="REVIEW" className="floating-map" position={positions.map} onMove={(position) => movePanel("map", position)} onClose={() => onOpenPanel(null)}><MapUnderstandingPanel /></FloatingCard>}
    {hasSelection && <FloatingCard title="Contextual Inspector" eyebrow="SELECTED" className="floating-inspector" position={positions.inspector} onMove={(position) => movePanel("inspector", position)} onClose={() => selectSketchIds([])}><SketchSandboxPanel /></FloatingCard>}
    {responseOpen && <FloatingCard title="Worldloom Thinks" eyebrow="LOCAL AI" className="floating-response" position={positions.response} onMove={(position) => movePanel("response", position)} onClose={() => setResponseOpen(false)}><IntentReviewPanel /></FloatingCard>}
    {spaceOpen && <FloatingCard title="Interpretation Space" eyebrow="EXPLORE" className="floating-space" position={positions.space} onMove={(position) => movePanel("space", position)} onClose={() => setSpaceOpen(false)}><InterpretationSpace /></FloatingCard>}
    <button className="summon-space" onClick={() => setSpaceOpen((open) => !open)}>{spaceOpen ? "Hide meaning" : "Explore meaning"}</button>
  </div></main>;
}

function InterpretationSpace() {
  const { project } = useWorldloomStore();
  return <div className="interpretation-space"><p className="space-primary">{project.compositionHypothesis?.summary ?? "Move a slider to explore what this area could mean."}</p><div className="space-scale"><span>Grouping</span><input aria-label="Function meaning" type="range" min="0" max="100" defaultValue="55" /><span>Combat</span></div><div className="space-scale"><span>Local</span><input aria-label="Scope meaning" type="range" min="0" max="100" defaultValue="42" /><span>Regional</span></div><div className="space-scale"><span>Relation</span><input aria-label="Route meaning" type="range" min="0" max="100" defaultValue="50" /><span>Traversal</span></div><div className="space-actions"><button>Why this?</button><button className="primary">Looks right</button></div></div>;
}
