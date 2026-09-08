# Worldloom spatial workspace update

The V4 workspace now uses a charcoal palette, a quiet top bar, a visual asset tray, a semantic selection inspector, local interpretation notes, and a centered Select / Sketch / Connect / Annotate dock.

## Modified files

- `src/main.tsx` — load the workspace presentation stylesheet.
- `src/styles/tokens.css` — shared dark and semantic color tokens.
- `src/styles/globals.css` — remove the old light V4 styling and adapt shared neutral surfaces.
- `src/styles/workspace.css` (new) — layout, cards, typography, semantic states, responsive behavior.
- `src/components/layout/TopToolbar.tsx` — quiet V4 header; project actions remain in the project menu.
- `src/components/layout/BoardWorkspace.tsx` — panel composition, close/collapse/recovery, dock, and drag bounds.
- `src/components/layout/SemanticPanels.tsx` (new) — hypothesis, semantic inspector, local notes, interpretation space, trace, minimap, annotation composer.
- `src/components/assets/AssetVisual.tsx` (new) — shared production-texture preview with simple isometric vector fallbacks.
- `src/components/assets/AssetLibraryPanel.tsx` — visual grid, category tabs, search, and existing example scenes.
- `src/components/sketch/AssetSandboxCanvas.tsx` — asset previews, semantic outlines, directional relations, and attached annotations.
- `src/store/useWorldloomStore.ts` — add an undoable annotation action using the existing annotation structure.
- `src/tests/v4-asset-aware.test.ts` — annotation validation, JSON round-trip, undo, and redo coverage.

## Reusable components

`FloatingCard` supplies a common draggable, collapsible, closable shell. `AssetVisual` is shared by the canvas, tray, and inspector. The focused components in `SemanticPanels.tsx` render the existing project state rather than static demonstration confidence values or events.

## Interaction changes

- Close panels with X; recover them from the bottom text controls or project menu. Larger panels collapse to their headers. Drag headers to reposition them.
- Below 1100px, analytical panels collapse and local notes initially become markers.
- Connect uses shift-selected assets and the existing relation action.
- Annotate attaches text to a selected asset; it is included in JSON export and supports Undo / Redo.
- Local question options call the existing clarification handler. Committing uses the existing composition action; committed selections turn green and the provisional reading disappears.
- The interpretation axes are read-only qualitative readings inferred from the hypothesis, not editable or calibrated numeric parameters.
- Space in text inputs no longer starts canvas panning; scrolling a panel no longer zooms the board.
- Existing asset placement, backend/manifest loading, generation, graph, research conditions, and serialization remain in use. Opaque research mode keeps hypothesis details hidden.

## Validation

- `npm run build`: passes. Vite reports a non-blocking bundle-size warning for the main chunk.
- `npm test`: 48 tests pass across 5 files.
- Browser checks: load the existing high-ground example, interpret it, collapse/expand Assets, close/recover Design Trace, attach a note, answer the local clarification, and commit successfully.
- Visual checks at 1440×900, 1600×900, 1920×1080, and 900×700.
- Screenshots: `screenshots/worldloom-1440.png`, `screenshots/worldloom-1600.png`, and `screenshots/worldloom-1920.png`. These show the existing example with an attached annotation before commitment.

## Remaining differences from the reference

The existing library contains eight asset definitions and the high-ground example contains five placed assets. This update preserves those definitions and positions; it does not add the reference image’s trees, rock fields, terrain islands, or larger level composition. Nature therefore has an honest empty state. Fallback geometry is deliberately simple and is not a licensed Kenney pack.

Panels are manually repositionable and can still cover content after arbitrary scene edits; there is no automatic collision-avoidance solver. Legacy/generated-level views retain their existing layout and 2D visualization, with shared neutral theme updates. Their complete workflows were covered by existing tests, not an exhaustive browser walkthrough. The screenshots demonstrate the new visual language, not a pixel-exact reconstruction of the supplied image.

## Run

From `D:/2025/叙事游戏/rougelikedemo/worldloom-prototype`:

```powershell
npm install
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173. Choose “Open high-ground example”, then “Interpret selection →”.

```powershell
npm run build
npm test
```
