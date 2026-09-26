import { getModelConfig } from '../modelConfig.js';

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamTokenHandler = (
  token: string,
) => Promise<void> | void;

type ChatCompletionChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function streamLlmResponse(input: {
  systemPrompt: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  maxTokens?: number;
  onToken: StreamTokenHandler;
}): Promise<void> {
  const modelConfig = await getModelConfig();
  const baseUrl = modelConfig.baseUrl.replace(/\/+$/, '');
  const maxTokens = input.maxTokens ?? 450;
  const messages = [
    { role: 'system' as const, content: input.systemPrompt },
    ...input.messages,
  ];
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let url: string;
  let body: Record<string, unknown>;

  if (modelConfig.provider === 'anthropic') {
    url = `${baseUrl}/v1/messages`;
    headers['x-api-key'] = modelConfig.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    body = {
      model: modelConfig.model,
      max_tokens: maxTokens,
      stream: true,
      system: input.systemPrompt,
      messages: input.messages,
    };
  } else if (modelConfig.provider === 'ollama') {
    url = `${baseUrl}/api/chat`;
    body = {
      model: modelConfig.model,
      stream: true,
      messages,
      options: { temperature: 0.25, num_predict: maxTokens },
    };
  } else {
    url = `${baseUrl.replace(/\/v1$/, '')}/v1/chat/completions`;
    if (modelConfig.apiKey) headers.Authorization = `Bearer ${modelConfig.apiKey}`;
    body = {
      model: modelConfig.model,
      stream: true,
      temperature: 0.25,
      top_p: 0.9,
      max_tokens: maxTokens,
      messages,
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => "");

    throw new Error(
      `Model server request failed: HTTP ${response.status}${
        responseText ? ` — ${responseText}` : ""
      }`,
    );
  }

  if (!response.body) {
    throw new Error("Model server returned an empty response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      if (modelConfig.provider === 'ollama') {
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const chunk = JSON.parse(line) as { message?: { content?: string }; error?: string };
          if (chunk.error) throw new Error(chunk.error);
          if (chunk.message?.content) await input.onToken(chunk.message.content);
        }
        continue;
      }

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const dataLines = event
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim());

        for (const rawData of dataLines) {
          if (!rawData || rawData === "[DONE]") {
            continue;
          }

          let chunk: ChatCompletionChunk;

          try {
            chunk = JSON.parse(rawData) as ChatCompletionChunk;
          } catch {
            continue;
          }

          if (chunk.error?.message) {
            throw new Error(chunk.error.message);
          }

          const token = modelConfig.provider === 'anthropic'
            ? (JSON.parse(rawData) as { type?: string; delta?: { text?: string } }).delta?.text
            : chunk.choices?.[0]?.delta?.content;

          if (token) {
            await input.onToken(token);
          }
        }
      }
    }

    if (buffer.trim() && modelConfig.provider === 'ollama') {
      for (const line of buffer.split('\n')) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as { message?: { content?: string }; error?: string };
        if (chunk.error) throw new Error(chunk.error);
        if (chunk.message?.content) await input.onToken(chunk.message.content);
      }
    } else if (buffer.trim()) {
      const dataLines = buffer
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      for (const rawData of dataLines) {
        if (!rawData || rawData === "[DONE]") {
          continue;
        }

        const chunk = JSON.parse(rawData) as ChatCompletionChunk & { delta?: { text?: string } };
        const token = modelConfig.provider === 'anthropic'
          ? chunk.delta?.text
          : chunk.choices?.[0]?.delta?.content;

        if (token) {
          await input.onToken(token);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
