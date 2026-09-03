# UI Refactor V1

## Files changed

- Added `src/components/layout/BoardWorkspace.tsx`.
- Updated `src/app/App.tsx`, `src/components/layout/TopToolbar.tsx`, `src/components/assets/AssetLibraryPanel.tsx`, and `src/components/sketch/AssetSandboxCanvas.tsx`.
- Added scoped V4 board styles in `src/styles/globals.css`.

## Layout

- Fixed sidebars and bottom tray -> one light grid board with draggable floating cards.
- Asset Library -> summonable Asset Tray with search, categories, thumbnails when available, and existing drag/drop.
- Right Inspector -> contextual inspector shown only for a selected sketch object.
- Pipeline review -> local AI response card, with World Setting and Map Understanding available from the board.

## G1-G6 regression check

- G1 world setting remains on the existing store and existing Qwen, Wanxiang, map understanding, and export paths.
- G2-G5.5 existing manifest, preview, regeneration, Pillow/bridge, and map-background code remains unchanged.
- G6 gameplay semantic elements and Godot export/generator compatibility remain unchanged.

## Implemented interactions

- Freehand draw, object selection/move, asset drag/drop, `A` asset summon, right-click asset summon, floating-card drag/close, contextual inspector, AI presence, local interpretation card, space/middle drag pan, cursor-centered wheel zoom, and zoom reset.

## Remaining Phase 2 / Phase 3

- Spatial AI snapping and richer question/conflict/proposal cards.
- Direct semantic manipulation, discard zone with undo, and compact local provenance history.

## Known UI bugs

- Default mock assets use text fallbacks until a matching bridge/static texture preview exists; the complete manifest preview path remains available in Map Understanding.
- Legacy and generated-level modes still use their existing layout while the V4 board migration is stabilized.
