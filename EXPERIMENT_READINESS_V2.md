# Experiment Readiness V2

## Research Conditions

- C1 Rule-Based: working. Legacy strokes compile through the deterministic baseline.
- C2 AI Opaque: working. Mock AI interpretation commits directly to constraints while hiding semantic details.
- C3 AI Negotiable: working. Mock AI creates candidate intent, clarification cards, optional convention proposals, and requires commit before realization.

## Clarification

Working for low-confidence, region ambiguity, arrow high-impact ambiguity, and stroke/text conflict. Clarification answers are logged. The built-in recovery correction updates candidate Authoring IR.

## Convention Memory

Working as transparent feature matching. Confirmed project conventions are persisted. Rejected conventions can be disabled. Corrected conventions update their human-readable meaning.

## Layered Repair

Partially working. The UI exposes expression, interpretation, realization, and propagation repair layers and logs selection. Existing edit scopes still perform propagation-level repair. Deeper layer-specific repair workflows remain pilot-level.

## Mocked vs Real AI

AI remains deterministic `MockAIInterpreter`. Provider abstraction exists, but no external API key, cloud account, or backend is required.

## Remaining Confounds

- Mock AI is keyword/structure based.
- Abstract sketch controls are compact proxies, not a full drawing/whiteboard system.
- Convention memory is feature-based and may over-match simple sketches.
- C2 still requires the same Compile button, though interpretation details are hidden.

## Known Failure Cases

- Arbitrary symbols are not recognized unless the user labels or repeats them structurally.
- Clarification corrections currently implement a recovery-pocket correction path, not every possible semantic correction.
- Personal convention persistence is schema-only.
