import type { GameplayConstraint, Stroke } from "../types";
import { interpretRuleBasedSync } from "../intent/ruleBasedInterpreter";

export function compileConstraints(strokes: Stroke[]): GameplayConstraint[] {
  return interpretRuleBasedSync({ strokes }).derivedConstraints;
}
