import type { Request, Response } from "express";
import { publicErrorMessage } from "./http.js";

export interface SseStream {
  send(event: string, data: unknown): void;
  /** Aborted when the client disconnects, so upstream work can stop early. */
  signal: AbortSignal;
}

/**
 * Opens a Server-Sent Events response and runs `work` inside it.
 *
 * Errors thrown before the first byte is flushed still go through the normal
 * Express error handler (correct HTTP status). Errors thrown afterwards are
 * delivered as an `error` event, because the status line is already sent.
 */
export async function runSseStream(
  req: Request,
  res: Response,
  work: (stream: SseStream) => Promise<void>,
  fallbackErrorMessage: string,
): Promise<void> {
  const controller = new AbortController();

  res.on("close", () => {
    if (!res.writableFinished) {
      controller.abort();
    }
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const stream: SseStream = {
    signal: controller.signal,
    send(event, data) {
      if (!res.headersSent) {
        res.flushHeaders();
      }

      if (!res.writableEnded && !controller.signal.aborted) {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      }
    },
  };

  try {
    await work(stream);
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }

    if (!res.headersSent) {
      throw error;
    }

    console.error(`[sse] ${req.method} ${req.originalUrl}:`, error);
    stream.send("error", { error: publicErrorMessage(error, fallbackErrorMessage) });
  } finally {
    if (res.headersSent && !res.writableEnded) {
      res.end();
    }
  }
}
