# Worldloom V4 Composition IR

## Layer Separation

V4 preserves these layers:

```text
RawStroke
!= GeometricGesture
!= DesignMeaning
```

and, at the asset-composition level:

```text
Existing Asset
!= Sketch Mark
!= AI Interpretation
!= Committed Composition Intent
!= Asset Edit Operation
```

`RawStroke` is the lowest-level expression record. It keeps the original sampled points, timestamp, pointer pressure when available, and pointer type. It is not immediately converted into path, loop, arrow, flow, pressure, or relief.

`GeometricGestureCandidate` is optional evidence derived from one or more raw strokes. A `closed_loop` candidate can still mean combat grouping, safe area, custom notation, attention mark, or nothing meaningful until grounded against assets and context.

## Asset-Aware Visual Utterance

`AssetAwareVisualUtterance` is the interpretation unit. It groups selected asset instances, marks, relations, and annotations into one compositional expression.

It contains:

- `assetInstanceIds`
- `markIds`
- `relationIds`
- `annotationIds`
- bounds
- status
- creation time

This prevents Worldloom from separately classifying `loop`, `arrow`, `tower`, and `barricade` and merely summing them.

## Composition Hypothesis

`AssetCompositionHypothesis` is the AI-facing candidate result. It includes:

- natural-language summary
- confidence
- proposed asset roles
- spatial and gameplay relations
- experiential goals
- preservation suggestions
- missing needs
- alternatives
- clarification requests

The mock interpreter currently recognizes the three V4 demo families, including defended high-ground encounter, protected recovery pocket, and risky reward detour.

## Committed Composition Intent

`CompositionIntent` is created only after the designer commits the hypothesis. It stores:

- participating asset ids
- assigned roles
- spatial/gameplay relations
- experiential goals
- preservation rules
- missing needs
- edit scope
- provenance back to utterance and hypothesis

Only this committed layer can produce an asset edit plan in negotiable modes.
