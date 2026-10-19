import { apiFetch } from './client';

export type TokenHandler = (token: string) => void;

export type SseDoneData = {
  messageId?: string;
  completed?: boolean;
};

type SsePayload = {
  token?: string;
  error?: string;
  messageId?: string;
  completed?: boolean;
};

function parseEvent(block: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of block.replace(/\r/g, '').split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }

  return dataLines.length ? { event, data: dataLines.join('\n') } : null;
}

export type StreamOptions = {
  signal?: AbortSignal;
  /** Receives any event other than token/done/error (e.g. `research`), with its parsed data. */
  onEvent?: (event: string, data: unknown) => void;
};

/**
 * POSTs `body` and consumes the Server-Sent Events response:
 * `token` events go to `onToken`, an `error` event throws, other events go to
 * `options.onEvent`, and the payload of the `done` event is returned.
 */
export async function streamSse(
  path: string,
  body: unknown,
  onToken: TokenHandler,
  options: StreamOptions = {},
): Promise<SseDoneData> {
  const response = await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.body) {
    throw new Error('The server returned an empty streaming response.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let doneData: SseDoneData = {};

  const handleEvent = (block: string) => {
    const parsed = parseEvent(block);
    if (!parsed) return;

    let data: SsePayload;
    try {
      data = JSON.parse(parsed.data) as SsePayload;
    } catch {
      return;
    }

    if (parsed.event === 'error') {
      throw new Error(data.error ?? 'Streaming request failed.');
    }
    if (parsed.event === 'token' && data.token) {
      onToken(data.token);
    }
    if (parsed.event === 'done') {
      doneData = { messageId: data.messageId, completed: data.completed };
    } else if (parsed.event !== 'token') {
      options.onEvent?.(parsed.event, data);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';
      events.forEach(handleEvent);
    }

    buffer += decoder.decode();
    if (buffer.trim()) handleEvent(buffer);

    return doneData;
  } finally {
    reader.releaseLock();
  }
}
