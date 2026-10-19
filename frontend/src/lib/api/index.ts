import type { ApiMessage, Message } from '../types';

export * from './coach';
export * from './coverLetter';
export * from './finder';
export * from './interviews';
export * from './jobs';
export * from './resume';
export * from './settings';

export function apiMessagesToUiMessages(messages: ApiMessage[]): Message[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    timestamp: new Date(message.createdAt),
  }));
}
