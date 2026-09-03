# Worldloom V4 Asset-Aware Audit

## Current Architecture

Worldloom is a React + TypeScript + Vite prototype with a central Zustand store in `src/store/useWorldloomStore.ts`. The current project state is defined in `src/core/types.ts` and already contains both legacy `Stroke[]` data and the newer `SketchState` introduced for negotiated grounding.

The current authoring stack is:

```text
Flow / Pressure / Relief / Branch strokes
-> AuthoringIR or rule constraints
-> GameplayConstraint[]
-> procedural rooms / route edges
-> generated variants
-> room edit / revision / playtest systems
```

The V2 negotiated stack added:

```text
Sketch marks / lightweight sketch objects / relations
-> mock AI or rule-based interpretation
-> CandidateIntentInterpretation
-> clarification / convention proposal
-> CommittedAuthoringIR
-> GameplayConstraint[]
-> existing generator
```

## Current Stroke Model

`src/core/types.ts` defines `StrokeType = "flow" | "pressure" | "relief" | "branch"`. Each `Stroke` has points, width, intensity, enabled state, and creation time. `src/components/layout/ToolPalette.tsx` still exposes these semantic brushes as the left-side default tools.

## Existing Authoring IR

`src/core/intent/types.ts` defines `AuthoringIR`, `AuthoringIntent`, `IntentInterpretationResult`, `CandidateIntentInterpretation`, and `CommittedAuthoringIR`. This IR is experience-oriented and still assumes that interpretation ultimately becomes generation constraints.

## Existing `intentToConstraints`

`src/core/intent/intentToConstraints.ts` maps Authoring IR fragments to `GameplayConstraint[]`. It still creates a default `main_path` constraint when no flow stroke exists. This is useful for legacy fallback, but conflicts with V4 if used as the primary realization path for asset composition.

## Current Generator Assumptions

`src/core/generator/*` builds topology, places rooms, and creates corridors from strokes, fields, constraints, and seed. Generated output is `LevelVariant` with `RoomNode[]` and `RouteEdge[]`. This assumes the target outcome is a complete generated map, not an edit plan over existing production assets.

## Existing Intent Inspector

`src/components/intent-review/IntentReviewPanel.tsx` shows interpreted meaning, confidence, alternatives, clarification cards, convention prompts, and constraint controls. It is reusable for grounding inspection, but it needs an asset-aware composition inspector that shows asset roles, relations, missing needs, preservation, and edit plan preview instead of room-generation constraints.

## Existing AI Provider Abstraction

`src/ai/provider.ts`, `src/ai/AIIntentInterpreter.ts`, `src/ai/AIIntentSchema.ts`, and `src/ai/mockAIInterpreter.ts` provide a deterministic mock AI path plus a future structured provider boundary. V4 should add an asset-aware interpreter beside this rather than forcing asset composition into stroke-oriented `AuthoringIR`.

## Research Logger

`src/research/interactionLogger.ts` is append-only and already records session, stroke, interpretation, clarification, convention, generation, repair, playtest, and edit events. It should be extended with asset instance, composition hypothesis, role correction, edit plan, and preservation events.

## Revision System

`src/core/revisions/*` snapshots `WorldloomProject` and restores previous project states. It is reusable because asset instances and edit plans can live in project state and be captured by existing snapshot logic.

## Playtest System

`src/core/playtest/*` operates on generated `LevelVariant` rooms. It remains useful for legacy generated maps but does not directly test V4 asset arrangements. V4 should not depend on playtest to validate asset edit plans.

## Serialization

`src/core/serialization/projectJson.ts` exports `WorldloomProject`; `src/core/migration/migrateProject.ts` backfills defaults. This can preserve legacy projects by adding V4 defaults for asset library state, composition hypotheses, committed composition intents, and edit plans.

## Example Project

`src/examples/exampleProject.ts` currently creates a legacy stroke example. V4 needs demo scenes A/B/C made from stable mock assets while keeping the old example as a legacy sample.

## Mock Assets

No V4 production asset library exists in `src/` or `public/assets/mock-pack/`. Existing root-level art assets belong to the surrounding Godot project and are not the specified mock pack. V4 should create stable metadata and label thumbnails locally without fetching from the internet.

## Toolbar Location

The semantic brush toolbar is implemented in `src/components/layout/ToolPalette.tsx`. The top bar research-mode selector is in `src/components/layout/TopToolbar.tsx`.

## Old Assumptions That Conflict With V4

- Default authoring starts with semantic brush categories.
- Arrow-like or path-like expression is treated as route intent too early.
- Loop or region-like expression can become a gameplay region before asset context is considered.
- Realization means `GameplayConstraint[] -> rooms/corridors`.
- Generated room identity is unrelated to existing production asset identity.
- The generator adds a default main path if no flow stroke exists.
- Research modes are currently named around rule-based/AI interpretation, not asset-aware opaque/negotiable/convention conditions.

## Reusable Modules

- Zustand store and project snapshot strategy.
- Research logger and metrics architecture.
- Serialization and migration pattern.
- Convention memory matching, after generalization to asset-pattern signatures.
- Candidate/committed lifecycle concepts.
- Existing generator, validator, revision, edit, and playtest modules for legacy mode and fallback demos.
- Existing layout shell and inspector structure.

## Modules That Should Be Adapted

- `src/core/sketch/types.ts`: add asset instances, utterances, neutral mark vocabulary, and richer relation types.
- `src/core/types.ts`: add V4 asset-aware project state and edit-plan state.
- `src/store/useWorldloomStore.ts`: add asset placement, lock, group, interpret-together, composition commit, edit-plan preview/apply actions.
- `src/components/sketch/SketchSandboxPanel.tsx`: become the default neutral sandbox and asset instance manager.
- `src/components/intent-review/IntentReviewPanel.tsx`: become a grounding inspector for asset-aware hypotheses and edit plans.
- `src/research/interactionLogger.ts` and `src/research/metrics.ts`: add V4 events and metrics.
- `src/examples/exampleProject.ts`: add V4 demo scenes while preserving legacy example.

## Modules That Should Remain Untouched

- `src/core/generator/*` should remain available for legacy procedural generation.
- `src/core/field/*`, `src/core/compiler/*`, and `src/core/intent/intentToConstraints.ts` should remain stable unless needed for compatibility.
- Room editing, revision, and playtest modules should remain compatible with existing generated variants.

## Modules Deprecated From The Default Workflow

- Semantic brush-first `Flow / Pressure / Relief / Branch` authoring.
- Direct constraint editing as the primary interpretation review.
- Complete room/corridor generation as the default outcome after interpretation.

These are not deleted. They should move behind a legacy section or secondary action.
