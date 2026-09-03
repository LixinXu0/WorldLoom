# Experiment Readiness

## Working

- Rule-Based and AI-Assisted interpretation modes exist.
- Both modes output structured `AuthoringIR`.
- Both modes convert through `intentToConstraints`.
- The existing generator remains shared and unchanged.
- Text clarification is bound to compile events and saved in the project.
- Interpret UI shows semantic summaries, effects, confidence, alternatives, conflicts, and editable constraints.
- Alternative selection updates constraints and provenance metadata.
- Research events are appended in memory and exportable as `research-log.json`.
- Training examples are exportable as `training-example.json`.
- Existing generated variants, edit scopes, revisions, playtest, and timelines remain available.

## Partially Working

- `sourceInterpretationIds` are attached to constraints. Generated rooms and edges still rely primarily on `sourceConstraintIds`, so the chain is currently room or edge to constraint to interpretation rather than directly storing interpretation ids on each generated object.
- Interpretation adjustment through sliders updates constraints and logs adjustment events, but it does not yet rewrite the higher-level Authoring IR for every manual slider edit.
- Playtest finish logging is represented by playtest events, but there is no dedicated UI action that records `playtest_finished` outside the existing session-complete event.

## Mocked

- AI interpretation currently uses `MockAIInterpreter`, a deterministic local interpreter designed for repeatable CHI pilot workflows and tests.

## Needs API

- A real provider can be connected through `StructuredLLMProvider.completeStructured`.
- Provider output must continue to validate against `AIIntentSchema` and must not return level geometry.

## Needs Participant Pilot

- Whether users understand the shared inspector in both conditions.
- Whether alternatives support negotiation without overloading the workflow.
- Whether text clarification placement feels like intent compilation rather than a chatbot.
- Whether research-log metrics align with observed agency and confidence.

## Known Confounds

- The mock AI is deterministic and keyword-sensitive, so it demonstrates experimental structure rather than model capability.
- Rule-Based mode still shows alternatives for UI parity, but selecting those alternatives is a human override rather than baseline interpretation.
- The generator and intent-fit metrics were originally designed around deterministic constraints, so AI effects may need calibration before formal study use.
