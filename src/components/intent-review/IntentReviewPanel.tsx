import type { IntentEffects } from "../../core/intent/types";
import type { GameplayConstraint } from "../../core/types";
import { assetById } from "../../assets/mockAssetLibrary";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import { InterpretationComparison } from "../research/InterpretationComparison";

const effectLabels: Record<keyof IntentEffects, string> = {
  encounterIntensity: "Combat",
  spatialOpenness: "Openness",
  visibility: "Visibility",
  resourceDensity: "Resources",
  recovery: "Recovery",
  branching: "Branching",
};

const targetLabel: Record<GameplayConstraint["target"], string> = {
  main_path: "Main path",
  encounter_intensity: "Combat",
  spatial_openness: "Openness",
  resource_density: "Resources",
  visibility: "Visibility",
  branching: "Branching",
  recovery: "Recovery",
};

function glyph(value: number): string {
  if (value > 0.66) return "up up up";
  if (value > 0.25) return "up up";
  if (value > 0.05) return "up";
  if (value < -0.66) return "down down down";
  if (value < -0.25) return "down down";
  if (value < -0.05) return "down";
  return "steady";
}

function EffectList({ effects }: { effects: IntentEffects }) {
  const entries = Object.entries(effects) as Array<[keyof IntentEffects, number]>;
  return <div className="effect-list">{entries.map(([key, value]) => <span key={key}><b>{effectLabels[key]}</b><em>{glyph(value)}</em><small>{value.toFixed(2)}</small></span>)}</div>;
}

