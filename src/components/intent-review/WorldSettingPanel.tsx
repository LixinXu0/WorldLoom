import {
  useDoodleInterpretationStore,
} from "../../store/useDoodleInterpretationStore";


const MAX_LENGTH = 600;


export function WorldSettingPanel() {
  const {
    worldSetting,
    setWorldSetting,
  } = useDoodleInterpretationStore();

  return (
    <section
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
        <h3>整体背景设定</h3>

        <p
          style={{
            marginTop: "6px",
            lineHeight: 1.5,
          }}
        >
          可选。描述地图的时代、世界观、美术风格、色彩或氛围。
        </p>
      </div>

      <textarea
        value={worldSetting}
        maxLength={MAX_LENGTH}
        placeholder={
          "例如：中世纪奇幻世界，柔和的手绘水彩风格，以森林绿色和石灰色为主，整体安静但略带神秘感。"
        }
        onChange={(event) =>
          setWorldSetting(
            event.target.value,
          )
        }
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
          留空时使用默认生成风格
        </span>

        <span>
          {worldSetting.length}/{MAX_LENGTH}
        </span>
      </div>
    </section>
  );
}