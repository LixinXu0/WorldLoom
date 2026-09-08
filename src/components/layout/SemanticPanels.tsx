import { semanticItemsFor, traceSemantic } from "../../core/sketch/semanticPresentation";
import { demoTrace } from "../../examples/semanticDemo";
import { strokeStyle } from "../../core/sketch/semanticStyles";
import { useEffect, useRef, useState } from "react";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import { assetById } from "../../assets/mockAssetLibrary";
import { AssetVisual } from "../assets/AssetVisual";
export function SelectedElementContent() {
  const { project, modelStatus, modelError, retryInterpretation, selectCompositionCandidate, editCompositionCandidate, setCustomInterpretation, setSemanticDimension, commitComposition } = useWorldloomStore();
  const asset = project.sketchState.assetInstances.find(a => project.sketchSelection.ids.includes(a.id));
  const h = project.compositionHypothesis;
  const localItems = semanticItemsFor(project);
  const demoReading = localItems.find(n=>n.kind==="reading" && n.source==="demo");
  const role = h?.assetRoles.find(r => r.assetInstanceId === asset?.id);
  const opaque = project.researchMode === "c1-ai-opaque" && h?.status !== "committed";
  const name = (id: string) => { const a = project.sketchState.assetInstances.find(a => a.id === id); return assetById(a?.assetDefinitionId ?? "")?.name ?? id; };
  const relations = project.sketchState.relations.filter(r => project.sketchSelection.ids.includes(r.sourceId) || project.sketchSelection.ids.includes(r.targetId));
  const [editingCandidate, setEditingCandidate] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [candidateDescription, setCandidateDescription] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customType, setCustomType] = useState("environment");
  const selectedCandidate = h?.alternatives[0];
  const beginCandidateEdit = (candidate: typeof selectedCandidate) => { if (!candidate) return; setEditingCandidate(candidate.id); setCandidateName(candidate.name ?? candidate.summary.split(" · ")[0].split(":")[0]); setCandidateDescription(candidate.description ?? candidate.summary.split(":").slice(1).join(":").trim()); };
  const saveCandidateEdit = () => { if (!editingCandidate) return; editCompositionCandidate(editingCandidate, { name: candidateName, description: candidateDescription }); setEditingCandidate(null); };
  return <div className="semantic-inspector">
    {asset ? <div className="selected-identity"><AssetVisual id={asset.assetDefinitionId}/><div><strong>{name(asset.id)}</strong><small>{asset.id}</small></div></div> : <p>{project.sketchSelection.ids.length} selected elements</p>}
    {project.sketchSubmission?.screenshot && <section><h3>Sketch Preview</h3><img className="sketch-submission-preview" src={project.sketchSubmission.screenshot} alt="Selected doodle preview" /></section>}
    {h && project.researchMode !== "c1-ai-opaque" && <section className="selected-interpretation"><h3>Element Interpretation</h3><small className={`model-status model-${modelStatus}`}>{modelStatus === "loading" ? "Generating interpretation…" : modelStatus === "ready" ? "Model response" : modelStatus === "error" ? `Failed · ${modelError ?? "local fallback"}` : "Local interpretation"}{modelStatus === "error" && <button className="text-action" onClick={retryInterpretation}>Retry</button>}</small><div className="candidate-list">{h.alternatives.slice(0, 3).map((candidate, index) => <button className={`candidate-reading ${index === 0 ? "selected" : ""}`} key={candidate.id} onClick={() => selectCompositionCandidate(candidate.id)}><strong>{candidate.name ?? `Candidate ${index + 1}`}</strong><span>{candidate.description ?? candidate.summary}</span><small>{candidate.semanticType ?? "environment"} · {Math.round((candidate.confidence ?? h.confidence) * 100)}%</small></button>)}</div>{selectedCandidate && <div className="candidate-editor"><button className="text-action" onClick={() => beginCandidateEdit(selectedCandidate)}>{editingCandidate ? "Editing selected candidate" : "Edit selected candidate"}</button>{editingCandidate && <><input value={candidateName} onChange={event=>setCandidateName(event.target.value)} placeholder="Candidate name"/><textarea value={candidateDescription} onChange={event=>setCandidateDescription(event.target.value)} placeholder="Detailed description"/><button className="primary" onClick={saveCandidateEdit}>Save candidate</button></>}</div>}<details><summary>Custom Interpretation</summary><div className="custom-interpretation"><input value={customName} onChange={event=>setCustomName(event.target.value)} placeholder="Custom name"/><textarea value={customDescription} onChange={event=>setCustomDescription(event.target.value)} placeholder="Detailed description"/><select value={customType} onChange={event=>setCustomType(event.target.value)}><option value="environment">Environment</option><option value="gameplay">Gameplay</option></select><button className="text-action" disabled={!customName.trim()} onClick={()=>{setCustomInterpretation(customName,customDescription,customType);setCustomName("");setCustomDescription("");}}>Use Custom Interpretation</button></div></details></section>}
    <section><h3>Current Interpretation</h3><dl><dt>Function</dt><dd>{opaque ? "Hidden in opaque condition" : role?.proposedRole ?? asset?.roleAssignments[0] ?? demoReading?.text ?? "Unassigned"}</dd><dt>Scope</dt><dd>{project.committedCompositionIntent?.editScope ?? (demoReading ? "Demo composition" : "Selected composition")}</dd><dt>Role</dt><dd>{asset?.locked ? "Explicit constraint" : "Open to interpretation"}</dd></dl></section>
    <section><h3>Open Questions</h3>{!h && localItems.filter(n=>n.kind==="question").map(n=><p className="question-row" key={n.id}><span>?</span>{n.text}</p>)}{!opaque && h?.clarificationRequests.filter(q => !h.clarificationAnswers.some(a => a.requestId === q.id) && (!q.targetSketchIds.length || q.targetSketchIds.some(id => project.sketchSelection.ids.includes(id)))).map(q => <p className="question-row" key={q.id}><span>?</span>{q.question}</p>)}{h && !opaque && !h.clarificationRequests.some(q => !h.clarificationAnswers.some(a => a.requestId === q.id) && q.targetSketchIds.some(id => project.sketchSelection.ids.includes(id))) && <p>No open questions for this selection.</p>}{((!h && !demoReading) || opaque) && <p>Interpret this selection to identify ambiguity.</p>}</section>
    <section><h3>Relations</h3>{relations.map(r => <div className={`semantic-relation relation-${r.relationType}`} key={r.id}><span>⟶</span><span>{r.relationType.replaceAll("_", " ")}</span><span>{name(r.sourceId === asset?.id ? r.targetId : r.sourceId)}</span></div>)}{!relations.length && <p>No explicit connections yet.</p>}</section>
    {h && Object.entries(project.semanticDimensions ?? {}).length > 0 && <section><h3>Local Semantic Parameters</h3>{Object.entries(project.semanticDimensions ?? {}).map(([key, dimension]) => <label className="selected-axis" key={key}><span>{key.replaceAll("_", " ")}</span><input type="range" min="0" max="100" value={Math.round(dimension.value * 100)} onChange={event=>setSemanticDimension(key, Number(event.target.value) / 100)} /><small>{Math.round(dimension.value * 100)}%</small></label>)}</section>}
    <section><h3>Status</h3><p><i className={`status-dot ${h?.status === "committed" ? "committed" : ""}`}/>{h?.status === "committed" ? "Confirmed" : h ? (modelStatus === "loading" ? "Interpreting" : modelStatus === "error" ? "Failed" : "Candidate") : (project.sketchSubmission?.status === "interpreting" ? "Interpreting" : demoReading ? "Candidate · demo" : "Uninterpreted")}</p>{project.sketchSubmission && <small className={`submission-state submission-${project.sketchSubmission.status}`}>Sketch: {project.sketchSubmission.status}</small>}<button className="primary" disabled={!h || h.status === "committed"} onClick={commitComposition}>Confirm Element Interpretation</button></section>
  </div>;
}

