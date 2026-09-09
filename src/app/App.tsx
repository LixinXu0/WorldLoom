import { useState } from "react";

import { TopToolbar } from "../components/layout/TopToolbar";
import { BoardWorkspace } from "../components/layout/BoardWorkspace";

import { ToolPalette } from "../components/layout/ToolPalette";
import { Inspector } from "../components/layout/Inspector";
import { BottomVariantTray } from "../components/layout/BottomVariantTray";

import { IntentCanvas } from "../components/canvas/IntentCanvas";

import { useWorldloomStore } from "../store/useWorldloomStore";


type BoardPanel =
  | "assets"
  | "world"
  | "map";


export default function App() {
  const project = useWorldloomStore(
    (state) => state.project
  );

  const [boardPanel, setBoardPanel] =
    useState<BoardPanel | null>(null);


  const isV4 =
    project.researchMode ===
      "c1-ai-opaque" ||
    project.researchMode ===
      "c2-ai-negotiable" ||
    project.researchMode ===
      "c3-ai-negotiable-conventions";


  /*
   * New Worldloom workspace.
   *
   * This is only a UI shell change.
   * All project state still comes from
   * our upgraded Worldloom store.
   */
  if (isV4) {
    return (
      <div className="app-shell v4-shell">

        <TopToolbar
          onOpenBoardPanel={
            setBoardPanel
          }
        />

        <BoardWorkspace
          boardPanel={boardPanel}
          onBoardPanelChange={
            setBoardPanel
          }
        />

      </div>
    );
  }


  /*
   * Keep the previous workspace for
   * legacy / rule-based research mode.
   *
   * We can remove this later only after
   * every old function has a confirmed
   * home in the new UI.
   */
  return (
    <div className="app-shell">

      <TopToolbar />

      <div className="workspace">

        <ToolPalette />

        <main className="canvas-area">
          <IntentCanvas />
        </main>

        <Inspector />

      </div>

      

      <BottomVariantTray />

    </div>
  );
}