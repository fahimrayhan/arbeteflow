import type { AppSettings, JobApplication } from './types';

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}

type ApiMessage = { role: 'user' | 'assistant'; content: string };

/* ─── Main router ─────────────────────────────────────────────────────────── */

export async function callModel(
  settings: AppSettings,
  messages: ApiMessage[],
  systemPrompt: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { activeProvider, activeModel, providers } = settings;

  switch (activeProvider) {
    case 'anthropic':
      return callAnthropic(providers.anthropic.apiKey, activeModel, messages, systemPrompt, callbacks);
    case 'openai':
      return callOpenAI(providers.openai.apiKey, activeModel, messages, systemPrompt, callbacks);
    case 'gemini':
      return callGemini(providers.gemini.apiKey, activeModel, messages, systemPrompt, callbacks);
    case 'ollama':
      return callOllama(
        providers.ollama.baseUrl || 'http://localhost:11434',
        activeModel === 'custom' ? providers.ollama.customModel : activeModel,
        messages,
        systemPrompt,
        callbacks,
      );
  }
}

/* ─── Anthropic / Claude ─────────────────────────────────────────────────── */

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: ApiMessage[],
  system: string,
  cb: StreamCallbacks,
): Promise<void> {
  if (!apiKey) return cb.onError('No Anthropic API key. Add it in Settings.');

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: 4096, system, stream: true, messages }),
    });
  } catch (e) {
    return cb.onError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    return cb.onError(err?.error?.message ?? `Anthropic error ${res.status}`);
  }

  await readSSE(res, (data) => {
    if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
      cb.onToken(data.delta.text);
    }
  });
  cb.onDone();
}

/* ─── OpenAI / ChatGPT ───────────────────────────────────────────────────── */

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: ApiMessage[],
  system: string,
  cb: StreamCallbacks,
  baseUrl = 'https://api.openai.com',
): Promise<void> {
  if (!apiKey) return cb.onError('No OpenAI API key. Add it in Settings.');

  const payload = {
    model,
    stream: true,
    max_tokens: 4096,
    messages: [{ role: 'system', content: system }, ...messages],
  };

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return cb.onError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    return cb.onError(err?.error?.message ?? `OpenAI error ${res.status}`);
  }

  await readSSE(res, (data) => {
    const token = data.choices?.[0]?.delta?.content;
    if (token) cb.onToken(token);
  });
  cb.onDone();
}

/* ─── Google Gemini ──────────────────────────────────────────────────────── */

async function callGemini(
  apiKey: string,
  model: string,
  messages: ApiMessage[],
  system: string,
  cb: StreamCallbacks,
): Promise<void> {
  if (!apiKey) return cb.onError('No Gemini API key. Add it in Settings.');

  // Gemini uses "model" role instead of "assistant"
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const payload = {
    system_instruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { maxOutputTokens: 4096 },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return cb.onError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
    return cb.onError(err?.error?.message ?? `Gemini error ${res.status}`);
  }

  await readSSE(res, (data) => {
    const token = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (token) cb.onToken(token);
  });
  cb.onDone();
}

/* ─── Ollama (OpenAI-compatible) ─────────────────────────────────────────── */

async function callOllama(
  baseUrl: string,
  model: string,
  messages: ApiMessage[],
  system: string,
  cb: StreamCallbacks,
): Promise<void> {
  if (!model) return cb.onError('No Ollama model set. Configure it in Settings.');

  // Ollama's OpenAI-compatible endpoint
  return callOpenAI('ollama', model, messages, system, cb, baseUrl.replace(/\/$/, ''));
}

/* ─── SSE streaming helper ───────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readSSE(res: Response, onEvent: (data: any) => void): Promise<void> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onEvent(JSON.parse(raw) as any);
      } catch {
        // malformed chunk — skip
      }
    }
  }
}

/* ─── Prompt builders ────────────────────────────────────────────────────── */

export function buildJobMemory(jobs: JobApplication[]): string {
  if (!jobs.length) return '';
  const lines = jobs.map(
    (j) =>
      `• ${j.company} | ${j.role}${j.location ? ` | ${j.location}` : ''}${j.salary ? ` | ${j.salary}` : ''} | Status: ${j.status.toUpperCase()}${j.appliedDate ? ` | Applied: ${j.appliedDate}` : ''}${j.notes ? `\n  Notes: ${j.notes}` : ''}`,
  );
  return `\n\n---\nUSER'S CURRENT JOB APPLICATIONS (Job Tracker memory — use this context when relevant):\n${lines.join('\n')}\n---`;
}

export const RESUME_SYSTEM = `You are an expert resume/CV coach and professional writer. Your job is to enhance resumes to be more impactful, ATS-friendly, and compelling to hiring managers.

When enhancing a resume:
- Use strong action verbs and quantify achievements where possible
- Improve clarity and conciseness
- Optimize for ATS (Applicant Tracking Systems)
- Tailor language to the target role/industry if provided
- Maintain the same structure but elevate the language
- Add relevant industry keywords naturally
- Fix any grammatical issues

Return the enhanced resume in a clean, well-formatted text format.`;

export const CHAT_SYSTEMS: Record<string, string> = {
  resume: `You are a world-class resume and CV coach with expertise in hiring across tech, finance, healthcare, and other industries. You provide specific, actionable feedback on resumes and CVs.

Your approach:
- Give honest, direct feedback — don't be vague
- Point out specific weaknesses and how to fix them
- Identify missing keywords and sections
- Suggest quantifiable improvements
- Explain WHY changes matter (ATS, recruiter psychology, etc.)
- Be encouraging but realistic

When reviewing documents, be thorough and specific. Ask clarifying questions when needed.`,

  career: `You are a seasoned career advisor and coach who has helped thousands of professionals navigate their careers. You provide practical, honest career guidance.

Your expertise includes:
- Career transitions and pivoting industries
- Skill gap analysis and development plans
- Salary negotiation strategies
- Building professional networks
- Interview preparation and coaching
- Understanding job market trends
- Personal branding and LinkedIn optimization

Give concrete advice with specific action steps. Be direct and honest.`,

  jobcritic: `You are a sharp job market analyst and critic. Your job is to give honest, unfiltered analysis of job postings, company culture, and career moves.

When analyzing jobs:
- Identify red flags in job descriptions (vague language, unrealistic expectations, poor culture signals)
- Evaluate compensation fairness based on role and market
- Spot signs of toxic work environments from job postings
- Assess if a role matches what's described vs. what's likely
- Give your honest opinion on whether to pursue a role
- Highlight what questions to ask in interviews to verify claims

Be direct, even blunt. Professionals deserve honest assessments.`,
};
