# Worldloom spatial workspace update

The follow-up semantic pass is included below the original update. The app now opens with an illustrative semantic demo so the Figure 1 interaction language is visible immediately.

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
- `src/core/sketch/semanticStyles.ts` — typed main, optional, contour, conflict, uncertainty, and note-arrow stroke styles.
- `src/core/sketch/semanticPresentation.ts` — structured local semantic items and event-to-color mapping.
- `src/components/layout/WorkspaceIcon.tsx` — refined loom, pointer, pen, link, and note SVG icons.
- `src/components/sketch/SketchStyleControl.tsx` — compact semantic brush selector.
- `src/examples/semanticDemo.ts` — model-independent Figure 1 demo fixture with all semantic strokes, markers, cards, and trace states.
- `src/tests/semantic-ui.test.ts` — semantic style, demo state, trace mapping, opaque-mode, and serialization coverage.
- `src/tests/v4-asset-aware.test.ts` — annotation validation, JSON round-trip, undo, and redo coverage.

## Reusable components

`FloatingCard` supplies a common draggable, collapsible, closable shell. `AssetVisual` is shared by the canvas, tray, and inspector. The focused components in `SemanticPanels.tsx` render the existing project state rather than static demonstration confidence values or events.

## Interaction changes

- Close panels with X; recover them from the bottom text controls or project menu. Larger panels collapse to their headers. Drag headers to reposition them.
- Below 1100px, analytical panels collapse and local notes initially become markers.
- Connect uses shift-selected assets and the existing relation action.
- Annotate attaches text to a selected asset; it is included in JSON export and supports Undo / Redo.
- Local question options call the existing clarification handler. Committing uses the existing composition action; committed selections turn green and the provisional reading disappears.
- Interpretation Space now exposes six adjustable semantic axes. Dashed points show the model proposal; solid points show the user's adjustment. Commit Interpretation, Finalize Design State, structural validation, and Generate Level are separate actions.
- Space in text inputs no longer starts canvas panning; scrolling a panel no longer zooms the board.
- Existing asset placement, backend/manifest loading, generation, graph, research conditions, and serialization remain in use. Opaque research mode keeps hypothesis details hidden.

The semantic demo remains model-independent, but a real interpretation request is sent to the server route `/api/interpret` after each explicit Interpret action. The server reads `MODEL_API_KEY` (falling back to the existing `DASHSCOPE_API_KEY`), `MODEL_BASE_URL`, and `MODEL_NAME`; keys never enter the browser bundle. If the model is unavailable, the local hypothesis remains visible with an explicit “Local fallback” state and Retry action. `/api/generate-contract` validates a contract without pretending that a 3D level was generated.

Asset right-click menus and Delete/Backspace provide focus, duplicate, AI interpretation, constraint editing, and safe deletion. Deleting an element with relations, notes, or committed references shows a compact confirmation and records cleanup/conflict events.

Local semantic cards and markers are now draggable presentation objects with independent visual positions and target anchors. Their context menus support focus, rerun, reassignment, conversion, hide, delete, and candidate commit. `＋ New AI Card` enters placement mode and creates a question, candidate reading, or constraint note with user provenance. Meaningful asset moves and route relations create debounced auto-detected questions without committing decisions.

The board now exposes the end-to-end stage controls: World Setting, Submit Sketch, candidate review with custom interpretation, six-axis negotiation, map layer visibility, Map Understanding summary/lock, and exportable understanding/generation artifacts. Sketch submissions persist baseline/current snapshots and a new-stroke diff in `project.sketchSubmission`. AI Base Map output from the existing missing-asset generator can be enabled as a decorative lower layer; it never creates collision. The existing Qwen generation-plan and Godot bridge tools remain available under the Map Understanding generation section, with their real bridge success/failure state unchanged.

## Validation

- `npm run build`: passes. Vite reports a non-blocking bundle-size warning for the main chunk.
- `npm test`: 48 tests pass across 5 files.
- Follow-up semantic/workflow pass: `npm test` passes 53 tests across 7 files; `npm run build` passes.
- Browser checks: load the existing high-ground example, interpret it, collapse/expand Assets, close/recover Design Trace, attach a note, answer the local clarification, and commit successfully.
- Visual checks at 1440×900, 1600×900, 1920×1080, and 900×700.
- Screenshots: `screenshots/worldloom-1440.png`, `screenshots/worldloom-1600.png`, `screenshots/worldloom-1920.png`, and `screenshots/worldloom-semantic-final.png`. The final capture shows the semantic demo with all five local card/marker states, six stroke styles, and the color-coded trace.

## Remaining differences from the reference

The existing library contains eight asset definitions and the semantic demo contains seven placed assets. This update preserves those definitions and positions; it does not add the reference image’s trees, rock fields, terrain islands, or larger level composition. Nature therefore has an honest empty state. Fallback geometry is deliberately simple and is not a licensed Kenney pack.

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
