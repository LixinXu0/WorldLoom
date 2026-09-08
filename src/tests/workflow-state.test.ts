import { describe, expect, it } from "vitest";
import { useWorldloomStore } from "../store/useWorldloomStore";

describe("whole-level commitment workflow", () => {
  it("separates interpretation commit, validation, and playable contract generation", () => {
    useWorldloomStore.getState().loadV4DemoScene("high-ground");
    useWorldloomStore.getState().interpretTogether();
    expect(useWorldloomStore.getState().project.compositionHypothesis).not.toBeNull();
    useWorldloomStore.getState().commitComposition();
    expect(useWorldloomStore.getState().project.committedCompositionIntent).not.toBeNull();
    useWorldloomStore.getState().finalizeDesignState();
    expect(useWorldloomStore.getState().wholeLevelState).toBe("ready_to_generate");
    useWorldloomStore.getState().generateLevelContract();
    const state = useWorldloomStore.getState();
    expect(state.wholeLevelState).toBe("generated");
    expect(state.generationContract?.status).toBe("ready");
    expect(state.project.variants).toHaveLength(0);
  });
});
