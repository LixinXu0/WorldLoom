import { semanticItemsFor, traceSemantic } from "../../core/sketch/semanticPresentation";
import { demoTrace } from "../../examples/semanticDemo";
import { strokeStyle } from "../../core/sketch/semanticStyles";
import { useEffect, useState } from "react";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import { assetById } from "../../assets/mockAssetLibrary";
import { AssetVisual } from "../assets/AssetVisual";
import { SketchSandboxPanel } from "../sketch/SketchSandboxPanel";
import { IntentReviewPanel } from "../intent-review/IntentReviewPanel";

export function HypothesisContent() {
  const { project } = useWorldloomStore();
  const h = project.compositionHypothesis;
  if (!h) return <p>Sketch a spatial intention, then interpret the composition.</p>;
  if (project.researchMode === "c1-ai-opaque") return <IntentReviewPanel />;
  return <div className="hypothesis-content"><div className="hypothesis-title"><strong>{h.alternatives[0]?.summary ?? "Composition interpretation"}</strong><span>{Math.round(h.confidence * 100)}%</span></div>
    <p>{h.summary}</p>
    <section><h4>Alternative readings</h4>{h.alternatives.length ? h.alternatives.map(a => <p key={a.id} title={a.rationale}>• {a.summary}</p>) : <p>No alternative readings proposed.</p>}</section>
    <section><h4>Key uncertainty</h4><p>{h.clarificationRequests.find(q => !h.clarificationAnswers.some(a => a.requestId === q.id))?.question ?? "No unresolved clarification requests."}</p></section>
    <details><summary>Negotiate interpretation</summary><IntentReviewPanel /></details>
  </div>;
}

export function SelectedElementContent() {
  const { project, commitComposition } = useWorldloomStore();
  const asset = project.sketchState.assetInstances.find(a => project.sketchSelection.ids.includes(a.id));
  const h = project.compositionHypothesis;
  const localItems = semanticItemsFor(project);
  const demoReading = localItems.find(n=>n.kind==="reading" && n.source==="demo");
  const role = h?.assetRoles.find(r => r.assetInstanceId === asset?.id);
  const opaque = project.researchMode === "c1-ai-opaque" && h?.status !== "committed";
  const name = (id: string) => { const a = project.sketchState.assetInstances.find(a => a.id === id); return assetById(a?.assetDefinitionId ?? "")?.name ?? id; };
  const relations = project.sketchState.relations.filter(r => project.sketchSelection.ids.includes(r.sourceId) || project.sketchSelection.ids.includes(r.targetId));
  return <div className="semantic-inspector">
    {asset ? <div className="selected-identity"><AssetVisual id={asset.assetDefinitionId}/><div><strong>{name(asset.id)}</strong><small>{asset.id}</small></div></div> : <p>{project.sketchSelection.ids.length} selected elements</p>}
    <section><h3>Current Interpretation</h3><dl><dt>Function</dt><dd>{opaque ? "Hidden in opaque condition" : role?.proposedRole ?? asset?.roleAssignments[0] ?? demoReading?.text ?? "Unassigned"}</dd><dt>Scope</dt><dd>{project.committedCompositionIntent?.editScope ?? (demoReading ? "Demo composition" : "Selected composition")}</dd><dt>Role</dt><dd>{asset?.locked ? "Explicit constraint" : "Open to interpretation"}</dd></dl></section>
    <section><h3>Open Questions</h3>{!h && localItems.filter(n=>n.kind==="question").map(n=><p className="question-row" key={n.id}><span>?</span>{n.text}</p>)}{!opaque && h?.clarificationRequests.filter(q => !h.clarificationAnswers.some(a => a.requestId === q.id) && (!q.targetSketchIds.length || q.targetSketchIds.some(id => project.sketchSelection.ids.includes(id)))).map(q => <p className="question-row" key={q.id}><span>?</span>{q.question}</p>)}{h && !opaque && !h.clarificationRequests.some(q => !h.clarificationAnswers.some(a => a.requestId === q.id) && q.targetSketchIds.some(id => project.sketchSelection.ids.includes(id))) && <p>No open questions for this selection.</p>}{((!h && !demoReading) || opaque) && <p>Interpret this selection to identify ambiguity.</p>}</section>
    <section><h3>Relations</h3>{relations.map(r => <div className={`semantic-relation relation-${r.relationType}`} key={r.id}><span>⟶</span><span>{r.relationType.replaceAll("_", " ")}</span><span>{name(r.sourceId === asset?.id ? r.targetId : r.sourceId)}</span></div>)}{!relations.length && <p>No explicit connections yet.</p>}</section>
    <section><h3>Status</h3><p><i className={`status-dot ${h?.status === "committed" ? "committed" : ""}`}/>{h?.status ?? (demoReading ? "Candidate · demo" : "Uninterpreted")}</p><button className="text-action" disabled={!h || h.status === "committed"} onClick={commitComposition}>Commit to shared state →</button></section>
    <details><summary>Spatial editing & connections</summary><SketchSandboxPanel /></details>
  </div>;
}