export function GeneratedContent({ onReturnToEdit, onRegenerate }: { onReturnToEdit: () => void; onRegenerate: () => void }) {
  const { project } = useWorldloomStore();
  const output = project.generatedOutput;
  const elements = project.sketchState.assetInstances;
  const gameplay = elements.filter((asset) => /enemy|spawn|npc|patrol|stronghold|gate|reward|checkpoint/i.test(`${asset.assetDefinitionId} ${asset.roleAssignments.join(" ")}`));
  const download = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
  };
  const copyScenePath = () => { if (output?.scenePath) void navigator.clipboard?.writeText(output.scenePath); };
  return <div className="generated-content">
    <div className="generated-status"><span className={`status-dot ${output?.status === "success" || output?.status === "contract_ready" ? "committed" : ""}`} />{output?.status === "success" ? "Generated successfully" : output?.status === "contract_ready" ? "Generation contract ready" : output?.status === "failed" ? "Generation failed" : "No generated output yet"}</div>
    {project.mapLayers?.baseMapUrl && <section><h3>Generated Base Map</h3><img className="generated-base-map" src={project.mapLayers.baseMapUrl} alt="Generated base map" /></section>}
    <section><h3>Final Map Composition</h3><div className="generated-summary"><span>Elements <strong>{elements.length}</strong></span><span>Gameplay <strong>{gameplay.length}</strong></span><span>Assets <strong>{output?.generatedAssetCount ?? elements.length}</strong></span></div><div className="generated-data-preview"><strong>Scene data</strong><pre>{JSON.stringify({ elements: elements.map((asset) => ({ id: asset.id, assetDefinitionId: asset.assetDefinitionId, position: asset.position })), gameplay: gameplay.map((asset) => asset.roleAssignments), scenePath: output?.scenePath ?? "external scene output" }, null, 2)}</pre></div></section>
    <section><h3>Godot Result</h3><p>{output?.message ?? "Generate a scene to publish the final result."}</p>{output?.scenePath && <div className="scene-path"><code>{output.scenePath}</code><button onClick={copyScenePath}>Copy Scene Path</button></div>}</section>
    <div className="generated-actions"><button className="primary" onClick={onRegenerate}>Regenerate</button><button onClick={onRegenerate}>Open / Launch Godot</button><button onClick={() => download(project.mapUnderstandingSnapshot ?? { elements }, "worldloom-map-understanding.json")}>Export Map Understanding JSON</button><button onClick={() => download(project.generationContract ?? { generatedOutput: output, elements }, "worldloom-generation-plan.json")}>Download Generation Plan JSON</button><button onClick={onReturnToEdit}>Return to Edit</button></div>
  </div>;
}

