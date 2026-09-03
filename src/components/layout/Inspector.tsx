import {
  useWorldloomStore,
} from "../../store/useWorldloomStore";

import {
  EditInterpretationPanel,
} from "../editing/EditInterpretationPanel";

import {
  ConstraintInspector,
} from "../inspector/ConstraintInspector";

import {
  ProjectInspector,
} from "../inspector/ProjectInspector";

import {
  RoomInspector,
} from "../inspector/RoomInspector";

import {
  StrokeInspector,
} from "../inspector/StrokeInspector";

import {
  WorldSettingPanel,
} from "../intent-review/WorldSettingPanel";

import {
  PlaytestReview,
} from "../playtest/PlaytestReview";

import {
  SketchSandboxPanel,
} from "../sketch/SketchSandboxPanel";


export function Inspector() {
  const {
    selected,
    draftRoomEdit,
    editorMode,
  } = useWorldloomStore();

  return (
    <aside className="inspector">
      {editorMode === "intent" && (
        <>
          <WorldSettingPanel />
          <SketchSandboxPanel />
        </>
      )}

      {draftRoomEdit && (
        <EditInterpretationPanel />
      )}

      {editorMode === "playtest" && (
        <PlaytestReview />
      )}

      {!draftRoomEdit &&
        selected?.kind === "stroke" && (
          <StrokeInspector
            id={selected.id}
          />
        )}

      {!draftRoomEdit &&
        selected?.kind ===
          "constraint" && (
          <ConstraintInspector
            id={selected.id}
          />
        )}

      {!draftRoomEdit &&
        selected?.kind === "room" && (
          <RoomInspector
            variantId={
              selected.variantId
            }
            id={selected.id}
          />
        )}

      {!draftRoomEdit &&
        !selected &&
        editorMode !== "playtest" &&
        editorMode !== "intent" && (
          <ProjectInspector />
        )}
    </aside>
  );
}