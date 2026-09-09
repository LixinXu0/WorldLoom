export type ModelInterpretationResponse = {
  title?: string;
  summary?: string;
  confidence?: number;
  dimensions?: Record<string, number>;
  alternative_readings?: Array<{ label?: string; summary?: string; rationale?: string }>;
  candidates?: Array<{ name?: string; type?: string; description?: string; confidence?: number; dimensions?: Record<string, number> }>;
  questions?: Array<string | { question?: string; rationale?: string }>;
  source?: "model";
  model?: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Model request failed (${response.status})`,
    );
  }
  return payload as T;
}

export function requestModelInterpretation(context: unknown): Promise<ModelInterpretationResponse> {
  return postJson<ModelInterpretationResponse>("/api/interpret", context);
}

export function requestGenerationContract(context: unknown): Promise<{ source?: "model"; contract?: unknown }> {
  return postJson<{ source?: "model"; contract?: unknown }>("/api/generate-contract", context);
}
