# Worldloom Architecture Audit

## Current stroke representation

Strokes are defined in `src/core/types.ts` as `Stroke` objects with `id`, `type`, `points`, `width`, `intensity`, `enabled`, and `createdAt`. The supported stroke primitives are `flow`, `pressure`, `relief`, and `branch`.

## Current intent representation

The current executable intent representation is `GameplayConstraint[]`. Constraints contain `sourceStrokeIds`, a `target`, spatial `region`, `preferredValue`, `weight`, `hard`, `enabled`, and explanatory text. There is no separate Authoring IR layer yet, so interpretation and constraint compilation are currently coupled.

## Current rule-based mappings

`src/core/compiler/compileConstraints.ts` uses deterministic stroke mappings:

- Flow creates a hard `main_path` constraint.
- Pressure increases `encounter_intensity` and suppresses `spatial_openness`, `resource_density`, and `visibility`.
- Relief increases `recovery`, `resource_density`, and `spatial_openness`, and reduces `encounter_intensity`.
- Branch creates a `branching` constraint.
- If no enabled Flow stroke exists, a default hard `main_path` constraint is added.

## Current generator input

`src/core/generator/generateVariants.ts` receives `Stroke[]`, `GameplayConstraint[]`, `FieldCell[]`, `seed`, `width`, and `height`. It builds topology, places rooms, builds corridors, validates reachability, and calculates intent fit. This downstream pipeline should remain shared by both rule-based and AI-assisted interpretation conditions.

## Current provenance mechanism

Generated rooms and edges preserve `sourceStrokeIds` and `sourceConstraintIds`. Edit/revision systems also preserve project snapshots. There is currently no explicit `sourceInterpretationIds` chain from generated objects back to a formal interpretation result.

## Current Interpret UI behavior

`src/components/intent-review/IntentReviewPanel.tsx` displays one card per `GameplayConstraint`, with sliders for weight and preferred value plus hard/enabled toggles. It is already editable, but it shows constraints directly instead of stroke-level semantic interpretations and alternatives.

## Current persistence format

`src/core/serialization/projectJson.ts` exports `WorldloomProject` as JSON with version `2.0.0`. `src/core/migration/migrateProject.ts` fills v2 defaults for older project shapes. Revision snapshots intentionally strip nested revision history.

## Existing v2 systems

The project already contains deterministic room-edit capture, edit meaning inference, impact preview, scope application, repair, revision restore, playtest events, feedback, and timeline utilities. These should be preserved.

## Files that will be changed

- `src/core/types.ts`
- `src/core/compiler/compileConstraints.ts`
- `src/core/migration/migrateProject.ts`
- `src/core/serialization/projectJson.ts`
- `src/examples/exampleProject.ts`
- `src/store/useWorldloomStore.ts`
- `src/app/App.tsx`
- `src/components/intent-review/IntentReviewPanel.tsx`
- `src/components/layout/TopToolbar.tsx`
- `src/components/inspector/ProjectInspector.tsx`
- `src/styles/globals.css`
- `src/tests/*.test.ts`

New files will be added under:

- `src/core/intent/`
- `src/ai/`
- `src/research/`
- `src/components/research/`

## Files that will remain untouched where possible

- Existing generator modules under `src/core/generator/`
- Existing field modules under `src/core/field/`
- Existing edit scope modules under `src/core/editing/`
- Existing playtest modules under `src/core/playtest/`
- Existing revision modules under `src/core/revisions/`
