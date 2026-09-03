# Worldloom V4 Asset Model

## Purpose

V4 treats production assets as first-class authored objects. Sketch marks and AI interpretation may refer to them, but asset identity is never collapsed into anonymous generated rooms.

## Asset Definitions

The mock production library lives in `src/assets/mockAssetLibrary.ts`.

Each asset has:

- stable `id`
- display `name`
- optional thumbnail/source reference
- `category`
- `candidateRoles`
- `capabilities`
- default constraints such as movable, duplicable, replaceable, and rotatable

Initial assets:

- Watchtower
- Barricade
- Stone Stair
- Enemy Shrine
- Reward Chest
- Gate
- Bridge
- Healing Shrine

## Asset Instances

Dragging or clicking an asset definition creates an `AssetInstance` inside `SketchState.assetInstances`.

Each instance stores:

- stable instance `id`
- `assetDefinitionId`
- position, rotation, and scale
- lock / preserve flags
- do-not-duplicate and do-not-replace flags
- role assignments
- creation time

Interpretation and edit plans reference these instance ids directly.

## Preservation

Users can lock/preserve an instance. The edit-plan generator emits `preserve` operations and does not move locked assets.

## Backward Compatibility

Legacy `SketchObject` and `Stroke[]` remain in the schema. New V4 work should use `assetInstances` for production assets and leave `SketchObject` as a lightweight compatibility/proxy layer.
