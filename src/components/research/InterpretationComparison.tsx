import type { IntentInterpretationResult, IntentEffects } from "../../core/intent/types";
import { useWorldloomStore } from "../../store/useWorldloomStore";

const keys: Array<keyof IntentEffects> = ["spatialOpenness", "encounterIntensity", "visibility", "resourceDensity", "recovery", "branching"];

function valueFor(result: IntentInterpretationResult, key: keyof IntentEffects): string {
  const values = result.interpretations.map((interpretation) => interpretation.effects[key]).filter((value): value is number => typeof value === "number");
  if (values.length === 0) return "-";
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2);
}

function summaryFor(result: IntentInterpretationResult): string {
  return result.interpretations.map((interpretation) => interpretation.semanticSummary).join(" / ");
}

export function InterpretationComparison() {
  const { project, comparisonResult, runInterpretationComparison } = useWorldloomStore();
  return <section className="comparison interpretation-comparison">
    <div className="panel-head"><h3>Compare Interpretations</h3><button disabled={project.strokes.length === 0} onClick={runInterpretationComparison}>Run Comparison</button></div>
    {!comparisonResult && <p>Run both interpreters on the same strokes, text clarification, and seed.</p>}
    {comparisonResult && <>
      <table>
        <tbody>
          <tr><th>semantic summary</th><td>{summaryFor(comparisonResult.ruleBased)}</td><td>{summaryFor(comparisonResult.ai)}</td></tr>
          <tr><th>source</th><td>Rule-Based</td><td>AI-Assisted Mock</td></tr>
          <tr><th>confidence</th><td>{comparisonResult.ruleBased.metadata.confidence?.toFixed(2) ?? "-"}</td><td>{comparisonResult.ai.metadata.confidence?.toFixed(2) ?? "-"}</td></tr>
          {keys.map((key) => <tr key={key}><th>{key}</th><td>{valueFor(comparisonResult.ruleBased, key)}</td><td>{valueFor(comparisonResult.ai, key)}</td></tr>)}
        </tbody>
      </table>
      <p><strong>Interpretation Difference</strong> Differences here are experimental observations, not a claim that one condition is better.</p>
    </>}
  </section>;
}
