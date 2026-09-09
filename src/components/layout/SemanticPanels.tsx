import { semanticItemsFor, traceSemantic } from "../../core/sketch/semanticPresentation";
import { demoTrace } from "../../examples/semanticDemo";
import { strokeStyle } from "../../core/sketch/semanticStyles";
import { useEffect, useRef, useState } from "react";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import { assetById } from "../../assets/mockAssetLibrary";
import { AssetVisual } from "../assets/AssetVisual";
export function SelectedElementContent() {
  const { project, gameplaySelectionId, modelStatus, modelError, retryInterpretation, selectCompositionCandidate, editCompositionCandidate, setCustomInterpretation, setSemanticDimension, commitComposition, answerCompositionClarification, interpretTogether } = useWorldloomStore();
  const asset = project.sketchState.assetInstances.find(a => project.sketchSelection.ids.includes(a.id));
  const hypothesis = project.compositionHypothesis;
  const h = hypothesis?.assetRoles.some((role) => role.assetInstanceId === asset?.id) ? hypothesis : undefined;
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
  const [responses, setResponses] = useState<Record<string, { optionId?: string; text: string }>>({});
  const selectedCandidate = h?.alternatives[0];
  const beginCandidateEdit = (candidate: typeof selectedCandidate) => { if (!candidate) return; setEditingCandidate(candidate.id); setCandidateName(candidate.name ?? candidate.summary.split(" · ")[0].split(":")[0]); setCandidateDescription(candidate.description ?? candidate.summary.split(":").slice(1).join(":").trim()); };
  const saveCandidateEdit = () => { if (!editingCandidate) return; editCompositionCandidate(editingCandidate, { name: candidateName, description: candidateDescription }); setEditingCandidate(null); };
  const gameplayElement = project.gameplaySemanticLayer?.elements.find((element) => element.id === gameplaySelectionId);
  if (gameplayElement) return <GameplayElementInspector id={gameplayElement.id} />;
  return <div className="semantic-inspector">
    {asset ? <div className="selected-identity"><AssetVisual id={asset.assetDefinitionId}/><div><strong>{name(asset.id)}</strong><small>{asset.id}</small><small>Type: {assetById(asset.assetDefinitionId)?.category ?? "element"}</small></div></div> : <p>{project.sketchSelection.ids.length} selected elements</p>}
    {project.sketchSubmission?.screenshot && <section><h3>Sketch Preview</h3><img className="sketch-submission-preview" src={project.sketchSubmission.screenshot} alt="Selected doodle preview" /></section>}
    {h && project.researchMode !== "c1-ai-opaque" && <section className="selected-interpretation"><h3>Element Interpretation</h3><small className={`model-status model-${modelStatus}`}>{modelStatus === "loading" ? "Generating interpretation…" : modelStatus === "ready" ? "Model response" : modelStatus === "error" ? `Failed · ${modelError ?? "local fallback"}` : "Local interpretation"}{modelStatus === "error" && <button className="text-action" onClick={retryInterpretation}>Retry</button>}</small><div className="candidate-list">{h.alternatives.slice(0, 3).map((candidate, index) => <button className={`candidate-reading ${index === 0 ? "selected" : ""}`} key={candidate.id} onClick={() => selectCompositionCandidate(candidate.id)}><strong>{candidate.name ?? `Candidate ${index + 1}`}</strong><span>{candidate.description ?? candidate.summary}</span><small>{candidate.semanticType ?? "environment"} · {Math.round((candidate.confidence ?? h.confidence) * 100)}%</small></button>)}</div>{selectedCandidate && <div className="candidate-editor"><button className="text-action" onClick={() => beginCandidateEdit(selectedCandidate)}>{editingCandidate ? "Editing selected candidate" : "Edit selected candidate"}</button>{editingCandidate && <><input value={candidateName} onChange={event=>setCandidateName(event.target.value)} placeholder="Candidate name"/><textarea value={candidateDescription} onChange={event=>setCandidateDescription(event.target.value)} placeholder="Detailed description"/><button className="primary" onClick={saveCandidateEdit}>Save candidate</button></>}</div>}<details><summary>Custom Interpretation</summary><div className="custom-interpretation"><input value={customName} onChange={event=>setCustomName(event.target.value)} placeholder="Custom name"/><textarea value={customDescription} onChange={event=>setCustomDescription(event.target.value)} placeholder="Detailed description"/><select value={customType} onChange={event=>setCustomType(event.target.value)}><option value="environment">Environment</option><option value="gameplay">Gameplay</option></select><button className="text-action" disabled={!customName.trim()} onClick={()=>{setCustomInterpretation(customName,customDescription,customType);setCustomName("");setCustomDescription("");}}>Use Custom Interpretation</button></div></details></section>}
    <section><h3>Current Interpretation</h3><dl><dt>Semantic type</dt><dd>{opaque ? "Hidden in opaque condition" : selectedCandidate?.semanticType ?? "Gameplay"}</dd><dt>Meaning</dt><dd>{opaque ? "Hidden in opaque condition" : role?.proposedRole ?? asset?.roleAssignments[0] ?? demoReading?.text ?? "Needs interpretation"}</dd><dt>Status</dt><dd>{asset?.roleAssignments.length ? "Confirmed" : h ? "Candidate" : "Needs interpretation"}</dd></dl></section>
    <section className="interactive-questions"><h3>Open Questions</h3>{!h && localItems.filter(n=>n.kind==="question" && n.targetId === asset?.id).map(n=><div className="question-row" key={n.id}><span>?</span><div><p>{n.text}</p><button className="text-action" onClick={() => interpretTogether()}>Interpret with AI</button></div></div>)}{!opaque && h?.clarificationRequests.filter(q => !h.clarificationAnswers.some(a => a.requestId === q.id) && (!q.targetSketchIds.length || q.targetSketchIds.includes(asset?.id ?? ""))).map(q => { const response = responses[q.id] ?? { text: "" }; return <form className="question-response" key={q.id} onSubmit={(event) => { event.preventDefault(); if (!response.optionId && !response.text.trim()) return; answerCompositionClarification(q.id, response.optionId, response.text); }}><div className="question-row"><span>?</span><p>{q.question}</p></div><div className="question-options">{(q.options ?? []).map(option => <label key={option.id}><input type="radio" name={q.id} checked={response.optionId === option.id} onChange={() => setResponses(current => ({ ...current, [q.id]: { ...response, optionId: option.id } }))}/>{option.label}</label>)}{q.allowFreeText && <label><input type="radio" name={q.id} checked={!response.optionId && Boolean(response.text)} onChange={() => setResponses(current => ({ ...current, [q.id]: { ...response, optionId: undefined } }))}/>Other</label>}</div>{q.allowFreeText && <input value={response.text} onChange={(event) => setResponses(current => ({ ...current, [q.id]: { optionId: undefined, text: event.target.value } }))} placeholder="Custom answer"/>}<button className="primary" disabled={!response.optionId && !response.text.trim()}>Submit Response</button></form>; })}{h && !opaque && !h.clarificationRequests.some(q => !h.clarificationAnswers.some(a => a.requestId === q.id) && q.targetSketchIds.includes(asset?.id ?? "")) && <p>No open questions for this element.</p>}{((!h && !demoReading) || opaque) && <button className="text-action" onClick={() => interpretTogether()}>Interpret this element with AI</button>}</section>
    <section><h3>Relations</h3>{relations.map(r => <div className={`semantic-relation relation-${r.relationType}`} key={r.id}><span>⟶</span><span>{r.relationType.replaceAll("_", " ")}</span><span>{name(r.sourceId === asset?.id ? r.targetId : r.sourceId)}</span></div>)}{!relations.length && <p>No explicit connections yet.</p>}</section>
    {h && Object.entries(project.semanticDimensions ?? {}).length > 0 && <section><h3>Local Semantic Parameters</h3>{Object.entries(project.semanticDimensions ?? {}).map(([key, dimension]) => <label className="selected-axis" key={key}><span>{key.replaceAll("_", " ")}</span><input type="range" min="0" max="100" value={Math.round(dimension.value * 100)} onChange={event=>setSemanticDimension(key, Number(event.target.value) / 100)} /><small>{Math.round(dimension.value * 100)}%</small></label>)}</section>}
    <section><h3>Status</h3><p><i className={`status-dot ${asset?.roleAssignments.length ? "committed" : ""}`}/>{asset?.roleAssignments.length ? "Confirmed" : h ? (modelStatus === "loading" ? "Interpreting" : modelStatus === "error" ? "Failed" : "Candidate") : (project.sketchSubmission?.status === "interpreting" ? "Interpreting" : demoReading ? "Candidate · demo" : "Uninterpreted")}</p>{project.sketchSubmission && <small className={`submission-state submission-${project.sketchSubmission.status}`}>Sketch: {project.sketchSubmission.status}</small>}<button className="primary" disabled={!h || Boolean(asset?.roleAssignments.length)} onClick={commitComposition}>Confirm Element</button></section>
  </div>;
}