export function IntentReviewPanel() {
  const { project, updateConstraint, resetConstraint, select, generate, selectInterpretationAlternative, answerClarificationRequest, commitCandidate, confirmCandidateConvention, rejectCandidateConvention, answerCompositionClarification, commitComposition, generateAssetPlan, applyAssetPlan, rejectAssetPlan, confirmCandidateConvention: confirmConvention } = useWorldloomStore();
  const isV4 = project.researchMode === "c1-ai-opaque" || project.researchMode === "c2-ai-negotiable" || project.researchMode === "c3-ai-negotiable-conventions";
  if (isV4) {
    const hypothesis = project.compositionHypothesis;
    if (!hypothesis) return <section className="intent-review"><div className="panel-head"><h3>Grounding Inspector</h3><span>No composition yet</span></div><p>Select assets, marks, and relations, then Interpret Together.</p></section>;
    const opaque = project.researchMode === "c1-ai-opaque";
    return <section className="intent-review">
      <div className="panel-head"><h3>Grounding Inspector</h3><span>{project.researchMode}</span></div>
      {opaque ? <article className="intent-card"><strong>AI Opaque Condition</strong><p>Worldloom has grounded the asset composition. Interpretation details are hidden before edit-plan preview.</p></article> : <>
        <article className="intent-card"><div className="intent-title"><strong>What Worldloom Thinks This Composition Means</strong><span>{Math.round(hypothesis.confidence * 100)}%</span></div><p>{hypothesis.summary}</p><div className="effect-list">{hypothesis.experientialGoals.map((goal) => <span key={goal}>{goal}</span>)}</div></article>
        <article className="intent-card"><strong>Asset Roles</strong>{hypothesis.assetRoles.map((role) => {
          const asset = project.sketchState.assetInstances.find((item) => item.id === role.assetInstanceId);
          return <p key={role.assetInstanceId}>{assetById(asset?.assetDefinitionId ?? "")?.name ?? role.assetInstanceId} {"->"} {role.proposedRole} ({Math.round(role.confidence * 100)}%)</p>;
        })}</article>
        {hypothesis.clarificationRequests.length > 0 && <article className="intent-card"><div className="intent-title"><strong>Clarify Composition</strong><span>{hypothesis.clarificationRequests.length} question(s)</span></div>{hypothesis.clarificationRequests.map((request) => <div className="clarification-card" key={request.id}><p>{request.question}</p><div className="button-row">{request.options?.map((option) => <button key={option.id} onClick={() => answerCompositionClarification(request.id, option.id)}>{option.label}</button>)}{request.allowFreeText && <button onClick={() => answerCompositionClarification(request.id, undefined, "Clarified composition")}>Answer</button>}</div></div>)}</article>}
        {hypothesis.conventionMatchedId && <article className="convention-card"><p>This resembles a confirmed convention. Use the same composition meaning?</p><button onClick={() => confirmConvention("project")}>Use Convention</button></article>}
      </>}
      {project.committedCompositionIntent && <article className="intent-card committed"><strong>Committed Composition Intent</strong>{Object.entries(project.committedCompositionIntent.assignedRoles).map(([assetId, role]) => <p key={assetId}>{assetId} = {role}</p>)}</article>}
      {project.assetEditPlan && <article className="intent-card"><div className="intent-title"><strong>Worldloom Proposes</strong><span>{project.assetEditPlan.status}</span></div>{project.assetEditPlan.previewSummary.map((line) => <p key={line}>{line}</p>)}<div className="button-row"><button className="primary" disabled={project.assetEditPlan.status !== "preview"} onClick={applyAssetPlan}>Apply</button><button onClick={rejectAssetPlan}>Reject</button><button onClick={generateAssetPlan}>Edit Plan</button></div></article>}
      <div className="button-row"><button className="primary" disabled={!hypothesis || hypothesis.status === "committed"} onClick={commitComposition}>Commit Composition</button><button className="primary" disabled={!project.committedCompositionIntent} onClick={generateAssetPlan}>Generate Edit Plan</button></div>
    </section>;
  }
  const result = project.candidateIntent ?? project.lastInterpretationResult;
  const adjusted = project.constraints.filter((constraint) => constraint.userAdjusted).length;

  if (!result) {
    return <section className="intent-review"><div className="panel-head"><h3>What Worldloom Understood</h3><span>No interpretation yet</span></div><p>Compile Intent to inspect structured meaning before generating variants.</p></section>;
  }

  if (project.researchMode === "c2-ai-opaque") {
    return <section className="intent-review">
      <div className="panel-head"><h3>AI Opaque Condition</h3><span>Interpretation hidden</span></div>
      <p>Worldloom has interpreted the sketch with the AI-assisted interpreter. This condition hides semantics, confidence, alternatives, and clarification before realization.</p>
      <button className="primary wide" disabled={project.constraints.length === 0} onClick={generate}>Generate Variants</button>
    </section>;
  }

  return <section className="intent-review">
    <div className="panel-head"><h3>What You Drew</h3><span>{project.sketchState.marks.length} marks / {project.sketchState.objects.length} objects / {project.sketchState.relations.length} relations</span></div>
    <div className="sketch-summary"><span>Selection: {project.sketchSelection.ids.join(", ") || "whole sketch"}</span><span>Groups: {project.sketchState.groups.length}</span></div>
    <div className="panel-head"><h3>What Worldloom Thinks It Means</h3><span>{result.mode === "ai" ? "AI-Assisted" : "Rule-Based"} / {adjusted} adjusted</span></div>
    {project.textInstruction && <p className="instruction-note">Clarification: {project.textInstruction}</p>}
    {result.interpretations.map((interpretation) => {
      const constraints = project.constraints.filter((constraint) => constraint.sourceInterpretationIds?.includes(interpretation.id) || constraint.sourceStrokeIds.some((id) => interpretation.sourceStrokeIds.includes(id)));
      return <article className="intent-card" key={interpretation.id}>
        <div className="intent-title"><strong>{interpretation.sourceStrokeIds.join(", ")} / Interpretation</strong><span>{Math.round(interpretation.confidence * 100)}%</span></div>
        <p>{interpretation.semanticSummary}</p>
        {interpretation.conflict && <p className="warning-text">Conflict detected: {interpretation.conflict}</p>}
        <EffectList effects={interpretation.effects} />
        {project.researchMode === "c3-ai-negotiable" && interpretation.alternatives.length > 0 && <div className="alternatives"><strong>Alternative Interpretations</strong>{interpretation.alternatives.map((alternative) => <button key={alternative.id} onClick={() => selectInterpretationAlternative(interpretation.id, alternative.id)}><span>{alternative.label}</span><small>{alternative.semanticSummary}</small></button>)}</div>}
        <div className="constraint-list">{constraints.map((constraint) => <div className="constraint-mini" key={constraint.id}>
          <button onClick={() => select({ kind: "constraint", id: constraint.id })}>{targetLabel[constraint.target]}</button>
          <label>Weight <input type="range" min="0" max="1" step="0.05" value={constraint.weight} onChange={(event) => updateConstraint(constraint.id, { weight: Number(event.target.value) })} /></label>
          <label>Value <input type="range" min="0" max="1" step="0.05" value={constraint.preferredValue} onChange={(event) => updateConstraint(constraint.id, { preferredValue: Number(event.target.value) })} /></label>
          <label className="inline"><input type="checkbox" checked={constraint.hard} onChange={(event) => updateConstraint(constraint.id, { hard: event.target.checked })} /> Hard</label>
          <label className="inline"><input type="checkbox" checked={constraint.enabled} onChange={(event) => updateConstraint(constraint.id, { enabled: event.target.checked })} /> Enabled</label>
          <button onClick={() => resetConstraint(constraint.id)}>Reset</button>
        </div>)}</div>
      </article>;
    })}
    {project.candidateIntent && project.researchMode === "c3-ai-negotiable" && <article className="intent-card">
      <div className="intent-title"><strong>What Worldloom Is Unsure About</strong><span>{project.candidateIntent.clarificationRequests.length} question(s)</span></div>
      {project.candidateIntent.clarificationRequests.length === 0 && <p>No clarification needed under the current policy.</p>}
      {project.candidateIntent.clarificationRequests.map((request) => <div className="clarification-card" key={request.id}>
        <p>{request.question}</p>
        <div className="button-row">{request.options?.map((option) => <button key={option.id} onClick={() => answerClarificationRequest(request.id, option.id)}>{option.label}</button>)}{request.allowFreeText && <button onClick={() => answerClarificationRequest(request.id, undefined, "No - it is a recovery pocket.")}>Correct as recovery</button>}</div>
      </div>)}
      {project.candidateIntent.candidateConvention && <div className="convention-card">
        <p>{project.candidateIntent.candidateConvention.matchedConventionId ? `You previously used this pattern for ${project.candidateIntent.candidateConvention.humanReadableLabel}. Use the same meaning?` : `Remember this expression as ${project.candidateIntent.candidateConvention.humanReadableLabel}?`}</p>
        <div className="button-row"><button onClick={() => confirmCandidateConvention("project")}>Remember for project</button><button onClick={() => confirmCandidateConvention("session")}>Only this time</button><button onClick={rejectCandidateConvention}>No</button></div>
      </div>}
    </article>}
    {project.committedIntent && <article className="intent-card committed"><div className="intent-title"><strong>What You Have Agreed It Means</strong><span>Committed Intent</span></div><p>{project.committedIntent.authoringIntent.intents.length} Authoring IR fragment(s) ready for deterministic realization.</p></article>}
    <div className="button-row">{project.researchMode === "c3-ai-negotiable" ? <><button className="primary" disabled={!project.candidateIntent || project.candidateIntent.status === "committed"} onClick={commitCandidate}>Commit Intent</button><button className="primary" disabled={project.constraints.length === 0} onClick={generate}>Realize Committed Intent</button></> : <button className="primary" disabled={project.constraints.length === 0} onClick={generate}>Accept / Generate Variants</button>}</div>
    <InterpretationComparison />
  </section>;
}
