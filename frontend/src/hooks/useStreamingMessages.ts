import { useCallback, useState } from 'react';
import type { Message } from '../lib/types';

export function createUiMessage(role: Message['role'], content = ''): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date(),
  };
}

/** Message list state with helpers for streaming a reply into a placeholder message. */
export function useStreamingMessages() {
  const [messages, setMessages] = useState<Message[]>([]);

  const appendToken = useCallback((messageId: string, token: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, content: message.content + token } : message,
      ),
    );
  }, []);

  /** Replaces a still-empty placeholder (e.g. after a failed stream) with fallback text. */
  const fillIfEmpty = useCallback((messageId: string, fallback: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId && !message.content.trim()
          ? { ...message, content: fallback }
          : message,
      ),
    );
  }, []);

  return { messages, setMessages, appendToken, fillIfEmpty };
}
