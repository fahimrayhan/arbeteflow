import { config } from "../config.js";
import { HttpError } from "../lib/http.js";
import type { StoredModelConfig } from "../types.js";
import { getModelConfig } from "./modelConfig.js";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type StreamTokenHandler = (token: string) => Promise<void> | void;

type ProviderRequest = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
  /** NDJSON (one JSON object per line) or SSE (`data:` events). */
  framing: "ndjson" | "sse";
  /** Extracts the text token from one parsed chunk; throws on provider errors. */
  extractToken: (chunk: unknown) => string | undefined;
};

type RequestInput = {
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens: number;
};

const MAX_ERROR_DETAIL_LENGTH = 300;

function readError(chunk: unknown): string | undefined {
  if (typeof chunk !== "object" || chunk === null || !("error" in chunk)) {
    return undefined;
  }

  const { error } = chunk as { error: unknown };

  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  return "The model server reported an error.";
}

function buildAnthropicRequest(model: StoredModelConfig, input: RequestInput): ProviderRequest {
  return {
    url: `${model.baseUrl}/v1/messages`,
    headers: {
      "x-api-key": model.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: {
      model: model.model,
      max_tokens: input.maxTokens,
      stream: true,
      system: input.systemPrompt,
      messages: input.messages,
    },
    framing: "sse",
    extractToken(chunk) {
      const error = readError(chunk);
      if (error) throw new HttpError(502, `Model error: ${error}`);

      const event = chunk as { type?: string; delta?: { type?: string; text?: string } };
      return event.type === "content_block_delta" ? event.delta?.text : undefined;
    },
  };
}

function buildOllamaRequest(model: StoredModelConfig, input: RequestInput): ProviderRequest {
  return {
    url: `${model.baseUrl}/api/chat`,
    // Local Ollama needs no key; Ollama's hosted API (https://ollama.com) expects a Bearer token.
    headers: model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {},
    body: {
      model: model.model,
      stream: true,
      messages: [{ role: "system", content: input.systemPrompt }, ...input.messages],
      options: { temperature: 0.25, num_predict: input.maxTokens },
    },
    framing: "ndjson",
    extractToken(chunk) {
      const error = readError(chunk);
      if (error) throw new HttpError(502, `Model error: ${error}`);

      return (chunk as { message?: { content?: string } }).message?.content;
    },
  };
}

/** vLLM and OpenAI both speak the OpenAI chat-completions protocol. */
function buildOpenAiCompatibleRequest(
  model: StoredModelConfig,
  input: RequestInput,
): ProviderRequest {
  return {
    url: `${model.baseUrl.replace(/\/v1$/, "")}/v1/chat/completions`,
    headers: model.apiKey ? { Authorization: `Bearer ${model.apiKey}` } : {},
    body: {
      model: model.model,
      stream: true,
      temperature: 0.25,
      top_p: 0.9,
      max_tokens: input.maxTokens,
      messages: [{ role: "system", content: input.systemPrompt }, ...input.messages],
    },
    framing: "sse",
    extractToken(chunk) {
      const error = readError(chunk);
      if (error) throw new HttpError(502, `Model error: ${error}`);

      return (chunk as { choices?: Array<{ delta?: { content?: string } }> }).choices?.[0]?.delta
        ?.content;
    },
  };
}

function buildProviderRequest(model: StoredModelConfig, input: RequestInput): ProviderRequest {
  const normalised = { ...model, baseUrl: model.baseUrl.replace(/\/+$/, "") };

  switch (model.provider) {
    case "anthropic":
      return buildAnthropicRequest(normalised, input);
    case "ollama":
      return buildOllamaRequest(normalised, input);
    case "openai":
    case "vllm":
      return buildOpenAiCompatibleRequest(normalised, input);
  }
}

/** Splits a stream buffer into complete JSON payloads, returning the unfinished remainder. */
function extractPayloads(
  buffer: string,
  framing: ProviderRequest["framing"],
  flush: boolean,
): { payloads: string[]; rest: string } {
  const separator = framing === "ndjson" ? "\n" : "\n\n";
  const parts = buffer.split(separator);
  const rest = flush ? "" : (parts.pop() ?? "");

  const payloads =
    framing === "ndjson"
      ? parts.map((line) => line.trim())
      : parts.flatMap((event) =>
          event
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim()),
        );

  return {
    payloads: payloads.filter((payload) => payload && payload !== "[DONE]"),
    rest,
  };
}

function parseChunk(payload: string): unknown {
  try {
    return JSON.parse(payload);
  } catch {
    // Providers occasionally send keep-alive or comment lines; skip them.
    return undefined;
  }
}

export async function streamLlmResponse(input: {
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  onToken: StreamTokenHandler;
  /** Abort when the client goes away so the model stops generating. */
  signal?: AbortSignal;
}): Promise<void> {
  const modelConfig = await getModelConfig();
  const request = buildProviderRequest(modelConfig, {
    systemPrompt: input.systemPrompt,
    // Only role/content are sent; stored messages carry extra fields.
    messages: input.messages.map(({ role, content }) => ({ role, content })),
    maxTokens: input.maxTokens ?? 450,
  });

  const timeoutSignal = AbortSignal.timeout(config.modelTimeoutMs);
  const signal = input.signal ? AbortSignal.any([input.signal, timeoutSignal]) : timeoutSignal;

  let response: Response;

  try {
    response = await fetch(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...request.headers },
      body: JSON.stringify(request.body),
      signal,
    });
  } catch (error) {
    if (timeoutSignal.aborted) {
      throw new HttpError(504, "The model server did not respond in time.");
    }
    if (input.signal?.aborted) {
      throw error;
    }
    throw new HttpError(
      502,
      `Could not reach the model server at ${modelConfig.baseUrl}. Check the provider settings.`,
    );
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, MAX_ERROR_DETAIL_LENGTH);

    throw new HttpError(
      502,
      `Model server request failed: HTTP ${response.status}${detail ? ` — ${detail}` : ""}`,
    );
  }

  if (!response.body) {
    throw new HttpError(502, "Model server returned an empty response body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const emit = async (payloads: string[]) => {
    for (const payload of payloads) {
      const token = request.extractToken(parseChunk(payload));
      if (token) {
        await input.onToken(token);
      }
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const { payloads, rest } = extractPayloads(buffer, request.framing, false);
      buffer = rest;
      await emit(payloads);
    }

    buffer += decoder.decode();
    await emit(extractPayloads(buffer, request.framing, true).payloads);
  } catch (error) {
    // Close the upstream connection so the model stops generating.
    await reader.cancel().catch(() => undefined);

    if (timeoutSignal.aborted) {
      throw new HttpError(504, "The model response took too long and was stopped.");
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}