function GameplayElementInspector({ id }: { id: string }) {
  const { project, updateGameplayElement, resizeGameplayElement, addGameplayWaypoint, deleteGameplayWaypoint, moveGameplayWaypoint, reverseGameplayRoute, deleteGameplayElement, selectGameplayElement, selectSketchIds } = useWorldloomStore();
  const element = project.gameplaySemanticLayer?.elements.find((item) => item.id === id);
  if (!element) return null;
  const locked = Boolean(project.mapLayers?.gameplayLocked || project.gameplaySemanticLayer?.locked);
  const label = element.type.replaceAll("_", " ");
  const setPoint = (key: "position" | "startPoint" | "endPoint", axis: "x" | "y", value: string) => {
    const current = element[key] ?? element.position;
    updateGameplayElement(id, { [key]: { ...current, [axis]: Number(value) || 0 } });
  };
  return <div className="semantic-inspector gameplay-element-inspector">
    <div className="selected-identity"><div className={`gameplay-inspector-icon ${element.type}`}>{element.type === "player_spawn" ? "↟" : element.type === "npc" ? "●" : element.type === "enemy_stronghold" ? "⚑" : "→"}</div><div><strong>{element.name}</strong><small>{element.id}</small><small>Gameplay Semantic Layer</small></div></div>
    <section><h3>Gameplay Element</h3><dl><dt>Type</dt><dd>{label}</dd><dt>Source Doodle</dt><dd>{element.sourceDoodleId}</dd></dl><button className="text-action" disabled={element.sourceDoodleId === "manual"} onClick={()=>selectSketchIds([element.sourceDoodleId])}>Focus Source</button></section>
    <section><h3>Identity</h3><label>Name<input disabled={locked} value={element.name} onChange={event=>updateGameplayElement(id,{name:event.target.value})}/></label><label>Description<textarea disabled={locked} value={element.description} onChange={event=>updateGameplayElement(id,{description:event.target.value})}/></label><label>Source Doodle<input disabled={locked} value={element.sourceDoodleId} onChange={event=>updateGameplayElement(id,{sourceDoodleId:event.target.value || "manual"})}/></label></section>
    <section><h3>Spatial Extent</h3><div className="gameplay-coordinate-grid"><label>X<input disabled={locked} type="number" value={Math.round(element.position.x)} onChange={event=>setPoint("position","x",event.target.value)}/></label><label>Y<input disabled={locked} type="number" value={Math.round(element.position.y)} onChange={event=>setPoint("position","y",event.target.value)}/></label><label>Width<input disabled={locked} type="number" value={Math.round(element.region.width)} onChange={event=>resizeGameplayElement(id,{...element.region,width:Number(event.target.value)})}/></label><label>Height<input disabled={locked} type="number" value={Math.round(element.region.height)} onChange={event=>resizeGameplayElement(id,{...element.region,height:Number(event.target.value)})}/></label></div></section>
    {element.type === "npc_patrol_route" && <section><h3>Patrol Route</h3><dl><dt>Direction</dt><dd>{element.direction ?? "forward"}</dd><dt>Start Point</dt><dd>{Math.round(element.startPoint?.x ?? element.position.x)}, {Math.round(element.startPoint?.y ?? element.position.y)}</dd><dt>End Point</dt><dd>{Math.round(element.endPoint?.x ?? element.position.x)}, {Math.round(element.endPoint?.y ?? element.position.y)}</dd></dl><div className="gameplay-waypoint-editor">{(element.waypoints ?? []).map((point,index)=><div key={index}><strong>{index === 0 ? "Start" : index === (element.waypoints?.length ?? 0)-1 ? "End" : `Waypoint ${index}`}</strong><input disabled={locked} type="number" value={Math.round(point.x)} onChange={event=>moveGameplayWaypoint(id,index,{...point,x:Number(event.target.value)})}/><input disabled={locked} type="number" value={Math.round(point.y)} onChange={event=>moveGameplayWaypoint(id,index,{...point,y:Number(event.target.value)})}/><button disabled={locked || index === 0 || index === (element.waypoints?.length ?? 0)-1} onClick={()=>deleteGameplayWaypoint(id,index)}>×</button></div>)}</div><button disabled={locked} onClick={()=>addGameplayWaypoint(id,{x:element.position.x+80,y:element.position.y+35})}>Add Waypoint</button><button disabled={locked} onClick={()=>reverseGameplayRoute(id)}>Reverse Direction</button></section>}
    <section><h3>Status</h3><p><i className="status-dot committed"/> {locked ? "Layer locked" : "Editable"}</p><button className="danger-action" disabled={locked} onClick={()=>{deleteGameplayElement(id);selectGameplayElement(null);}}>Delete Gameplay Element</button></section>
  </div>;
}

