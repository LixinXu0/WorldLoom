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
    "Set the current canvas as the baseline screenshot first.",
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
      "Baseline saved. You can now draw new sketch marks.",
    );
  };

  const compareWithBaseline = async () => {
    if (!baselineImage) {
      setMessage("Click “Set Current Canvas as Baseline” first.");
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
      setMessage("No new sketch marks were detected.");
    } else {
      setMessage(
        `Detection complete: ${result.changedPixelCount} changed pixels found.`,
      );
    }
  };

  const sendToQwen = async () => {
    if (
      !diffResult ||
      diffResult.changedPixelCount === 0
    ) {
      setQwenError("Detect valid new sketch marks first.");
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
          : "Qwen interpretation failed.",
      );
    } finally {
      setIsCallingQwen(false);
    }
  };

  const confirmSelectedMeaning = () => {
    if (!qwenResult || !diffResult || !currentImage) {
      setQwenError("There is no interpretation result to confirm.");
      return;
    }

    const trimmedCustomMeaning = customMeaning.trim();

    if (
      selectedCandidateIndex === null &&
      !trimmedCustomMeaning
    ) {
      setQwenError("Select a candidate interpretation or enter your own.");
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
        "Unnamed interpretation",
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
      "Interpretation confirmed. The current canvas is now the baseline for the next round.",
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
        New Sketch Interpretation
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
          Set Current Canvas as Baseline
        </button>

        <button
          className="primary"
          onClick={() => void compareWithBaseline()}
        >
          Detect New Sketch Marks
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
            ? "Qwen is interpreting..."
            : "Send to Qwen"}
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
            Changed pixels: {diffResult.changedPixelCount}
          </span>

          <span>
            Crop position: ({diffResult.boundingBox.x},{" "}
            {diffResult.boundingBox.y})
          </span>

          <span>
            Crop size: {diffResult.boundingBox.width} ×{" "}
            {diffResult.boundingBox.height}
          </span>

          <span>
            Base64 length: {diffResult.base64.length}
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
            title="Previous canvas"
            image={baselineImage}
          />
        )}

        {currentImage && (
          <Preview
            title="Current canvas"
            image={currentImage}
          />
        )}

        {diffResult && (
          <Preview
            title="Cropped new sketch"
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
          <h3>Select a sketch interpretation</h3>

          <p style={{ margin: "8px 0" }}>
            Qwen interpretation: {qwenResult.summary}
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
                    Confidence:
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
            None of these? Enter your own interpretation

            <input
              value={customMeaning}
              onChange={(event) => {
                setCustomMeaning(event.target.value);
                setSelectedCandidateIndex(null);
                setQwenError(null);
              }}
              placeholder="Example: a path leading to an underground area"
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
            Confirm This Interpretation
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
            Confirmed Sketches ({confirmedDoodles.length})
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
                    Source:
                    {item.source === "custom"
                      ? "Player input"
                      : "Qwen candidate"}
                  </small>
                </div>

                <button
                  onClick={() =>
                    removeConfirmedDoodle(item.id)
                  }
                >
                  Delete
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
