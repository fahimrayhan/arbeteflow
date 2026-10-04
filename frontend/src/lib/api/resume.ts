import type { ApiResume } from '../types';
import { jsonBody, request } from './client';
import { streamSse, type TokenHandler } from './sse';

export async function getPrimaryResume(): Promise<ApiResume | null> {
  const response = await request<{ resume: ApiResume | null }>('/api/resume/primary');
  return response.resume;
}

export async function savePrimaryResume(input: {
  title?: string;
  rawText: string;
  enhancedText?: string;
}): Promise<ApiResume> {
  const response = await request<{ resume: ApiResume }>(
    '/api/resume/primary',
    jsonBody('PUT', input),
  );
  return response.resume;
}

export async function deletePrimaryResume(): Promise<void> {
  await request<void>('/api/resume/primary', { method: 'DELETE' });
}

export async function streamResumeEnhancement(
  input: { resumeText: string; targetRole?: string; industry?: string },
  onToken: TokenHandler,
): Promise<void> {
  await streamSse('/api/resume/enhance', input, onToken);
}
