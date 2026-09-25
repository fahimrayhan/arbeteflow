import { config } from "../config.js";
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
  
  const response = await fetch(
  `${config.modelBaseUrl}/v1/chat/completions`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.modelApiKey}`,
    },
    body: JSON.stringify({
      model: config.modelName,
      stream: true,
      temperature: 0.25,
      top_p: 0.9,
      max_tokens: input.maxTokens ?? 450,
      frequency_penalty: 0.35,
      presence_penalty: 0.1,
      messages: [
        {
          role: 'system',
          content: input.systemPrompt,
        },
        ...input.messages,
      ],
    }),
  },
);

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

          const token = chunk.choices?.[0]?.delta?.content;

          if (token) {
            await input.onToken(token);
          }
        }
      }
    }

    if (buffer.trim()) {
      const dataLines = buffer
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      for (const rawData of dataLines) {
        if (!rawData || rawData === "[DONE]") {
          continue;
        }

        const chunk = JSON.parse(rawData) as ChatCompletionChunk;
        const token = chunk.choices?.[0]?.delta?.content;

        if (token) {
          await input.onToken(token);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
