import { useState } from "react";
import {
  captureStrokeSnapshot,
  createCanvasDiff,
} from "../../core/image/canvasDiff";
import type { CanvasDiffResult } from "../../core/image/canvasDiff";
import {
  interpretDoodleWithQwen,
} from "../../ai/qwenVisionClient";
import type {
  QwenDoodleInterpretation,
} from "../../ai/qwenVisionClient";
import { useWorldloomStore } from "../../store/useWorldloomStore";
import {
  useDoodleInterpretationStore,
} from "../../store/useDoodleInterpretationStore";

export function CanvasDiffPanel() {
  const { project } = useWorldloomStore();

  const {
    confirmedDoodles,
    confirmDoodle,
    removeConfirmedDoodle,
  } = useDoodleInterpretationStore();

  const [baselineImage, setBaselineImage] =
    useState<string | null>(null);

  const [currentImage, setCurrentImage] =
    useState<string | null>(null);

  const [diffResult, setDiffResult] =
    useState<CanvasDiffResult | null>(null);

  const [qwenResult, setQwenResult] =
    useState<QwenDoodleInterpretation | null>(null);

  const [selectedCandidateIndex, setSelectedCandidateIndex] =
    useState<number | null>(null);

  const [customMeaning, setCustomMeaning] = useState("");
  const [isCallingQwen, setIsCallingQwen] = useState(false);
  const [qwenError, setQwenError] =
    useState<string | null>(null);

  const [message, setMessage] = useState(
    "请先把当前画板设置为基准截图。",
  );

  const width = project.metadata.canvasWidth;
  const height = project.metadata.canvasHeight;

  const takeSnapshot = () =>
    captureStrokeSnapshot(
      project.sketchState.rawStrokes,
      width,
      height,
    );

  const resetInterpretation = () => {
    setQwenResult(null);
    setSelectedCandidateIndex(null);
    setCustomMeaning("");
    setQwenError(null);
    setIsCallingQwen(false);
  };

  const saveBaseline = () => {
    const snapshot = takeSnapshot();

    setBaselineImage(snapshot);
    setCurrentImage(null);
    setDiffResult(null);
    resetInterpretation();

    setMessage(
      "基准截图已保存。现在可以继续绘制新的涂鸦。",
    );
  };

  const compareWithBaseline = async () => {
    if (!baselineImage) {
      setMessage("请先点击“设置当前画板为基准”。");
      return;
    }

    const snapshot = takeSnapshot();

    const result = await createCanvasDiff(
      baselineImage,
      snapshot,
      width,
      height,
    );

    setCurrentImage(snapshot);
    setDiffResult(result);
    resetInterpretation();

    if (result.changedPixelCount === 0) {
      setMessage("没有检测到新增涂鸦。");
    } else {
      setMessage(
        `检测完成，共发现 ${result.changedPixelCount} 个变化像素。`,
      );
    }
  };

  const sendToQwen = async () => {
    if (
      !diffResult ||
      diffResult.changedPixelCount === 0
    ) {
      setQwenError("请先检测有效的新增涂鸦。");
      return;
    }

    setIsCallingQwen(true);
    setQwenError(null);
    setQwenResult(null);
    setSelectedCandidateIndex(null);
    setCustomMeaning("");

    try {
      const result = await interpretDoodleWithQwen(
        diffResult.dataUrl,
      );

      setQwenResult(result);
    } catch (error) {
      setQwenError(
        error instanceof Error
          ? error.message
          : "千问识别失败。",
      );
    } finally {
      setIsCallingQwen(false);
    }
  };

  const confirmSelectedMeaning = () => {
    if (!qwenResult || !diffResult || !currentImage) {
      setQwenError("当前没有可以确认的识别结果。");
      return;
    }

    const trimmedCustomMeaning = customMeaning.trim();

    if (
      selectedCandidateIndex === null &&
      !trimmedCustomMeaning
    ) {
      setQwenError("请选择一个候选含义，或填写自己的含义。");
      return;
    }

    const selectedCandidate =
      selectedCandidateIndex === null
        ? null
        : qwenResult.candidates[selectedCandidateIndex];

    confirmDoodle({
      imageDataUrl: diffResult.dataUrl,
      aiSummary: qwenResult.summary,
      selectedLabel:
        trimmedCustomMeaning ||
        selectedCandidate?.label ||
        "未命名含义",
      selectedDescription:
        trimmedCustomMeaning ||
        selectedCandidate?.description ||
        "",
      source: trimmedCustomMeaning
        ? "custom"
        : "qwen_candidate",
      boundingBox: diffResult.boundingBox,
    });

    setBaselineImage(currentImage);
    setCurrentImage(null);
    setDiffResult(null);
    resetInterpretation();

    setMessage(
      "含义已经确认，当前画板已自动成为下一轮的基准。",
    );
  };

  return (
    <section
      style={{
        width: "100%",
        padding: "12px",
        border: "1px solid #c8c5bd",
        background: "#fbfaf6",
      }}
    >
      <h3 style={{ marginBottom: "10px" }}>
        新增涂鸦识别
      </h3>

      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "8px",
        }}
      >
        <button onClick={saveBaseline}>
          设置当前画板为基准
        </button>

        <button
          className="primary"
          onClick={() => void compareWithBaseline()}
        >
          检测新增涂鸦
        </button>

        <button
          disabled={
            !diffResult ||
            diffResult.changedPixelCount === 0 ||
            isCallingQwen
          }
          onClick={() => void sendToQwen()}
        >
          {isCallingQwen
            ? "千问识别中……"
            : "发送给千问"}
        </button>
      </div>

      <p style={{ margin: "6px 0 10px" }}>
        {message}
      </p>

      {diffResult?.boundingBox && (
        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "10px",
            color: "#686868",
          }}
        >
          <span>
            变化像素：{diffResult.changedPixelCount}
          </span>

          <span>
            裁剪位置：({diffResult.boundingBox.x},{" "}
            {diffResult.boundingBox.y})
          </span>

          <span>
            裁剪尺寸：{diffResult.boundingBox.width} ×{" "}
            {diffResult.boundingBox.height}
          </span>

          <span>
            Base64 长度：{diffResult.base64.length}
          </span>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: "10px",
        }}
      >
        {baselineImage && (
          <Preview
            title="上一张画板"
            image={baselineImage}
          />
        )}

        {currentImage && (
          <Preview
            title="当前画板"
            image={currentImage}
          />
        )}

        {diffResult && (
          <Preview
            title="裁剪后的新增涂鸦"
            image={diffResult.dataUrl}
          />
        )}
      </div>

      {qwenError && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px",
            border: "1px solid #b42318",
            background: "#fff5f5",
            color: "#b42318",
          }}
        >
          {qwenError}
        </div>
      )}

      {qwenResult && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            border: "1px solid #1f7a4f",
            background: "#f1fbf5",
          }}
        >
          <h3>请选择涂鸦含义</h3>

          <p style={{ margin: "8px 0" }}>
            千问理解：{qwenResult.summary}
          </p>

          <div style={{ display: "grid", gap: "8px" }}>
            {qwenResult.candidates.map(
              (candidate, index) => (
                <button
                  key={`${candidate.label}-${index}`}
                  className={
                    selectedCandidateIndex === index
                      ? "active"
                      : ""
                  }
                  onClick={() => {
                    setSelectedCandidateIndex(index);
                    setCustomMeaning("");
                    setQwenError(null);
                  }}
                  style={{
                    padding: "9px",
                    height: "auto",
                    textAlign: "left",
                    display: "grid",
                    gap: "4px",
                  }}
                >
                  <strong>{candidate.label}</strong>
                  <span>{candidate.description}</span>
                  <small>
                    置信度：
                    {Math.round(
                      candidate.confidence * 100,
                    )}
                    %
                  </small>
                </button>
              ),
            )}
          </div>

          <label
            style={{
              display: "grid",
              gap: "5px",
              marginTop: "10px",
            }}
          >
            都不正确？填写自己的含义

            <input
              value={customMeaning}
              onChange={(event) => {
                setCustomMeaning(event.target.value);
                setSelectedCandidateIndex(null);
                setQwenError(null);
              }}
              placeholder="例如：这里是一条通往地下区域的道路"
              style={{
                width: "100%",
                minHeight: "34px",
                padding: "6px 8px",
                border: "1px solid #c8c5bd",
              }}
            />
          </label>

          <button
            className="primary"
            onClick={confirmSelectedMeaning}
            style={{ marginTop: "10px" }}
          >
            确认这个含义
          </button>
        </div>
      )}

      {confirmedDoodles.length > 0 && (
        <div
          style={{
            marginTop: "12px",
            paddingTop: "12px",
            borderTop: "1px solid #c8c5bd",
          }}
        >
          <h3>
            已确认的涂鸦（{confirmedDoodles.length}）
          </h3>

          <div
            style={{
              display: "grid",
              gap: "8px",
              marginTop: "8px",
            }}
          >
            {confirmedDoodles.map((item, index) => (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "90px minmax(0, 1fr) auto",
                  gap: "10px",
                  alignItems: "center",
                  padding: "8px",
                  border: "1px solid #c8c5bd",
                  background: "#ffffff",
                }}
              >
                <img
                  src={item.imageDataUrl}
                  alt={item.selectedLabel}
                  style={{
                    width: "90px",
                    height: "65px",
                    objectFit: "contain",
                    border: "1px solid #ddd",
                  }}
                />

                <div>
                  <strong>
                    {index + 1}. {item.selectedLabel}
                  </strong>

                  <p style={{ marginTop: "3px" }}>
                    {item.selectedDescription}
                  </p>

                  <small>
                    来源：
                    {item.source === "custom"
                      ? "玩家输入"
                      : "千问候选"}
                  </small>
                </div>

                <button
                  onClick={() =>
                    removeConfirmedDoodle(item.id)
                  }
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Preview({
  title,
  image,
}: {
  title: string;
  image: string;
}) {
  return (
    <div>
      <strong>{title}</strong>

      <div
        style={{
          height: "230px",
          marginTop: "5px",
          border: "1px solid #c8c5bd",
          background: "#ffffff",
          display: "grid",
          placeItems: "center",
          overflow: "hidden",
        }}
      >
        <img
          src={image}
          alt={title}
          style={{
            display: "block",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    </div>
  );
}