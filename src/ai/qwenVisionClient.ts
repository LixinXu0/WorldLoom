export type QwenDoodleCandidate = {
  label: string;
  description: string;
  confidence: number;
};

export type QwenDoodleInterpretation = {
  summary: string;
  candidates: QwenDoodleCandidate[];
};

type QwenAPIResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: string;
  details?: string;
};

function cleanJsonText(text: string): string {
  const withoutMarkdown = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = withoutMarkdown.indexOf("{");
  const lastBrace = withoutMarkdown.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("千问没有返回有效的 JSON。");
  }

  return withoutMarkdown.slice(firstBrace, lastBrace + 1);
}

function validateInterpretation(
  value: unknown,
): QwenDoodleInterpretation {
  if (!value || typeof value !== "object") {
    throw new Error("千问返回的数据格式不正确。");
  }

  const result = value as {
    summary?: unknown;
    candidates?: unknown;
  };

  if (
    typeof result.summary !== "string" ||
    !Array.isArray(result.candidates)
  ) {
    throw new Error("千问返回的数据缺少候选含义。");
  }

  const candidates = result.candidates
    .filter(
      (candidate): candidate is {
        label: string;
        description: string;
        confidence: number;
      } => {
        if (!candidate || typeof candidate !== "object") {
          return false;
        }

        const item = candidate as Record<string, unknown>;

        return (
          typeof item.label === "string" &&
          typeof item.description === "string" &&
          typeof item.confidence === "number"
        );
      },
    )
    .slice(0, 3)
    .map((candidate) => ({
      label: candidate.label,
      description: candidate.description,
      confidence: Math.max(
        0,
        Math.min(1, candidate.confidence),
      ),
    }));

  if (candidates.length === 0) {
    throw new Error("千问没有返回可用的候选含义。");
  }

  return {
    summary: result.summary,
    candidates,
  };
}

export async function interpretDoodleWithQwen(
  imageDataUrl: string,
  prompt?: string,
): Promise<QwenDoodleInterpretation> {
  const response = await fetch("/api/qwen/interpret", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageDataUrl,
      prompt,
    }),
  });

  const data = (await response.json()) as QwenAPIResponse;

  if (!response.ok) {
    throw new Error(
      data.details
        ? `${data.error ?? "千问请求失败"}：${data.details}`
        : data.error ?? "千问请求失败。",
    );
  }

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("千问没有返回识别结果。");
  }

  const jsonText = cleanJsonText(content);
  const parsed = JSON.parse(jsonText) as unknown;

  return validateInterpretation(parsed);
}