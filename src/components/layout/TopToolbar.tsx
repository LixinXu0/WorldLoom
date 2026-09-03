import { useRef } from "react";
import { exportProject } from "../../core/serialization/projectJson";
import { useWorldloomStore } from "../../store/useWorldloomStore";

type BoardPanel = "assets" | "world" | "map";

type TopToolbarProps = {
  onOpenBoardPanel?: (panel: BoardPanel | null) => void;
};

export function TopToolbar({ onOpenBoardPanel }: TopToolbarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { project, activeTool, undo, redo, compileIntent, generate, regenerate, setSeed, importJson, loadExample, setResearchMode, setTextInstruction, exportResearchLogJson, exportTrainingExampleJson, generateAssetPlan, setTool, groupSelectedSketch } = useWorldloomStore();
  const download = (text: string, filename: string) => {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  const save = () => download(exportProject(project), `${project.name.replace(/\s+/g, "-").toLowerCase()}.json`);
  const load = (file: File | undefined) => {
    if (!file) return;
    void file.text().then(importJson);
  };
  const isV4 = project.researchMode === "c1-ai-opaque" || project.researchMode === "c2-ai-negotiable" || project.researchMode === "c3-ai-negotiable-conventions";
  const hasSketch = project.strokes.length > 0 || project.sketchState.rawStrokes.some((stroke) => !stroke.deleted) || project.sketchState.marks.length > 0 || project.sketchState.objects.length > 0 || project.sketchState.assetInstances.length > 0;
  const stage = project.assetEditPlan ? "Edit Plan" : project.committedCompositionIntent ? "Committed" : project.compositionHypothesis ? "Grounding" : project.variants.length > 0 ? "Refine" : project.constraints.length > 0 ? "Interpret" : hasSketch ? "Compose" : "Start";
  if (isV4) {
    return <header className="topbar v4-topbar">
      <div className="brand"><span className="brand-mark">✦</span><strong>Worldloom</strong><button className="project-switcher">{project.name.replace(/^Demo [A-Z] - /, "")}⌄</button></div>
      <div className="toolbar-tools" aria-label="Board tools">
        <button className="tool-button" onClick={() => setTool("move")}>✋<span>Pan</span></button>
        <button className={`tool-button ${activeTool === "select" ? "active" : ""}`} onClick={() => setTool("select")}>↖<span>Select</span></button>
        <button className={`tool-button ${activeTool === "pen" ? "active" : ""}`} onClick={() => setTool("pen")}>⌁<span>Draw</span></button>
        <button className="tool-button" onClick={() => setTool("select")}>⌘<span>Connect</span></button>
        <button className="tool-button" onClick={() => setTool("annotation")}>T<span>Text</span></button>
        <button className="tool-button" onClick={groupSelectedSketch}>⌗<span>Group</span></button>
        <details className="toolbar-menu"><summary>•••</summary><div className="toolbar-popover"><button onClick={() => setTool("eraser")}>Erase</button><button onClick={() => onOpenBoardPanel?.("assets")}>Asset Tray</button><button onClick={() => onOpenBoardPanel?.("world")}>World Setting</button><button onClick={() => onOpenBoardPanel?.("map")}>Map Understanding</button><button onClick={loadExample}>Load Demo</button><button onClick={() => inputRef.current?.click()}>Load JSON</button><button onClick={save}>Save JSON</button><button onClick={() => download(exportResearchLogJson(), "research-log.json")}>Research Log</button></div></details>
      </div>
      <div className="topbar-actions"><button className="icon-button large" aria-label="Undo" title="Undo" onClick={undo}>↶</button><button className="icon-button large" aria-label="Redo" title="Redo" onClick={redo}>↷</button><button className="soft-action" onClick={() => onOpenBoardPanel?.("world")}>Project</button><button className="playtest-button" disabled={!project.variants.length} onClick={() => useWorldloomStore.getState().startPlaytest()}>▷ Playtest</button><button className="share-button" onClick={save}>⇧ Share</button><span className="user-orb">W</span></div>
      <input ref={inputRef} type="file" accept="application/json" hidden onChange={(event) => load(event.target.files?.[0])} />
    </header>;
  }
  return (
    <header className="topbar">
      <div className="brand"><strong>Worldloom</strong><span>{project.name}</span><small>{stage}</small></div>
      <button onClick={undo}>Undo</button>
      <button onClick={redo}>Redo</button>
      <button onClick={save}>Save JSON</button>
      <button onClick={() => inputRef.current?.click()}>Load JSON</button>
      <input ref={inputRef} type="file" accept="application/json" hidden onChange={(event) => load(event.target.files?.[0])} />
      <button onClick={loadExample}>Legacy Example</button>
      <label className="seed">Research <select value={project.researchMode} onChange={(event) => setResearchMode(event.target.value as typeof project.researchMode)}><option value="c1-ai-opaque">C1 AI Opaque</option><option value="c2-ai-negotiable">C2 AI Negotiable</option><option value="c3-ai-negotiable-conventions">C3 Negotiable + Conventions</option><option value="legacy-rule-based">Legacy Rule-Based</option></select></label>
      <input className="instruction-input" value={project.textInstruction} placeholder="Optional clarification" onChange={(event) => setTextInstruction(event.target.value)} />
      <button className="primary" disabled={!hasSketch} onClick={compileIntent}>{isV4 ? "Interpret Together" : "Compile Intent"}</button>
      {isV4 ? <button className="primary" disabled={!project.committedCompositionIntent} onClick={generateAssetPlan}>Generate Edit Plan</button> : <button className="primary" disabled={project.constraints.length === 0} onClick={generate}>Generate Variants</button>}
      <button onClick={() => download(exportResearchLogJson(), "research-log.json")}>Research Log</button>
      <button onClick={() => download(exportTrainingExampleJson(), "training-example.json")}>Training Example</button>
      <label className="seed">Seed <input type="number" value={project.seed} onChange={(event) => setSeed(Number(event.target.value))} /></label>
      {!isV4 && <button disabled={project.constraints.length === 0} onClick={regenerate}>Regenerate</button>}
    </header>
  );
}
