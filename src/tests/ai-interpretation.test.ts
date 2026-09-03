import { describe, expect, it } from "vitest";
import type { Stroke } from "../core/types";
import { interpretRuleBasedSync } from "../core/intent/ruleBasedInterpreter";
import { interpretMockAISync } from "../ai/mockAIInterpreter";
import { calculateResearchMetrics } from "../research/metrics";
import { createResearchEvent } from "../research/interactionLogger";

const now = 1;

function stroke(type: Stroke["type"], intensity = 0.85): Stroke {
  return { id: `S-${type}`, type, width: 18, intensity, enabled: true, createdAt: now, points: [{ x: 100, y: 100, time: now }, { x: 220, y: 130, time: now + 1 }, { x: 340, y: 120, time: now + 2 }] };
}

describe("AI-assisted intent interpretation", () => {
  it("keeps rule-based pressure fixed without text", () => {
    const result = interpretRuleBasedSync({ strokes: [stroke("pressure")] });
    const pressure = result.interpretations[0];
    expect(pressure.effects.encounterIntensity).toBeGreaterThan(0.8);
    expect(pressure.effects.spatialOpenness).toBeLessThan(-0.8);
  });

  it("interprets claustrophobic pressure without combat escalation", () => {
    const result = interpretMockAISync({ strokes: [stroke("pressure")], textInstruction: "Make this claustrophobic, but not combat-heavy." });
    const pressure = result.interpretations[0];
    expect(pressure.effects.spatialOpenness).toBeLessThan(-0.7);
    expect(pressure.effects.visibility).toBeLessThan(-0.3);
    expect(Math.abs(pressure.effects.encounterIntensity ?? 1)).toBeLessThan(0.05);
  });

  it("interprets exposed pressure differently from claustrophobic pressure", () => {
    const exposed = interpretMockAISync({ strokes: [stroke("pressure")], textInstruction: "The player should feel exposed in this section." });
    const claustrophobic = interpretMockAISync({ strokes: [stroke("pressure")], textInstruction: "Make this claustrophobic, but not combat-heavy." });
    expect(exposed.interpretations[0].effects.spatialOpenness).toBeGreaterThan(0.4);
    expect(claustrophobic.interpretations[0].effects.spatialOpenness).toBeLessThan(-0.7);
  });

  it("interprets relief as breathing room without extra resources", () => {
    const result = interpretMockAISync({ strokes: [stroke("relief")], textInstruction: "Give the player breathing room, but no extra resources." });
    const relief = result.interpretations[0];
    expect(relief.effects.spatialOpenness).toBeGreaterThan(0.7);
    expect(relief.effects.encounterIntensity).toBeLessThan(-0.4);
    expect(relief.effects.resourceDensity).toBe(0);
  });

  it("interprets branch language as an optional risky shortcut", () => {
    const result = interpretMockAISync({ strokes: [stroke("branch")], textInstruction: "This should be an optional risky shortcut." });
    const branch = result.interpretations[0];
    expect(branch.effects.branching).toBeGreaterThan(0.8);
    expect(branch.effects.encounterIntensity).toBeGreaterThan(0.3);
    expect(result.authoringIntent.intents[0].kind).toBe("branch");
  });

  it("proves same geometry plus different language changes AI IR but not rule-based IR", () => {
    const pressure = stroke("pressure");
    const ruleA = interpretRuleBasedSync({ strokes: [pressure], textInstruction: "Make this claustrophobic, but not combat-heavy." });
    const ruleB = interpretRuleBasedSync({ strokes: [pressure], textInstruction: "The player should feel exposed in this section." });
    const aiA = interpretMockAISync({ strokes: [pressure], textInstruction: "Make this claustrophobic, but not combat-heavy." });
    const aiB = interpretMockAISync({ strokes: [pressure], textInstruction: "The player should feel exposed in this section." });
    expect(ruleA.interpretations[0].effects).toEqual(ruleB.interpretations[0].effects);
    expect(aiA.interpretations[0].effects).not.toEqual(aiB.interpretations[0].effects);
  });

  it("detects conflicting relief stroke and stressful language", () => {
    const result = interpretMockAISync({ strokes: [stroke("relief")], textInstruction: "Make this the most stressful part of the level." });
    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.interpretations[0].confidence).toBeLessThan(0.5);
  });

  it("calculates research metrics from append-only events", () => {
    const events = [
      createResearchEvent("s", "p", "session_started", {}, 100),
      createResearchEvent("s", "p", "compile_requested", {}, 150),
      createResearchEvent("s", "p", "interpretation_returned", {}, 200),
      createResearchEvent("s", "p", "interpretation_accepted", {}, 220),
      createResearchEvent("s", "p", "edit_applied", { scope: "source-intent" }, 250),
    ];
    const metrics = calculateResearchMetrics(events);
    expect(metrics.interpretation_accept_rate).toBe(1);
    expect(metrics.source_intent_revision_count).toBe(1);
    expect(metrics.time_to_first_compile).toBe(50);
  });
});
