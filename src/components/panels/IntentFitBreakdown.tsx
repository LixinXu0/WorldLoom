import type { IntentFitBreakdown as Breakdown } from "../../core/types";

export function IntentFitBreakdown({ breakdown }: { breakdown: Breakdown }) {
  return <div className="fit-grid"><span>Flow {breakdown.flow}</span><span>Pressure {breakdown.pressure}</span><span>Relief {breakdown.relief}</span><span>Branch {breakdown.branch}</span></div>;
}
