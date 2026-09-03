export interface StructuredLLMProvider {
  completeStructured<T>(systemPrompt: string, userPrompt: string, schema: unknown): Promise<T>;
}

export class MissingProvider implements StructuredLLMProvider {
  async completeStructured<T>(): Promise<T> {
    throw new Error("No structured LLM provider is configured. Use MockAIInterpreter for local runs.");
  }
}