export function GeneratedContent({ onReturnToEdit, onRegenerate, onOpenGodot }: { onReturnToEdit: () => void; onRegenerate: () => void; onOpenGodot: () => void }) {
  const { project } = useWorldloomStore();
  const output = project.generatedOutput;
  const elements = project.sketchState.assetInstances;
  const gameplay = project.gameplaySemanticLayer?.elements ?? [];
  const download = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
  };
  const copyScenePath = () => { if (output?.scenePath) void navigator.clipboard?.writeText(output.scenePath); };
  return <div className="generated-content">
    <div className="generated-status"><span className={`status-dot ${output?.status === "success" || output?.status === "contract_ready" ? "committed" : ""}`} />{output?.status === "success" ? "Generated successfully" : output?.status === "contract_ready" ? "Generation contract ready" : output?.status === "failed" ? "Generation failed" : "No generated output yet"}</div>
    {project.mapLayers?.baseMapUrl && <section><h3>Generated Base Map</h3><img className="generated-base-map" src={project.mapLayers.baseMapUrl} alt="Generated base map" /></section>}
    <section><h3>Final Map Composition</h3><div className="generated-summary"><span>Elements <strong>{elements.length}</strong></span><span>Gameplay Semantics <strong>{gameplay.length}</strong></span><span>Assets <strong>{output?.generatedAssetCount ?? elements.length}</strong></span></div><div className="generated-data-preview"><strong>Scene data</strong><pre>{JSON.stringify({ elements: elements.map((asset) => ({ id: asset.id, assetDefinitionId: asset.assetDefinitionId, position: asset.position })), gameplay, scenePath: output?.scenePath ?? "external scene output" }, null, 2)}</pre></div></section>
    <section><h3>Godot Result</h3><p>{output?.message ?? "Generate a scene to publish the final result."}</p>{output?.scenePath && <div className="scene-path"><code>{output.scenePath}</code><button onClick={copyScenePath}>Copy Scene Path</button></div>}</section>
    <div className="generated-actions"><button className="primary" onClick={onRegenerate}>Regenerate</button><button onClick={onOpenGodot}>Generate / Open in Godot</button><button onClick={() => download(project.mapUnderstandingSnapshot ?? { elements }, "worldloom-map-understanding.json")}>Export Map Understanding JSON</button><button onClick={() => download(project.generationContract ?? { generatedOutput: output, elements }, "worldloom-generation-plan.json")}>Download Contract JSON</button><button onClick={onReturnToEdit}>Return to Edit</button></div>
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
  const { project, selectSketchIds, confirmMapUnderstanding, unlockMapUnderstanding } = useWorldloomStore();
  const elements = project.sketchState.assetInstances;
  const confirmed = elements.filter((asset) => asset.roleAssignments.length > 0);
  const unconfirmed = elements.filter((asset) => asset.roleAssignments.length === 0);
  const allConfirmed = elements.length > 0 && unconfirmed.length === 0;
  const exportUnderstanding = () => { const blob = new Blob([JSON.stringify(project.mapUnderstandingSnapshot ?? { elements, worldSetting: project.worldSetting?.text ?? "" }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "worldloom-map-understanding.json"; link.click(); URL.revokeObjectURL(url); };
  const row = (asset: typeof elements[number], state: "confirmed" | "unconfirmed") => <div className={`map-element-row ${state}`} key={asset.id}><AssetVisual id={asset.assetDefinitionId}/><div><strong>{assetById(asset.assetDefinitionId)?.name ?? asset.assetDefinitionId}</strong><small>{state === "confirmed" ? "Confirmed" : "Needs review"}</small><p>{asset.roleAssignments[0] ?? "No confirmed interpretation"}</p></div><button onClick={()=>selectSketchIds([asset.id])}>Focus</button></div>;
  return <div className="map-understanding-review"><div className="map-review-summary"><span>Elements <strong>{elements.length}</strong></span><span>Confirmed <strong>{confirmed.length}</strong></span><span>Needs Review <strong>{unconfirmed.length}</strong></span></div><section className="map-review-group"><h3>Confirmed</h3>{confirmed.length ? confirmed.map((asset) => row(asset, "confirmed")) : <p>No confirmed element decisions yet.</p>}</section><section className="map-review-group"><h3>Needs Review</h3>{unconfirmed.length ? unconfirmed.map((asset) => row(asset, "unconfirmed")) : <p>Every element has been confirmed.</p>}</section>{project.mapUnderstandingLocked ? <><div className="confirmed-copy">Whole map understanding confirmed</div><button className="text-action" onClick={unlockMapUnderstanding}>Reopen map understanding</button></> : <button className="primary" disabled={!elements.length} onClick={confirmMapUnderstanding}>{allConfirmed ? "Confirm Whole Map Understanding" : "Proceed with Remaining Warnings"}</button>}<button className="text-action" disabled={!elements.length} onClick={exportUnderstanding}>Export Map Understanding JSON</button></div>;
}

export function GameplayLogicPanel() {
  const {
    project,
    generationContract,
    validateGameplay,
    generateGameplayRepairs,
    applyGameplayRepair,
    setSpatialConstraintMode,
  } = useWorldloomStore();

  const sharedState = project.sharedLevelDesignState;
  const graph = sharedState.gameplay.graph;
  const validation = sharedState.gameplay.validation ?? null;
  const repairs = sharedState.gameplay.repairs ?? [];
  const spatialConstraints = sharedState.spatial.constraints.filter(
    (constraint) => constraint.enabled,
  );
  const contract = generationContract ?? project.generationContract ?? null;

  const nodeCount = (type: string) =>
    graph.nodes.filter((node) => node.type === type).length;

  const constraintCount = (mode: "exact" | "approximate" | "free") =>
    spatialConstraints.filter((constraint) => constraint.mode === mode).length;

  const unresolvedRepairs = repairs.filter(
    (repair) => repair.status === "proposed",
  );

  return (
    <div className="gameplay-logic-panel">
      <section className="gameplay-flow">
        <strong>Gameplay Graph</strong>

        <div className="gameplay-node">
          <span>Nodes</span>
          <small>{graph.nodes.length}</small>
        </div>

        <div className="gameplay-node">
          <span>Relations</span>
          <small>{graph.relations.length}</small>
        </div>

        <div className="gameplay-node">
          <span>Routes</span>
          <small>{graph.routes.length}</small>
        </div>

        <div className="gameplay-node">
          <span>Start / Goal</span>
          <small>
            {nodeCount("start")} / {nodeCount("goal")}
          </small>
        </div>

        <div className="gameplay-node">
          <span>Encounter / Reward</span>
          <small>
            {nodeCount("encounter")} / {nodeCount("reward")}
          </small>
        </div>

        <div className="gameplay-node">
          <span>Gate / Branch</span>
          <small>
            {nodeCount("gate")} / {nodeCount("branch")}
          </small>
        </div>

        {graph.nodes.length === 0 && (
          <p>No Gameplay Graph nodes have been committed yet.</p>
        )}

        {graph.nodes.slice(0, 8).map((node) => (
          <div className="gameplay-relation" key={node.id}>
            <span>{node.label}</span>
            <small>
              {node.type.replaceAll("_", " ")} · {node.requirement}
            </small>
          </div>
        ))}
      </section>

      <section className="gameplay-relations">
        <strong>Spatial Constraints</strong>

        <div className="gameplay-node">
          <span>Exact</span>
          <small>{constraintCount("exact")}</small>
        </div>

        <div className="gameplay-node">
          <span>Approximate</span>
          <small>{constraintCount("approximate")}</small>
        </div>

        <div className="gameplay-node">
          <span>Free</span>
          <small>{constraintCount("free")}</small>
        </div>

        {spatialConstraints.length === 0 && (
          <p>No explicit spatial constraints yet.</p>
        )}

        {spatialConstraints.slice(0, 8).map((constraint) => (
          <div key={constraint.id}>
            <span>
              {constraint.property.replaceAll("_", " ")}
            </span>
            <small>
              {constraint.mode}
              {constraint.mode === "approximate" &&
              constraint.tolerance !== undefined
                ? ` · tolerance ${
                    typeof constraint.tolerance === "number"
                      ? constraint.tolerance
                      : "custom"
                  }`
                : ""}
            </small>

            <select
              value={constraint.mode}
              onChange={(event) =>
                setSpatialConstraintMode(
                  constraint.id,
                  event.target.value as "exact" | "approximate" | "free",
                )
              }
            >
              <option value="exact">Exact</option>
              <option value="approximate">Approximate</option>
              <option value="free">Free</option>
            </select>
          </div>
        ))}
      </section>

      <section className="gameplay-relations">
        <strong>Validation</strong>

        {!validation ? (
          <p>Gameplay Graph has not been validated yet.</p>
        ) : validation.valid ? (
          <div className="confirmed-copy">
            Gameplay Graph valid · {validation.reachableNodeIds.length} reachable
            nodes
          </div>
        ) : (
          <>
            <p>
              {validation.conflicts.length} gameplay issue
              {validation.conflicts.length === 1 ? "" : "s"} detected.
            </p>

            {validation.conflicts.map((conflict) => (
              <div key={conflict.id}>
                <span>
                  {conflict.severity.toUpperCase()} ·{" "}
                  {conflict.type.replaceAll("_", " ")}
                </span>
                <small>{conflict.message}</small>
              </div>
            ))}
          </>
        )}

        <button type="button" onClick={validateGameplay}>
          Validate Gameplay Graph
        </button>

        {validation && !validation.valid && (
          <button type="button" onClick={generateGameplayRepairs}>
            Refresh Repair Suggestions
          </button>
        )}
      </section>

      <section className="gameplay-relations">
        <strong>Repair</strong>

        {unresolvedRepairs.length === 0 ? (
          <p>
            {validation?.valid
              ? "No repair is required."
              : "No pending repair suggestion."}
          </p>
        ) : (
          unresolvedRepairs.map((repair) => (
            <div key={repair.id}>
              <span>{repair.label}</span>
              <small>{repair.description}</small>
              <button
                type="button"
                className="text-action"
                onClick={() => applyGameplayRepair(repair.id)}
              >
                Apply Repair
              </button>
            </div>
          ))
        )}
      </section>

      <section className="gameplay-relations">
        <strong>Generation Contract</strong>

        {!contract ? (
          <p>Contract has not been compiled yet.</p>
        ) : (
          <>
            <div className="gameplay-node">
              <span>Status</span>
              <small>{contract.status}</small>
            </div>

            <div className="gameplay-node">
              <span>Scene elements</span>
              <small>{contract.scene.elements.length}</small>
            </div>

            <div className="gameplay-node">
              <span>Gameplay nodes</span>
              <small>{contract.gameplay.nodes.length}</small>
            </div>

            <div className="gameplay-node">
              <span>Contract issues</span>
              <small>{contract.issues.length}</small>
            </div>

            <div className="gameplay-node">
              <span>Regeneration</span>
              <small>{contract.regeneration.mode}</small>
            </div>

            {contract.issues.map((issue) => (
              <div key={issue.id}>
                <span>
                  {issue.severity.toUpperCase()} · {issue.layer}
                </span>
                <small>{issue.message}</small>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}

export function LocalNotes() {
  const { project, selectSketchIds, interpretTogether, moveSemanticItem, hideSemanticItem, deleteSemanticItem, reassignSemanticItem, convertSemanticItem } = useWorldloomStore();
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
    const initiallyOpen=["question","reading","constraint"].includes(n.kind);
    const provenance = n.source === "auto_detected" ? "AI detected" : n.source === "user_created" ? "User added" : n.source === "demo" ? "Demo" : "AI generated";
    return <div className={`local-note-anchor semantic-item ${n.kind}`} key={n.id} data-source={n.source} style={{left:`${visual.x/project.metadata.canvasWidth*100}%`,top:`${visual.y/project.metadata.canvasHeight*100}%`,margin:0}} onContextMenu={(event)=>{event.preventDefault();event.stopPropagation();setContextMenu({id:n.id,x:event.nativeEvent.offsetX,y:event.nativeEvent.offsetY,surface:(event.target as HTMLElement).closest(".semantic-marker") ? "marker" : "card"});}}>
      <svg className="note-tether" style={{overflow:"visible"}} width="1" height="1" aria-hidden="true"><path d={`M0 0 L${asset.position.x-visual.x} ${asset.position.y-visual.y}`} fill="none" stroke="var(--note)" strokeWidth="1"/></svg>
      <div className="note-position" onPointerDown={(event)=>{if((event.target as HTMLElement).closest("button"))return;dragRef.current={id:n.id,startX:event.clientX,startY:event.clientY,originX:visual.x,originY:visual.y};event.currentTarget.setPointerCapture(event.pointerId);}} onPointerUp={(event)=>{const drag=dragRef.current;if(!drag||drag.id!==n.id)return;const rect=event.currentTarget.closest(".board-viewport")?.getBoundingClientRect();if(rect){const x=drag.originX+(event.clientX-drag.startX)/rect.width*project.metadata.canvasWidth;const y=drag.originY+(event.clientY-drag.startY)/rect.height*project.metadata.canvasHeight;moveSemanticItem(n.id,{x,y},event.target instanceof HTMLElement && event.target.closest(".semantic-marker") ? "marker" : "card");}dragRef.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} style={{transform:"none"}}>
        <button className="semantic-marker" aria-label={`Open ${titles[n.kind]}`} onClick={()=>{setClosed(c=>c.filter(id=>id!==n.id));setMobileOpen(n.id);selectSketchIds([asset.id]);if(!h?.assetRoles.some(role=>role.assetInstanceId===asset.id)) interpretTogether();}}>{n.kind==="uncertainty"?"?":n.kind==="constraint"?"✓":"!"}</button>
        {!closed.includes(n.id) && (initiallyOpen && !compact || mobileOpen===n.id) && <section className="local-note"><header><strong>{titles[n.kind]}</strong><button aria-label={`Close ${titles[n.kind]}`} onClick={()=>{setClosed(c=>[...c,n.id]);setMobileOpen(null);}}>×</button></header><small className="semantic-provenance">{provenance}</small><p>{n.text}</p><button className="note-answer" onClick={()=>{selectSketchIds([asset.id]);if(!h?.assetRoles.some(role=>role.assetInstanceId===asset.id)) interpretTogether();}}>Open Selected Element</button></section>}
      </div>
      {contextMenu?.id===n.id && <div className="semantic-context-menu" style={{left:contextMenu.x,top:contextMenu.y}} onPointerDown={event=>event.stopPropagation()}>{contextMenu.surface === "marker" ? <><button onClick={()=>{selectSketchIds([asset.id]);setContextMenu(null);}}>Open Selected Element</button><button onClick={()=>{selectSketchIds([asset.id]);interpretTogether();setContextMenu(null);}}>Re-run interpretation</button><button onClick={()=>{reassignSemanticItem(n.id,project.sketchSelection.ids.find(id=>project.sketchState.assetInstances.some(a=>a.id===id)) ?? asset.id);setContextMenu(null);}}>Reassign target</button><button onClick={()=>{convertSemanticItem(n.id,n.kind === "question" ? "uncertainty" : "question");setContextMenu(null);}}>Convert marker type</button><button onClick={()=>{hideSemanticItem(n.id);setContextMenu(null);}}>Hide</button><button className="danger-action" onClick={()=>{deleteSemanticItem(n.id);setContextMenu(null);}}>Delete marker</button></> : <><button onClick={()=>{selectSketchIds([asset.id]);setContextMenu(null);}}>Open Selected Element</button><button onClick={()=>{selectSketchIds([asset.id]);interpretTogether();setContextMenu(null);}}>Re-run interpretation</button><button onClick={()=>{convertSemanticItem(n.id,"constraint");setContextMenu(null);}}>Convert to note</button><button onClick={()=>{setClosed(c=>[...c,n.id]);setContextMenu(null);}}>Collapse</button><button onClick={()=>{hideSemanticItem(n.id);setContextMenu(null);}}>Hide</button><button onClick={()=>{reassignSemanticItem(n.id,project.sketchSelection.ids.find(id=>project.sketchState.assetInstances.some(a=>a.id===id)) ?? asset.id);setContextMenu(null);}}>Reassign target</button><button className="danger-action" onClick={()=>{deleteSemanticItem(n.id);setContextMenu(null);}}>Delete card</button></>}</div>}
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
