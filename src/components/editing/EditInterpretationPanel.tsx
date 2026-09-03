import type { EditScope } from "../../core/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";

const scopes: Array<{ id: EditScope; label: string; note: string }> = [
  { id: "instance", label: "This Instance", note: "Only this room changes; constraints and other variants stay untouched." },
  { id: "variant-rule", label: "This Variant Rule", note: "Propagate to similar rooms in the current strategy." },
  { id: "source-intent", label: "Source Intent", note: "Update source constraints and affected variants." },
  { id: "all-variants", label: "All Variants", note: "Apply a global preference across strategies." },
];

export function EditInterpretationPanel() {
  const { draftRoomEdit, pendingEditScope, selectedEditInterpretation, impactPreview, updateDraftScope, selectInterpretation, applyDraftEdit, cancelDraftEdit } = useWorldloomStore();
  if (!draftRoomEdit) return null;
  return <section className="edit-panel"><h3>Change Scope</h3><p>How should Worldloom interpret this edit?</p><div className="interpretations">{draftRoomEdit.inferredMeaning.map((item) => <button key={item.id} className={selectedEditInterpretation === item.id ? "active" : ""} onClick={() => selectInterpretation(item.id)}><strong>{item.label}</strong><span>{item.description}</span><small>confidence {Math.round(item.confidence * 100)}% / recommends {item.recommendedScope}</small></button>)}</div><div className="scope-grid">{scopes.map((scope) => <button key={scope.id} className={pendingEditScope === scope.id ? "active" : ""} onClick={() => updateDraftScope(scope.id)}><strong>{scope.label}</strong><span>{scope.note}</span></button>)}</div>{impactPreview && <div className="impact-box"><h4>Impact Preview</h4><p>{impactPreview.summary}</p><dl><dt>variants</dt><dd>{impactPreview.affectedVariantIds.join(", ") || "none"}</dd><dt>rooms</dt><dd>{impactPreview.affectedRoomIds.join(", ") || "none"}</dd><dt>edges</dt><dd>{impactPreview.affectedEdgeIds.join(", ") || "none"}</dd><dt>constraints</dt><dd>{impactPreview.affectedConstraintIds.join(", ") || "none"}</dd><dt>regen</dt><dd>{impactPreview.willRegenerate ? "local repair" : "no"}</dd><dt>fit delta</dt><dd>{impactPreview.estimatedIntentFitDelta >= 0 ? "+" : ""}{impactPreview.estimatedIntentFitDelta}</dd></dl>{impactPreview.validationRisks.map((risk) => <p className="warning-text" key={risk}>{risk}</p>)}</div>}<div className="button-row"><button className="primary" onClick={applyDraftEdit}>Apply</button><button onClick={cancelDraftEdit}>Revert Draft</button></div></section>;
}