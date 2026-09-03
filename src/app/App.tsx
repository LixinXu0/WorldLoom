import { useState } from "react";
import { IntentCanvas } from "../components/canvas/IntentCanvas";
import { CanvasDiffPanel } from "../components/canvas/CanvasDiffPanel";
import { LevelCanvas } from "../components/level/LevelCanvas";
import { BottomVariantTray } from "../components/layout/BottomVariantTray";
import { Inspector } from "../components/layout/Inspector";
import { ToolPalette } from "../components/layout/ToolPalette";
import { TopToolbar } from "../components/layout/TopToolbar";
import { IntentReviewPanel } from "../components/intent-review/IntentReviewPanel";
import { VariantComparison } from "../components/comparison/VariantComparison";
import { RevisionHistory } from "../components/revisions/RevisionHistory";
import { PlaytestCanvas } from "../components/playtest/PlaytestCanvas";
import { AssetSandboxCanvas } from "../components/sketch/AssetSandboxCanvas";
import { CreationProgress } from "../components/onboarding/CreationProgress";
import { useWorldloomStore } from "../store/useWorldloomStore";
import { MapUnderstandingPanel } from "../components/intent-review/MapUnderstandingPanel";
import { BoardWorkspace, type BoardPanel } from "../components/layout/BoardWorkspace";

export function App() {
  const [openBoardPanel, setOpenBoardPanel] = useState<BoardPanel | null>("assets");
  const {
    editorMode,
    editorSubmode,
    setMode,
    setSubmode,
    showField,
    setShowField,
    project,
    startPlaytest,
  } = useWorldloomStore();

  const isV4 =
    project.researchMode === "c1-ai-opaque" ||
    project.researchMode === "c2-ai-negotiable" ||
    project.researchMode === "c3-ai-negotiable-conventions";

  const canGenerate = isV4
    ? Boolean(
        project.compositionHypothesis ||
          project.committedCompositionIntent,
      )
    : project.constraints.length > 0;

  const canLevel = project.variants.length > 0;

  if (isV4 && editorMode !== "level" && editorMode !== "playtest") {
    return (
      <div className="app-shell v4-shell">
        <TopToolbar onOpenBoardPanel={setOpenBoardPanel} />
        <BoardWorkspace openPanel={openBoardPanel} onOpenPanel={setOpenBoardPanel} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopToolbar />
      <CreationProgress />

      <div className="workspace">
        <ToolPalette />

        <main className="main-panel">
          <div className="modebar">
            <div className="segmented">
              <button
                className={editorMode === "intent" ? "active" : ""}
                onClick={() => setMode("intent")}
              >
                {isV4 ? "Sketch Sandbox" : "Intent Canvas"}
              </button>

              <button
                className={editorMode === "review" ? "active" : ""}
                disabled={!canGenerate}
                onClick={() => setMode("review")}
              >
                Grounding
              </button>

              <button
                className={editorMode === "level" ? "active" : ""}
                disabled={!canLevel}
                onClick={() => setMode("level")}
              >
                Generated Level
              </button>

              <button
                className={editorMode === "playtest" ? "active" : ""}
                disabled={!canLevel}
                onClick={startPlaytest}
              >
                Playtest
              </button>
            </div>

            {editorMode === "level" && (
              <div className="segmented">
                <button
                  className={
                    editorSubmode === "inspect" ? "active" : ""
                  }
                  onClick={() => setSubmode("inspect")}
                >
                  Inspect
                </button>

                <button
                  className={
                    editorSubmode === "edit" ? "active" : ""
                  }
                  onClick={() => setSubmode("edit")}
                >
                  Edit
                </button>

                <button
                  className={
                    editorSubmode === "compare" ? "active" : ""
                  }
                  onClick={() => setSubmode("compare")}
                >
                  Compare
                </button>

                <button
                  className={
                    editorSubmode === "revisions" ? "active" : ""
                  }
                  onClick={() => setSubmode("revisions")}
                >
                  Revisions
                </button>
              </div>
            )}

            {!isV4 && (
              <label className="inline">
                <input
                  type="checkbox"
                  checked={showField}
                  onChange={(event) =>
                    setShowField(event.target.checked)
                  }
                />
                Show Field
              </label>
            )}
          </div>

          {editorMode === "intent" && (
              <div
                style={{
                  display: "grid",
                  gap: "12px",
                  alignContent: "start",
                  maxWidth: "962px",
                }}
              >
                {isV4 ? <AssetSandboxCanvas /> : <IntentCanvas />}
              
                {isV4 && (
                  <>
                    <CanvasDiffPanel />
                    <MapUnderstandingPanel />
                  </>
                )}
              </div>
          )}



          {editorMode === "review" && <IntentReviewPanel />}

          {editorMode === "level" &&
            editorSubmode !== "compare" &&
            editorSubmode !== "revisions" && <LevelCanvas />}

          {editorMode === "level" &&
            editorSubmode === "compare" && <VariantComparison />}

          {editorMode === "level" &&
            editorSubmode === "revisions" && <RevisionHistory />}

          {editorMode === "playtest" && <PlaytestCanvas />}
        </main>

        <Inspector />
      </div>

      <BottomVariantTray />
    </div>
  );
}
