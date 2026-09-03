# Sketch Sandbox Design

## SketchState Schema

Worldloom now preserves legacy `Stroke[]` and adds a higher-level `SketchState`:

- `marks`: path, region, arrow, symbol, and legacy Flow / Pressure / Relief / Branch marks.
- `objects`: lightweight semantic proxies such as Entrance, Exit, Enemy, Resource, Key, Door, Landmark, and Custom.
- `relations`: connects, leads_to, contains, and relates_to.
- `annotations`: text bound to a selected element or whole sketch.
- `groups`: selected element compositions.

Legacy strokes are adapted into `legacy-*` sketch marks so old projects remain compatible.

## Interaction Primitives

The prototype supports compact controls for:

- Adding abstract marks.
- Adding object proxies.
- Moving objects.
- Creating and deleting relations.
- Selecting one element or shift-selecting multiple elements.
- Grouping selected elements.

This is enough to instantiate CHI pilot scenarios such as loop + enemy + arrow, key + door relation, and repeated symbol use.

## Why This Is Not A General Whiteboard

The sandbox stores research-relevant expression structure, not arbitrary whiteboard content. It intentionally avoids handwriting recognition, large asset libraries, freeform diagramming, and visual polish unrelated to the study.

The goal is to separate:

```text
Expression != Interpretation != Committed Intent != Realization
```
