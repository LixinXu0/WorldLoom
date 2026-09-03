# AI Interpretation Design

## What Rule-Based Interpretation Does

Rule-Based Interpretation is the deterministic baseline. It maps each stroke type to fixed structured effects:

- Flow becomes main-path intent.
- Pressure becomes higher combat pressure plus lower openness, resources, and visibility.
- Relief becomes recovery, resources, openness, and lower encounter intensity.
- Branch becomes optional branch intent.

The old `compileConstraints` API is preserved, but now delegates to `RuleBasedIntentInterpreter` so the baseline is explicit.

## What AI-Assisted Interpretation Can Additionally Represent

AI-Assisted Interpretation outputs the same Authoring IR shape, but can vary semantic effects based on language:

- Claustrophobic pressure can reduce openness and visibility without raising combat.
- Exposed pressure can increase openness and visibility while adding only moderate threat.
- Relief can become breathing room without extra resources.
- Branch strokes can become risky shortcuts.
- Conflicting stroke and language combinations can return low confidence and an explicit conflict.

The current implementation uses `MockAIInterpreter` for local, deterministic research runs. `AIIntentInterpreter` has a provider abstraction for future structured LLM integration.

## What Remains Identical Between Conditions

Both conditions share:

- The same `Stroke[]` input.
- The same optional text clarification field.
- The same `AuthoringIR` schema.
- The same `intentToConstraints` conversion.
- The same `GameplayConstraint[]` downstream generator input.
- The same experience field, topology, room placement, corridor generation, validation, intent fit, edit scopes, revisions, and playtest systems.

AI never generates room coordinates or final levels.

## What Variables Differ

The experimental variable is the interpretation mechanism:

- `rule-based`: fixed stroke-to-effect mapping.
- `ai`: context-sensitive structured interpretation, currently deterministic mock AI.

Both modes record `interpreterMode`, `interpreterVersion`, confidence, source stroke ids, text instruction, selected alternative, and manual adjustment state.

## What Data Is Logged

Research logs are separate from normal project JSON and can be exported as `research-log.json`. Events include:

- Session start
- Stroke creation, modification, deletion
- Text instruction changes
- Interpretation mode changes
- Compile requests and interpretation returns
- Interpretation acceptance, adjustment, and alternative selection
- Generation requests and generated variants
- Variant selection
- Edit application and edit scope selection
- Undo and redo
- Playtest start and feedback submission

Metrics can be calculated from this append-only log, including accept rate, adjustment rate, alternative selection rate, recompile count, undo/redo counts, local edit counts, source intent revision counts, all-variant edit counts, and basic time-to-action measures.

## What Hypotheses Can Now Be Tested

Worldloom can now test whether AI-assisted interpretation helps designers express, inspect, correct, and negotiate ambiguous experiential intent beyond fixed rule mappings.

The critical demo is:

```text
Same Pressure Stroke

Rule-Based:
fixed predefined combat + compression mapping

AI-Assisted + "Make this claustrophobic without adding combat":
strong spatial compression, lower visibility, combat unchanged

Both:
same Authoring IR type, same constraints bridge, same generator
```
