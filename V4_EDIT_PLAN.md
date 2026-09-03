# Worldloom V4 Asset Edit Plan

## Purpose

Realization in V4 means producing an inspectable edit plan over existing assets. It does not mean regenerating a full room/corridor map.

## Operations

The edit-plan layer supports:

- place
- move
- rotate
- connect
- group
- assignRole
- bind
- preserve
- duplicate
- replace
- remove

The current prototype primarily emits `preserve`, `assignRole`, `move`, and `connect` operations for the CHI demo scenes.

## Preview

Before applying, the Grounding Inspector shows a `Worldloom Proposes` card with a readable summary:

- what stays preserved
- what moves
- which roles are assigned
- which relations are created

The user can apply, reject, or regenerate/edit the plan.

## Apply

Applying a plan updates `SketchState.assetInstances` by preserving identity, moving only allowed assets, and appending role assignments. Applied plans are kept in `appliedAssetEditPlans`.

## Legacy Generator

The procedural generator remains available in `legacy-rule-based` mode and for old projects/tests. It is no longer the default V4 realization path.
