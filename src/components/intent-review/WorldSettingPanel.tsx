import {
  useDoodleInterpretationStore,
} from "../../store/useDoodleInterpretationStore";
import { useWorldloomStore } from "../../store/useWorldloomStore";


const MAX_LENGTH = 600;


export function WorldSettingPanel() {
  const {
    worldSetting,
    setWorldSetting,
  } = useDoodleInterpretationStore();
  const { project, setWorldSetting: setProjectWorldSetting, confirmWorldSetting } = useWorldloomStore();
  const value = project.worldSetting?.text ?? worldSetting;

  return (
    <section
      className="world-setting-panel"
      style={{
        display: "grid",
        gap: "8px",
        paddingBottom: "12px",
        marginBottom: "12px",
        borderBottom:
          "1px solid #c8c5bd",
      }}
    >
      <div>
        <h3>World Setting</h3>

        <p
          style={{
            marginTop: "6px",
            lineHeight: 1.5,
          }}
        >
          Optional. Describe the era, world, art direction, colors, or mood.
        </p>
      </div>

      <textarea
        value={value}
        maxLength={MAX_LENGTH}
        placeholder={
          "Example: a medieval fantasy world with a soft hand-painted watercolor style, forest green and limestone tones, and a quiet, mysterious mood."
        }
        onChange={(event) => { setWorldSetting(event.target.value); setProjectWorldSetting(event.target.value); }}
        style={{
          width: "100%",
          minHeight: "130px",
          resize: "vertical",
          padding: "8px",
          border:
            "1px solid #c8c5bd",
          borderRadius: "3px",
          background: "#ffffff",
          color: "#171717",
          font: "inherit",
          lineHeight: 1.5,
        }}
      />

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          gap: "8px",
          color: "#686868",
          fontSize: "11px",
        }}
      >
        <span>
          Leave blank to use the default generation style
        </span>

        <span>
          {value.length}/{MAX_LENGTH}
        </span>
      </div>
      <button className="primary world-setting-confirm" onClick={confirmWorldSetting}>{project.worldSetting?.confirmed ? "World Setting Confirmed · Edit" : "Confirm World Setting"}</button>
      {project.worldSetting?.confirmed && <small className="confirmed-copy">Confirmed content is included in the next Qwen context.</small>}
    </section>
  );
}
