import { config } from "../config.js";

/*
  Web research about an employer, used to make cover letters more specific.

  Uses the Tavily search API (https://tavily.com). Only search result snippets
  are used — the server never fetches the web pages itself, which keeps it out
  of SSRF territory and bounds how much untrusted text reaches the prompt.
  Swapping providers means replacing `searchTavily` only.
*/

export interface ResearchSource {
  title: string;
  url: string;
}

export interface CompanyResearch {
  /** Compact, prompt-ready text: an optional summary plus numbered snippets. */
  context: string;
  sources: ResearchSource[];
}

type TavilyResult = { title?: unknown; url?: unknown; content?: unknown };
type TavilyResponse = { answer?: unknown; results?: unknown };

const MAX_RESULTS = 5;
const MAX_SNIPPET_CHARS = 600;
const MAX_CONTEXT_CHARS = 3_500;

export class ResearchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchError";
  }
}

export function isResearchAvailable(): boolean {
  return Boolean(config.research.tavilyApiKey);
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/** Collapses whitespace and strips control characters from third-party text. */
function clean(value: unknown, limit: number): string {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

async function searchTavily(query: string): Promise<TavilyResponse> {
  let response: Response;

  try {
    response = await fetch(`${config.research.tavilyApiUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.research.tavilyApiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        topic: "general",
        max_results: MAX_RESULTS,
        include_answer: true,
        include_raw_content: false,
        include_images: false,
      }),
      signal: AbortSignal.timeout(config.research.timeoutMs),
    });
  } catch (error) {
    throw new ResearchError(
      error instanceof Error && error.name === "TimeoutError"
        ? "The web search timed out."
        : "The web search service could not be reached.",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new ResearchError("The Tavily API key was rejected. Check TAVILY_API_KEY.");
  }
  if (response.status === 429 || response.status === 432 || response.status === 433) {
    throw new ResearchError("The Tavily usage limit has been reached.");
  }
  if (!response.ok) {
    throw new ResearchError(`The web search failed (HTTP ${response.status}).`);
  }

  return (await response.json()) as TavilyResponse;
}

export async function researchCompany(input: {
  company: string;
  role?: string;
}): Promise<CompanyResearch> {
  if (!isResearchAvailable()) {
    throw new ResearchError("Company research is not configured (TAVILY_API_KEY is not set).");
  }

  const company = clean(input.company, 200);
  const query = `"${company}" company: what they do, products or services, mission and values, culture, recent news`;
  const data = await searchTavily(query);

  const results = (Array.isArray(data.results) ? (data.results as TavilyResult[]) : [])
    .map((result) => ({
      title: clean(result.title, 200) || "Untitled",
      url: clean(result.url, 2_000),
      snippet: clean(result.content, MAX_SNIPPET_CHARS),
    }))
    .filter((result) => isHttpUrl(result.url) && result.snippet);

  const summary = clean(data.answer, 800);

  if (!results.length && !summary) {
    throw new ResearchError(`No web results were found for "${company}".`);
  }

  const parts = [
    summary ? `Summary: ${summary}` : "",
    ...results.map((result, index) => `[${index + 1}] ${result.title} (${result.url})\n${result.snippet}`),
  ].filter(Boolean);

  return {
    context: parts.join("\n\n").slice(0, MAX_CONTEXT_CHARS),
    sources: results.map(({ title, url }) => ({ title, url })),
  };
}
