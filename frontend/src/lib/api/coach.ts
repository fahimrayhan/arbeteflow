import type { ApiCoachSession, ChatMode } from '../types';
import { jsonBody, request } from './client';
import { streamSse, type SseDoneData, type TokenHandler } from './sse';

export async function createCoachSession(mode: ChatMode): Promise<ApiCoachSession> {
  const response = await request<{ session: ApiCoachSession }>(
    '/api/chat/sessions',
    jsonBody('POST', { mode }),
  );
  return response.session;
}

export async function getCoachSession(sessionId: string): Promise<ApiCoachSession> {
  const response = await request<{ session: ApiCoachSession }>(
    `/api/chat/sessions/${encodeURIComponent(sessionId)}`,
  );
  return response.session;
}

export function streamCoachMessage(
  sessionId: string,
  content: string,
  onToken: TokenHandler,
): Promise<SseDoneData> {
  return streamSse(
    `/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    { content },
    onToken,
  );
}
