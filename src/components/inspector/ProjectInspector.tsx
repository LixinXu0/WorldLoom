import { calculateIntendedTimeline } from "../../core/timeline/calculateIntendedTimeline";
import { calculatePlayedTimeline } from "../../core/timeline/calculatePlayedTimeline";
import { calculateRealizedTimeline } from "../../core/timeline/calculateRealizedTimeline";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import { ConflictPanel } from "../panels/ConflictPanel";
import { IntentFitBreakdown } from "../panels/IntentFitBreakdown";
import { ExperienceTimeline } from "../timeline/ExperienceTimeline";

export function ProjectInspector() {
  const { project, importError, researchLog, getResearchMetrics, startRepair } = useWorldloomStore();
  const activeVariant = project.variants.find((variant) => variant.id === (project.workingVariantId ?? project.activeVariantId)) ?? project.variants[0];
  const metrics = getResearchMetrics();
  const isV4 = project.researchMode === "c1-ai-opaque" || project.researchMode === "c2-ai-negotiable" || project.researchMode === "c3-ai-negotiable-conventions";

  return <section>
    <h3>Project Overview</h3>
    {importError && <p className="error-text">{importError}</p>}
    <dl>
      <dt>research mode</dt><dd>{project.researchMode}</dd>
      <dt>assets</dt><dd>{project.sketchState.assetInstances.length}</dd>
      <dt>raw strokes</dt><dd>{project.sketchState.rawStrokes.filter((stroke) => !stroke.deleted).length}</dd>
      <dt>gestures</dt><dd>{project.sketchState.gestureCandidates.length}</dd>
      <dt>episodes</dt><dd>{project.sketchState.episodes.length}</dd>
      <dt>marks</dt><dd>{project.sketchState.marks.length}</dd>
      <dt>relations</dt><dd>{project.sketchState.relations.length}</dd>
      <dt>utterances</dt><dd>{project.sketchState.utterances.length}</dd>
      <dt>hypothesis</dt><dd>{project.compositionHypothesis?.status ?? "none"}</dd>
      <dt>composition</dt><dd>{project.committedCompositionIntent ? "committed" : "none"}</dd>
      <dt>edit plan</dt><dd>{project.assetEditPlan?.status ?? "none"}</dd>
      <dt>conventions</dt><dd>{project.conventions.length}</dd>
      <dt>legacy strokes</dt><dd>{project.strokes.length}</dd>
      <dt>legacy variants</dt><dd>{project.variants.length}</dd>
      <dt>research events</dt><dd>{researchLog.length}</dd>
      <dt>reuse rate</dt><dd>{metrics.convention_reuse_rate}</dd>
      <dt>clarifications</dt><dd>{metrics.clarifications_per_task}</dd>
    </dl>
    <div className="repair-panel">
      <h4>What is wrong?</h4>
      <button onClick={() => startRepair("expression")}>My sketch / grouping was wrong</button>
      <button onClick={() => startRepair("interpretation")}>Worldloom misunderstood the composition</button>
      <button onClick={() => startRepair("role_assignment")}>Asset roles were assigned incorrectly</button>
      <button onClick={() => startRepair("realization")}>The arrangement / edit plan was poor</button>
      <button onClick={() => startRepair("propagation")}>The change affected the wrong scope</button>
    </div>
    {isV4 && project.sketchState.assetInstances.length === 0 && project.sketchState.rawStrokes.filter((stroke) => !stroke.deleted).length === 0 && <div className="empty-guide"><strong>Pen is ready.</strong><p>Draw freely first; Worldloom can interpret raw strokes with nearby assets later.</p></div>}
    {!isV4 && project.strokes.length === 0 && project.sketchState.marks.length === 0 && <div className="empty-guide"><strong>Legacy mode starts from semantic brushes.</strong><p>Use Flow, Pressure, Relief, and Branch tools, or load the legacy example.</p></div>}
    {!isV4 && project.constraints.length > 0 && <ExperienceTimeline title="Intended" points={calculateIntendedTimeline(project.strokes, project.constraints)} />}
    {!isV4 && activeVariant && <><h4>{activeVariant.name}</h4><IntentFitBreakdown breakdown={activeVariant.intentFitBreakdown} /><p>{activeVariant.validation.reachable ? "Entrance reaches exit." : "Invalid route."} Critical path length: {activeVariant.validation.criticalPathLength}</p><ExperienceTimeline title="Realized" points={calculateRealizedTimeline(activeVariant)} />{project.playtestEvents.some((event) => event.variantId === activeVariant.id) && <ExperienceTimeline title="Played" points={calculatePlayedTimeline(activeVariant, project.playtestEvents, project.experienceFeedback)} />}{activeVariant.validation.warnings.map((warning) => <p className="warning-text" key={warning}>{warning}</p>)}</>}
    <ConflictPanel />
  </section>;
}
