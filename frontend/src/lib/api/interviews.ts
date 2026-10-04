import type { ApiInterview, InterviewDifficulty, InterviewType } from '../types';
import { jsonBody, request } from './client';
import { streamSse, type SseDoneData, type TokenHandler } from './sse';

export async function createInterview(input: {
  role: string;
  company?: string;
  jobDescription?: string;
  interviewType: InterviewType;
  difficulty: InterviewDifficulty;
  resumeId?: string;
}): Promise<ApiInterview> {
  const response = await request<{ interview: ApiInterview }>(
    '/api/interviews',
    jsonBody('POST', input),
  );
  return response.interview;
}

export async function getInterview(interviewId: string): Promise<ApiInterview> {
  const response = await request<{ interview: ApiInterview }>(
    `/api/interviews/${encodeURIComponent(interviewId)}`,
  );
  return response.interview;
}

export function streamInterviewMessage(
  interviewId: string,
  content: string,
  onToken: TokenHandler,
): Promise<SseDoneData> {
  return streamSse(
    `/api/interviews/${encodeURIComponent(interviewId)}/messages`,
    { content },
    onToken,
  );
}