export function InterpretationSpace() {
  const { project } = useWorldloomStore();
  const h = project.compositionHypothesis;
  if (project.researchMode === "c1-ai-opaque") return <p>Interpretation details are hidden in the opaque research condition.</p>;
  // Read-only semantic positions inferred from the current hypothesis; never fake persisted controls.
  const text = `${h?.summary} ${h?.assetRoles.map(r => r.proposedRole).join(" ")}`.toLowerCase();
  const axes: [string,string,number][] = [["Grouping","Combat", /encounter|combat|defen/.test(text) ? 78 : 25],["Local","Regional", /regional|global/.test(text) ? 75 : 30],["Detour","Main Route", /main|approach/.test(text) ? 72 : 35]];
  return <div className="interpretation-space"><p>{h ? "Current hypothesis in design semantics space." : "Interpret a composition to locate its meaning."}</p>{axes.map(([a,b,v]) => <div className="space-scale" key={a}><span>{a}</span><div className="semantic-axis" role="img" aria-label={`${a} to ${b}: ${h ? `leans toward ${v > 50 ? b : a}` : "not interpreted"}`}>{h && <i style={{left: `${v}%`}}/>}</div><span>{b}</span></div>)}<small>Qualitative reading of the current hypothesis</small></div>;
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

export function LocalNotes() {
  const { project, answerCompositionClarification } = useWorldloomStore();
  const [closed, setClosed] = useState<string[]>([]);
  const [compact, setCompact] = useState(window.innerWidth < 1100);
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);
  useEffect(() => { const m=window.matchMedia("(max-width:1099px)"); const update=()=>{setCompact(m.matches);setMobileOpen(null);};m.addEventListener("change",update);return()=>m.removeEventListener("change",update);}, []);
  const h = project.compositionHypothesis;
  if (project.researchMode === "c1-ai-opaque") return null;
  const notes = semanticItemsFor(project);
  const titles = {question:"AI Question",reading:"Candidate Reading",constraint:"Constraint Note",uncertainty:"Unresolved Area",conflict:"Structural Conflict"};
  return <>{notes.map(n => {
    const asset=project.sketchState.assetInstances.find(a=>a.id===n.targetId); if(!asset)return null;
    const question=h?.clarificationRequests.find(q=>q.id===n.id);
    const initiallyOpen=["question","reading","constraint"].includes(n.kind);
    return <div className={`local-note-anchor semantic-item ${n.kind}`} key={n.id} data-source={n.source} style={{left:`${asset.position.x/project.metadata.canvasWidth*100}%`,top:`${asset.position.y/project.metadata.canvasHeight*100}%`,margin:0}}>
      <svg className="note-tether" style={{overflow:"visible"}} width="1" height="1" aria-hidden="true"><path d={`M0 0 Q${n.offset.x*.6} ${n.offset.y*.1} ${n.offset.x} ${n.offset.y}`} fill="none" stroke="var(--note)" strokeWidth="1"/></svg>
      <div className="note-position" style={{transform:`translate(${n.offset.x}px,${n.offset.y}px)`}}>
        <button className="semantic-marker" aria-label={`Open ${titles[n.kind]}`} onClick={()=>{setClosed(c=>c.filter(id=>id!==n.id));setMobileOpen(n.id);}}>{n.kind==="uncertainty"?"?":n.kind==="constraint"?"✓":"!"}</button>
        {!closed.includes(n.id) && (initiallyOpen && !compact || mobileOpen===n.id) && <section className="local-note"><header><strong>{titles[n.kind]}</strong><button aria-label={`Close ${titles[n.kind]}`} onClick={()=>{setClosed(c=>[...c,n.id]);setMobileOpen(null);}}>×</button></header><p>{n.text}</p>{question?.options?.map(o=><button className="note-answer" key={o.id} onClick={()=>answerCompositionClarification(question.id,o.id)}>{o.label}</button>)}</section>}
      </div>
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
