import { useState } from "react";
import { assetById } from "../../assets/mockAssetLibrary";
import type { SketchRelationType } from "../../core/sketch/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";

const relationTypes: SketchRelationType[] = ["related_to", "connects", "leads_to", "contains", "guards", "gates", "supports", "overlooks"];

export function SketchSandboxPanel() {
  const {
    project,
    activeTool,
    setTool,
    addSketchMark,
    addSketchRelation,
    deleteSketchRelation,
    selectSketchIds,
    groupSelectedSketch,
    ungroupSelectedSketch,
    interpretTogether,
    moveAssetInstance,
    rotateAssetInstance,
    toggleAssetLock,
    duplicateAssetInstance,
    deleteAssetInstance,
  } = useWorldloomStore();
  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [relationType, setRelationType] = useState<SketchRelationType>("related_to");
  const assets = project.sketchState.assetInstances.map((asset) => ({ id: asset.id, label: assetById(asset.assetDefinitionId)?.name ?? asset.assetDefinitionId }));
  const rawStrokes = project.sketchState.rawStrokes.filter((stroke) => !stroke.deleted).map((stroke) => ({ id: stroke.id, label: project.sketchState.gestureCandidates.find((gesture) => gesture.strokeIds.includes(stroke.id))?.kind ?? "raw stroke" }));
  const marks = project.sketchState.marks.map((mark) => ({ id: mark.id, label: mark.kind }));
  const elements = [...assets, ...rawStrokes, ...marks];
  const selectedAsset = project.sketchState.assetInstances.find((asset) => project.sketchSelection.ids.includes(asset.id));

  return <section className="sketch-panel">
    <h3>Sketch Sandbox</h3>
    <div className="button-row"><button className={activeTool === "select" ? "active" : ""} onClick={() => setTool("select")}>Select</button><button className={activeTool === "pen" ? "active" : ""} onClick={() => setTool("pen")}>Pen</button><button className={activeTool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")}>Erase</button><button className={activeTool === "annotation" ? "active" : ""} onClick={() => setTool("annotation")}>Text</button></div>
    <div className="button-row"><button disabled={project.sketchSelection.ids.length < 2} onClick={groupSelectedSketch}>Group</button><button disabled={!project.sketchSelection.ids.some((id) => project.sketchState.groups.some((group) => group.id === id))} onClick={ungroupSelectedSketch}>Ungroup</button><button className="primary" disabled={project.sketchSelection.ids.length === 0 && project.sketchState.assetInstances.length === 0 && project.sketchState.rawStrokes.filter((stroke) => !stroke.deleted).length === 0} onClick={interpretTogether}>Interpret Together</button></div>
    <h4>Smart Tools</h4>
    <div className="button-row"><button onClick={() => addSketchMark("path")}>Path</button><button onClick={() => addSketchMark("loop")}>Loop</button><button onClick={() => addSketchMark("arrow")}>Arrow</button><button onClick={() => addSketchMark("boundary")}>Boundary</button></div>
    <div className="relation-builder">
      <select aria-label="Relation source" value={sourceId} onChange={(event) => setSourceId(event.target.value)}><option value="">source</option>{elements.map((element) => <option key={element.id} value={element.id}>{element.label} / {element.id}</option>)}</select>
      <select aria-label="Relation target" value={targetId} onChange={(event) => setTargetId(event.target.value)}><option value="">target</option>{elements.map((element) => <option key={element.id} value={element.id}>{element.label} / {element.id}</option>)}</select>
      <select aria-label="Relation type" value={relationType} onChange={(event) => setRelationType(event.target.value as SketchRelationType)}>{relationTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
      <button onClick={() => addSketchRelation(sourceId, targetId, relationType)}>Connector</button>
    </div>
    <div className="sketch-list">
      {elements.map((item) => <button key={item.id} className={project.sketchSelection.ids.includes(item.id) ? "active" : ""} onClick={(event) => selectSketchIds(event.shiftKey ? Array.from(new Set([...project.sketchSelection.ids, item.id])) : [item.id])}><span>{item.label}</span><small>{item.id}</small></button>)}
      {project.sketchState.groups.map((group) => <button key={group.id} className={project.sketchSelection.ids.includes(group.id) ? "active" : ""} onClick={() => selectSketchIds([group.id])}><span>{group.label ?? "Group"}</span><small>{group.memberIds.length} members</small></button>)}
    </div>
    {selectedAsset && <div className="object-move">
      <span>{assetById(selectedAsset.assetDefinitionId)?.name ?? selectedAsset.assetDefinitionId}</span>
      <button onClick={() => moveAssetInstance(selectedAsset.id, -16, 0)}>Left</button>
      <button onClick={() => moveAssetInstance(selectedAsset.id, 16, 0)}>Right</button>
      <button onClick={() => moveAssetInstance(selectedAsset.id, 0, -16)}>Up</button>
      <button onClick={() => moveAssetInstance(selectedAsset.id, 0, 16)}>Down</button>
      <button onClick={() => rotateAssetInstance(selectedAsset.id, 15)}>Rotate</button>
      <button onClick={() => toggleAssetLock(selectedAsset.id)}>{selectedAsset.locked ? "Unlock" : "Lock / Preserve"}</button>
      <button disabled={selectedAsset.doNotDuplicate} onClick={() => duplicateAssetInstance(selectedAsset.id)}>Duplicate</button>
      <button disabled={selectedAsset.locked} onClick={() => deleteAssetInstance(selectedAsset.id)}>Delete</button>
    </div>}
    {project.sketchState.relations.map((relation) => <div className="relation-row" key={relation.id}><span>{relation.sourceId} {"->"} {relation.targetId} / {relation.relationType}</span><button onClick={() => deleteSketchRelation(relation.id)}>Delete</button></div>)}
  </section>;
}
