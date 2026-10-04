import { config } from "../config.js";
import { HttpError } from "../lib/http.js";

/** Thin client for the Python vector service, with timeouts and safe error messages. */
export async function callJobsService<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; timeoutMs: number },
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${config.jobsServiceUrl}${path}`, {
      method: options.method ?? "POST",
      headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new HttpError(504, "The job search service timed out.");
    }
    throw new HttpError(503, "The job search service is unreachable.");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    const detail = typeof body?.detail === "string" ? body.detail : `HTTP ${response.status}`;
    const status = response.status === 503 ? 503 : 502;

    throw new HttpError(status, `Job search service error: ${detail}`);
  }

  return (await response.json()) as T;
}
