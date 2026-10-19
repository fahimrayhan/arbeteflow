import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { StoredMessage } from "../types.js";

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(12_000),
});

export function createMessage(role: StoredMessage["role"], content: string): StoredMessage {
  return { id: randomUUID(), role, content, createdAt: new Date() };
}

export function serializeMessage(message: StoredMessage) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}
