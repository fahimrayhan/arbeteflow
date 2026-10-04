import type { CoverLetterTone, ResearchEvent } from '../types';
import { request } from './client';
import { streamSse, type TokenHandler } from './sse';

export async function getCoverLetterCapabilities(): Promise<{ companyResearch: boolean }> {
  return request<{ companyResearch: boolean }>('/api/cover-letter/capabilities');
}

export async function streamCoverLetterGeneration(
  input: {
    company: string;
    role: string;
    jobDescription?: string;
    resumeText?: string;
    tone: CoverLetterTone;
    /** Search the web for the company first (needs TAVILY_API_KEY on the server). */
    researchCompany?: boolean;
  },
  onToken: TokenHandler,
  onResearch?: (event: ResearchEvent) => void,
): Promise<void> {
  await streamSse('/api/cover-letter/generate', input, onToken, {
    onEvent: (event, data) => {
      if (event === 'research') onResearch?.(data as ResearchEvent);
    },
  });
}
