import type {
  InterviewDifficulty,
  InterviewType,
  JobApplication,
  JobStatus,
  Message,
} from "./types";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787";

const DEVELOPMENT_USER_ID =
  import.meta.env.VITE_DEVELOPMENT_USER_ID ?? "manolis-local-dev";

type ApiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ApiResume = {
  id: string;
  title: string;
  rawText: string;
  enhancedText?: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ApiInterview = {
  id: string;
  role: string;
  company: string;
  jobDescription: string;
  interviewType: InterviewType;
  difficulty: InterviewDifficulty;
  resumeId?: string;
  status: "active" | "completed";
  messages: ApiMessage[];
  feedback?: {
    overallScore: number;
    strengths: string[];
    improvements: string[];
    suggestedAnswers: string[];
    preparationPlan: string[];
  };
  createdAt: string;
  updatedAt: string;
};

type SseDoneData = {
  messageId?: string;
  completed?: boolean;
};

function headers(): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-user-id": DEVELOPMENT_USER_ID,
  };
}

async function readApiError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);

  return body?.error ?? `Request failed with HTTP ${response.status}.`;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...headers(),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  return response.json() as Promise<T>;
}

function jobFromApi(job: Record<string, unknown>): JobApplication {
  return {
    id: String(job.id),
    company: String(job.company ?? ""),
    role: String(job.role ?? ""),
    location: String(job.location ?? ""),
    status: job.status as JobStatus,
    salary: String(job.salary ?? ""),
    appliedDate: String(job.appliedDate ?? ""),
    deadline: String(job.deadline ?? ""),
    notes: String(job.notes ?? ""),
    url: String(job.url ?? ""),
    jobDescription: String(job.jobDescription ?? ""),
  };
}

export async function getPrimaryResume(): Promise<ApiResume | null> {
  const response = await request<{ resume: ApiResume | null }>(
    "/api/resume/primary",
  );

  return response.resume;
}

export async function savePrimaryResume(input: {
  title?: string;
  rawText: string;
  enhancedText?: string;
}): Promise<ApiResume> {
  const response = await request<{ resume: ApiResume }>(
    "/api/resume/primary",
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  );

  return response.resume;
}

export async function streamResumeEnhancement(
  input: {
    resumeText: string;
    targetRole?: string;
    industry?: string;
  },
  onToken: (token: string) => void,
): Promise<void> {
  await streamSseResponse(
    "/api/resume/enhance",
    input,
    onToken,
  );
}

export async function streamCoverLetterGeneration(
  input: {
    company: string;
    role: string;
    jobDescription?: string;
    resumeText?: string;
    tone: "professional" | "confident" | "warm";
  },
  onToken: (token: string) => void,
): Promise<void> {
  await streamSseResponse(
    "/api/cover-letter/generate",
    input,
    onToken,
  );
}

export type ModelProvider =
  | 'vllm'
  | 'ollama'
  | 'openai'
  | 'anthropic';

export type PublicModelConfig = {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  updatedAt: string;
};

export async function getModelSettings(): Promise<PublicModelConfig> {
  const response = await request<{
    config: PublicModelConfig;
  }>('/api/settings/model');

  return response.config;
}

export async function saveModelSettings(input: {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
}): Promise<PublicModelConfig> {
  const response = await request<{
    config: PublicModelConfig;
  }>('/api/settings/model', {
    method: 'PUT',
    body: JSON.stringify(input),
  });

  return response.config;
}

export async function getJobs(): Promise<JobApplication[]> {
  const response = await request<{ jobs: Record<string, unknown>[] }>(
    "/api/jobs",
  );

  return response.jobs.map(jobFromApi);
}

export async function createJob(
  input: Omit<JobApplication, "id">,
): Promise<JobApplication> {
  const response = await request<{ job: Record<string, unknown> }>(
    "/api/jobs",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return jobFromApi(response.job);
}

export async function updateJob(
  jobId: string,
  input: Partial<Omit<JobApplication, "id">>,
): Promise<JobApplication> {
  const response = await request<{ job: Record<string, unknown> }>(
    `/api/jobs/${jobId}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );

  return jobFromApi(response.job);
}

export async function deleteJob(jobId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`, {
    method: "DELETE",
    headers: headers(),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }
}

export async function createCoachSession(
  mode: "resume" | "career" | "jobcritic",
): Promise<{
  id: string;
  mode: string;
  messages: ApiMessage[];
}> {
  const response = await request<{
    session: {
      id: string;
      mode: string;
      messages: ApiMessage[];
    };
  }>("/api/chat/sessions", {
    method: "POST",
    body: JSON.stringify({ mode }),
  });

  return response.session;
}

export async function getCoachSession(sessionId: string): Promise<{
  id: string;
  mode: string;
  messages: ApiMessage[];
}> {
  const response = await request<{
    session: {
      id: string;
      mode: string;
      messages: ApiMessage[];
    };
  }>(`/api/chat/sessions/${sessionId}`);

  return response.session;
}

export async function streamCoachMessage(
  sessionId: string,
  content: string,
  onToken: (token: string) => void,
): Promise<SseDoneData> {
  return streamSseResponse(
    `/api/chat/sessions/${sessionId}/messages`,
    { content },
    onToken,
  );
}

export async function createInterview(input: {
  role: string;
  company?: string;
  jobDescription?: string;
  interviewType: InterviewType;
  difficulty: InterviewDifficulty;
  resumeId?: string;
}): Promise<ApiInterview> {
  const response = await request<{ interview: ApiInterview }>(
    "/api/interviews",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return response.interview;
}

export async function getInterview(
  interviewId: string,
): Promise<ApiInterview> {
  const response = await request<{ interview: ApiInterview }>(
    `/api/interviews/${interviewId}`,
  );

  return response.interview;
}

export async function streamInterviewMessage(
  interviewId: string,
  content: string,
  onToken: (token: string) => void,
): Promise<SseDoneData> {
  return streamSseResponse(
    `/api/interviews/${interviewId}/messages`,
    { content },
    onToken,
  );
}

async function streamSseResponse(
  path: string,
  body: Record<string, unknown>,
  onToken: (token: string) => void,
): Promise<SseDoneData> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  if (!response.body) {
    throw new Error("The server returned an empty streaming response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneData: SseDoneData = {};

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
        processSseEvent(event, onToken, (data) => {
          doneData = data;
        });
      }
    }

    if (buffer.trim()) {
      processSseEvent(buffer, onToken, (data) => {
        doneData = data;
      });
    }

    return doneData;
  } finally {
    reader.releaseLock();
  }
}

function processSseEvent(
  event: string,
  onToken: (token: string) => void,
  onDone: (data: SseDoneData) => void,
): void {
  const eventName =
    event
      .split("\n")
      .find((line) => line.startsWith("event:"))
      ?.slice(6)
      .trim() ?? "";

  const rawData =
    event
      .split("\n")
      .find((line) => line.startsWith("data:"))
      ?.slice(5)
      .trim() ?? "";

  if (!rawData) {
    return;
  }

  const data = JSON.parse(rawData) as {
    token?: string;
    error?: string;
    messageId?: string;
    completed?: boolean;
  };

  if (eventName === "error") {
    throw new Error(data.error ?? "Streaming request failed.");
  }

  if (eventName === "token" && data.token) {
    onToken(data.token);
  }

  if (eventName === "done") {
    onDone({
      messageId: data.messageId,
      completed: data.completed,
    });
  }
}

export function apiMessagesToUiMessages(
  messages: ApiMessage[],
): Message[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: new Date(message.createdAt),
  }));
}