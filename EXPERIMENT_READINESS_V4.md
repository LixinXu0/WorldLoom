# Experiment Readiness V4

## Checklist

| Requirement | Status | Notes |
| --- | --- | --- |
| asset library working? | Working | Mock library visible in default left panel. |
| drag/drop working? | Working | Asset cards are draggable into the sandbox; clicking also creates instances for fast pilots. |
| freehand pen default? | Working | Pen is active on open; the user can draw immediately without selecting Path/Loop/Arrow. |
| raw stroke preservation? | Working | Raw sampled points, pointer type, pressure, gesture candidates, and episodes are stored in `SketchState`. |
| asset identity preserved? | Working | Edit plans mutate `AssetInstance` fields without changing ids. |
| group interpretation working? | Working | `Interpret Together` creates an `AssetAwareVisualUtterance` from selected assets, marks, relations, and groups. |
| relation drawing working? | Working | Connector creates explicit typed relations, defaulting to neutral `related_to`. |
| clarification working? | Working | Demo A asks whether Reward Chest belongs to the encounter or is a separate optional reward. |
| composition commit working? | Working | Hypothesis commits to `CompositionIntent`. |
| edit plan working? | Working | Committed composition generates previewable asset edit operations. |
| preserve/lock working? | Working | Locked assets produce preserve operations and are not moved by the plan. |
| convention reuse working? | Partially working | C3 detects existing conventions through the previous convention system generalized to asset signatures. Full conflict resolution remains prototype-level. |
| C1/C2/C3 working? | Working | V4 modes are C1 AI Opaque, C2 AI Negotiable, C3 Negotiable + Conventions. Legacy rule-based remains available. |
| logging complete? | Mostly working | Required V4 event types exist and main workflow emits them. Some fine-grained role-edit UI events are schema-ready but not deeply interactive yet. |
| legacy compatibility intact? | Working | Old versions migrate; legacy mode preserves semantic brushes and procedural generator. |

## Freehand Acceptance

Browser smoke confirms:

- Pen is active by default.
- Multiple mouse-drawn raw strokes render on the sandbox.
- Raw strokes drawn over assets do not move assets in Pen mode.
- Select mode moves the Watchtower predictably.
- Interpret Together includes raw stroke ids and asset ids.
- No semantic Path / Loop / Arrow tool selection is required before drawing.

## Mocked

The asset-aware AI is deterministic and local. It demonstrates the research interaction contract rather than model capability.

## Acceptance Test

`src/tests/v4-asset-aware.test.ts` covers the required Demo A workflow through asset placement, loop/arrow utterance, clarification, Watchtower lock, composition commit, edit-plan generation, plan apply, preserved asset identity, and no full room/corridor regeneration.

## Remaining Pilot Risks

- The central sandbox uses simple draggable/clickable asset cards rather than production-grade canvas manipulation.
- Edit-plan modification is represented by regenerate/reject/apply controls, not a full operation editor.
- Convention memory is deterministic feature matching and may over-match simple compositions.
- Playtest remains legacy room-map focused.