export function DesignTrace() {
  const {researchLog,project} = useWorldloomStore();
  const demo = project.sketchState.semanticItems?.some(n=>n.source==="demo");
  const real = researchLog.filter(e=>e.eventType!=="session_started");
  const rows = [...(demo ? demoTrace.map((e,i)=>({id:`demo-${i}`,type:e.eventType,label:e.label,time:e.time,demo:true})) : []), ...real.map(e=>({id:e.eventId,type:e.eventType,label:e.eventType.replaceAll("_"," "),time:new Date(e.timestamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}),demo:false}))].slice(-5);
  return <>{demo && !real.length && <small className="trace-source">Illustrative demo trace</small>}<ol className="design-trace">{rows.map(e=><li key={e.id} title={e.demo?"Illustrative demo event":undefined}><i className={`trace-${traceSemantic(e.type)}`}/><time>{e.time}</time><span>{e.label}</span></li>)}</ol>{!rows.length&&<p>Spatial actions and interpretations will appear here.</p>}</>;
}

export function MiniMap({ camera }: { camera: { x:number; y:number; zoom:number } }) {
  const { project } = useWorldloomStore();
  const { canvasWidth:w, canvasHeight:h } = project.metadata;
  return <svg className="mini-map" viewBox={`0 0 ${w} ${h}`} aria-label="Composition overview"><text x={w-45} y="35" fill="var(--muted)" fontSize="24">N ↑</text>{project.sketchState.marks.map(m => <polyline key={m.id} points={m.points.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--branch)" strokeWidth="4"/>)}{project.sketchState.rawStrokes.filter(s=>!s.deleted).map(s=><polyline key={s.id} points={s.points.map(p=>`${p.x},${p.y}`).join(" ")} fill="none" stroke={strokeStyle(s.semanticStyle).color} strokeDasharray={strokeStyle(s.semanticStyle).dash} strokeWidth="4"/>)}{project.sketchState.assetInstances.map(a => <rect key={a.id} x={a.position.x-15} y={a.position.y-12} width="30" height="24" fill="none" stroke={a.locked ? "var(--relief)" : "var(--flow)"} strokeWidth="3"/>)}<rect x={-camera.x/camera.zoom} y={-camera.y/camera.zoom} width={w/camera.zoom} height={h/camera.zoom} fill="none" stroke="var(--text)" strokeWidth="4"/></svg>;
}

export function MapUnderstandingReview() {
  const { project, selectSketchIds, deleteAssetInstance, confirmMapUnderstanding, unlockMapUnderstanding } = useWorldloomStore();
  const elements = project.sketchState.assetInstances;
  const exportUnderstanding = () => { const blob = new Blob([JSON.stringify(project.mapUnderstandingSnapshot ?? { elements, worldSetting: project.worldSetting?.text ?? "" }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "worldloom-map-understanding.json"; link.click(); URL.revokeObjectURL(url); };
  return <div className="map-understanding-review"><div className="map-review-summary"><span>Map Elements <strong>{elements.length}</strong></span><span>Routes <strong>{project.sketchState.rawStrokes.filter((stroke) => !stroke.deleted).length}</strong></span><span>Total <strong>{elements.length}</strong></span></div>{project.mapUnderstandingLocked ? <div className="confirmed-copy">Map Understanding Confirmed · Locked</div> : <button className="primary" disabled={!elements.length} onClick={confirmMapUnderstanding}>Confirm Map Understanding</button>}{project.mapUnderstandingLocked && <button className="text-action" onClick={unlockMapUnderstanding}>Edit Map Understanding</button>}<button className="text-action" disabled={!elements.length} onClick={exportUnderstanding}>Export Map Understanding JSON</button>{elements.map((asset) => <div className="map-element-row environment" key={asset.id}><AssetVisual id={asset.assetDefinitionId}/><div><strong>{asset.assetDefinitionId}</strong><small>Map element</small><p>{asset.roleAssignments[0] ?? "Unassigned interpretation"}</p></div><button onClick={()=>selectSketchIds([asset.id])}>Focus</button><button disabled={project.mapUnderstandingLocked} onClick={()=>deleteAssetInstance(asset.id)}>Delete</button></div>)}</div>;
}

export function GameplayLogicPanel() {
  const { project } = useWorldloomStore();
  const functional = /spawn|goal|objective|enemy|stronghold|encounter|npc|patrol|gate|trigger|reward|checkpoint/i;
  const nodes = project.sketchState.assetInstances.filter((asset) => functional.test(`${asset.assetDefinitionId} ${asset.roleAssignments.join(" ")}`));
  const routes = project.sketchState.rawStrokes.filter((stroke) => !stroke.deleted && /main-route|optional-path|branch/.test(stroke.semanticStyle ?? ""));
  const relations = project.sketchState.relations.filter((relation) => /leads|requires|unlock|block|trigger|reconnect|reward/.test(relation.relationType));
  return <div className="gameplay-logic-panel"><div className="gameplay-flow"><strong>Functional structure</strong>{nodes.length === 0 && routes.length === 0 && <p>No gameplay semantics assigned yet.</p>}{routes.map((route, index) => <div className="gameplay-node" key={route.id}><span>{route.semanticStyle === "optional-path" ? "Optional Route" : "Main Route"}</span><small>{index < routes.length - 1 ? "↓" : ""}</small></div>)}{nodes.map((asset) => <div className="gameplay-node" key={asset.id}><span>{asset.roleAssignments[0] ?? asset.assetDefinitionId.replaceAll("_", " ")}</span><small>{asset.id}</small></div>)}</div><div className="gameplay-relations"><strong>Logical relations</strong>{relations.length === 0 ? <p>No functional relations yet.</p> : relations.map((relation) => <div key={relation.id}><span>{relation.relationType.replaceAll("_", " ")}</span><small>{relation.sourceId} → {relation.targetId ?? "—"}</small></div>)}</div></div>;
}

export function LocalNotes() {
  const { project, answerCompositionClarification, selectSketchIds, interpretTogether, moveSemanticItem, hideSemanticItem, deleteSemanticItem, reassignSemanticItem, convertSemanticItem } = useWorldloomStore();
  const [closed, setClosed] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number; surface: "marker" | "card" } | null>(null);
  const [compact, setCompact] = useState(window.innerWidth < 1100);
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  useEffect(() => { const m=window.matchMedia("(max-width:1099px)"); const update=()=>{setCompact(m.matches);setMobileOpen(null);};m.addEventListener("change",update);return()=>m.removeEventListener("change",update);}, []);
  const h = project.compositionHypothesis;
  if (project.researchMode === "c1-ai-opaque") return null;
  const notes = semanticItemsFor(project);
  const titles = {question:"AI Question",reading:"Candidate Reading",constraint:"Constraint Note",uncertainty:"Unresolved Area",conflict:"Structural Conflict"};
  return <>{notes.map(n => {
    const asset=project.sketchState.assetInstances.find(a=>a.id===n.targetId); if(!asset)return null;
    const visual = n.visualPosition ?? { x: asset.position.x + n.offset.x, y: asset.position.y + n.offset.y };
    const question=h?.clarificationRequests.find(q=>q.id===n.id);
    const initiallyOpen=["question","reading","constraint"].includes(n.kind);
    const provenance = n.source === "auto_detected" ? "AI detected" : n.source === "user_created" ? "User added" : n.source === "demo" ? "Demo" : "AI generated";
    return <div className={`local-note-anchor semantic-item ${n.kind}`} key={n.id} data-source={n.source} style={{left:`${visual.x/project.metadata.canvasWidth*100}%`,top:`${visual.y/project.metadata.canvasHeight*100}%`,margin:0}} onContextMenu={(event)=>{event.preventDefault();event.stopPropagation();setContextMenu({id:n.id,x:event.nativeEvent.offsetX,y:event.nativeEvent.offsetY,surface:(event.target as HTMLElement).closest(".semantic-marker") ? "marker" : "card"});}}>
      <svg className="note-tether" style={{overflow:"visible"}} width="1" height="1" aria-hidden="true"><path d={`M0 0 L${asset.position.x-visual.x} ${asset.position.y-visual.y}`} fill="none" stroke="var(--note)" strokeWidth="1"/></svg>
      <div className="note-position" onPointerDown={(event)=>{if((event.target as HTMLElement).closest("button"))return;dragRef.current={id:n.id,startX:event.clientX,startY:event.clientY,originX:visual.x,originY:visual.y};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={(event)=>{const drag=dragRef.current;if(!drag||drag.id!==n.id)return;const rect=event.currentTarget.closest(".board-viewport")?.getBoundingClientRect();if(rect){const x=drag.originX+(event.clientX-drag.startX)/rect.width*project.metadata.canvasWidth;const y=drag.originY+(event.clientY-drag.startY)/rect.height*project.metadata.canvasHeight;moveSemanticItem(n.id,{x,y},event.target instanceof HTMLElement && event.target.closest(".semantic-marker") ? "marker" : "card");}dragRef.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} style={{transform:"none"}}>
        <button className="semantic-marker" aria-label={`Open ${titles[n.kind]}`} onClick={()=>{setClosed(c=>c.filter(id=>id!==n.id));setMobileOpen(n.id);if(n.kind==="question" && !h){selectSketchIds([asset.id]);interpretTogether();}}}>{n.kind==="uncertainty"?"?":n.kind==="constraint"?"✓":"!"}</button>
        {!closed.includes(n.id) && (initiallyOpen && !compact || mobileOpen===n.id) && <section className="local-note"><header><strong>{titles[n.kind]}</strong><button aria-label={`Close ${titles[n.kind]}`} onClick={()=>{setClosed(c=>[...c,n.id]);setMobileOpen(null);}}>×</button></header><small className="semantic-provenance">{provenance}</small><p>{n.text}</p>{question?.options?.map(o=><button className="note-answer" key={o.id} onClick={()=>answerCompositionClarification(question.id,o.id)}>{o.label}</button>)}{n.kind === "reading" && <button className="note-answer" onClick={()=>useWorldloomStore.getState().commitComposition()}>Commit Interpretation</button>}</section>}
      </div>
      {contextMenu?.id===n.id && <div className="semantic-context-menu" style={{left:contextMenu.x,top:contextMenu.y}} onPointerDown={event=>event.stopPropagation()}>{contextMenu.surface === "marker" ? <><button onClick={()=>{setClosed(c=>c.filter(id=>id!==n.id));setMobileOpen(n.id);setContextMenu(null);}}>Open question</button><button onClick={()=>{selectSketchIds([asset.id]);interpretTogether();setContextMenu(null);}}>Re-run interpretation</button><button onClick={()=>{reassignSemanticItem(n.id,project.sketchSelection.ids.find(id=>project.sketchState.assetInstances.some(a=>a.id===id)) ?? asset.id);setContextMenu(null);}}>Reassign target</button><button onClick={()=>{convertSemanticItem(n.id,n.kind === "question" ? "uncertainty" : "question");setContextMenu(null);}}>Convert marker type</button><button onClick={()=>{hideSemanticItem(n.id);setContextMenu(null);}}>Hide</button><button className="danger-action" onClick={()=>{deleteSemanticItem(n.id);setContextMenu(null);}}>Delete marker</button></> : <><button onClick={()=>{selectSketchIds([asset.id]);setContextMenu(null);}}>Focus element</button><button onClick={()=>{selectSketchIds([asset.id]);interpretTogether();setContextMenu(null);}}>Re-run interpretation</button><button onClick={()=>{convertSemanticItem(n.id,"constraint");setContextMenu(null);}}>Convert to note</button><button onClick={()=>{setClosed(c=>[...c,n.id]);setContextMenu(null);}}>Collapse</button><button onClick={()=>{hideSemanticItem(n.id);setContextMenu(null);}}>Hide</button><button onClick={()=>{reassignSemanticItem(n.id,project.sketchSelection.ids.find(id=>project.sketchState.assetInstances.some(a=>a.id===id)) ?? asset.id);setContextMenu(null);}}>Reassign target</button>{n.kind === "reading" && <button onClick={()=>{useWorldloomStore.getState().commitComposition();setContextMenu(null);}}>Commit Interpretation</button>}<button className="danger-action" onClick={()=>{deleteSemanticItem(n.id);setContextMenu(null);}}>Delete card</button></>}</div>}
    </div>;
  })}</>;

}

export function AnnotationComposer() {
  const { project, annotateSketch, setTool } = useWorldloomStore();
  const [text, setText] = useState("");
  const asset = project.sketchState.assetInstances.find(a=>project.sketchSelection.ids.includes(a.id));
  return <form className="annotation-composer" onSubmit={e=>{e.preventDefault();if(asset && text.trim()){annotateSketch(asset.id,text);setText("");setTool("select");}}}>
    <label htmlFor="spatial-note">{asset ? `Annotate ${assetById(asset.assetDefinitionId)?.name}` : "Select an asset to annotate"}</label>
    <input id="spatial-note" autoFocus value={text} onChange={e=>setText(e.target.value)} placeholder="e.g. main approach"/>
    <button disabled={!asset || !text.trim()}>Attach note →</button><button type="button" aria-label="Close annotation composer" onClick={()=>setTool("select")}>×</button>
  </form>;
}
