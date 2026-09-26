import { ObjectId } from 'mongodb';
import { Router, type Response } from 'express';
import { z } from 'zod';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { streamLlmResponse } from '../services/llm.js';
import { buildCoachSystemPrompt } from '../services/prompts.js';
import type {
  ChatSessionDocument,
  CoachMode,
  JobDocument,
  ResumeDocument,
  StoredMessage,
} from '../types.js';

const modeSchema = z.enum([
  'resume',
  'career',
  'jobcritic',
]);

const startSessionSchema = z.object({
  mode: modeSchema,
});

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(12_000),
});

function messageId(): string {
  return crypto.randomUUID();
}

function parseSessionId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new Error('Invalid chat session ID.');
  }

  return new ObjectId(value);
}

function writeSse(
  res: Response,
  event: string,
  data: unknown,
): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function serializeSession(session: ChatSessionDocument) {
  return {
    id: session._id?.toString(),
    mode: session.mode,
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export const chatRouter = Router();

chatRouter.post('/sessions', requireAuth, async (req, res, next) => {
  try {
    const { mode } = startSessionSchema.parse(req.body);
    const now = new Date();

    const session: ChatSessionDocument = {
      userId: req.user!.id,
      mode: mode as CoachMode,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();

    const result = await db
      .collection<ChatSessionDocument>('chatSessions')
      .insertOne(session);

    res.status(201).json({
      session: serializeSession({
        ...session,
        _id: result.insertedId,
      }),
    });
  } catch (error) {
    next(error);
  }
});

chatRouter.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();

    const sessions = await db
      .collection<ChatSessionDocument>('chatSessions')
      .find({ userId: req.user!.id })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    res.json({
      sessions: sessions.map(serializeSession),
    });
  } catch (error) {
    next(error);
  }
});

chatRouter.get(
  '/sessions/:sessionId',
  requireAuth,
  async (req, res, next) => {
    try {
      const db = await getDb();

      const session = await db
        .collection<ChatSessionDocument>('chatSessions')
        .findOne({
          _id: parseSessionId(String(req.params.sessionId)),
          userId: req.user!.id,
        });

      if (!session) {
        res.status(404).json({
          error: 'Chat session not found.',
        });
        return;
      }

      res.json({
        session: serializeSession(session),
      });
    } catch (error) {
      next(error);
    }
  },
);

chatRouter.post(
  '/sessions/:sessionId/messages',
  requireAuth,
  async (req, res, next) => {
    try {
      const { content } = sendMessageSchema.parse(req.body);
      const db = await getDb();

      const session = await db
        .collection<ChatSessionDocument>('chatSessions')
        .findOne({
          _id: parseSessionId(String(req.params.sessionId)),
          userId: req.user!.id,
        });

      if (!session) {
        res.status(404).json({
          error: 'Chat session not found.',
        });
        return;
      }

      const userMessage: StoredMessage = {
        id: messageId(),
        role: 'user',
        content,
        createdAt: new Date(),
      };

      await db
        .collection<ChatSessionDocument>('chatSessions')
        .updateOne(
          {
            _id: session._id,
            userId: req.user!.id,
          },
          {
            $push: {
              messages: userMessage,
            },
            $set: {
              updatedAt: new Date(),
            },
          },
        );

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const [resume, jobs] = await Promise.all([
        db
          .collection<ResumeDocument>('resumes')
          .findOne({
            userId: req.user!.id,
            isPrimary: true,
          }),
        db
          .collection<JobDocument>('jobs')
          .find({
            userId: req.user!.id,
          })
          .sort({ updatedAt: -1 })
          .limit(20)
          .toArray(),
      ]);

      const systemPrompt = buildCoachSystemPrompt({
        mode: session.mode,
        resumeText: resume?.rawText?.slice(0, 8_000),
        jobs,
      });

      /*
        Keep recent conversation history only. This prevents your
        2048-token Qwen setup from receiving an unbounded conversation.
      */
      const contextMessages = [
        ...session.messages,
        userMessage,
      ].slice(-10);

      let fullResponse = '';

      await streamLlmResponse({
        systemPrompt,
        messages: contextMessages,
        maxTokens: 350,
        onToken: (token) => {
          fullResponse += token;

          writeSse(res, 'token', { token });
        },
      });

      const assistantMessage: StoredMessage = {
        id: messageId(),
        role: 'assistant',
        content:
          fullResponse.trim() ||
          'I could not generate a response. Please try again.',
        createdAt: new Date(),
      };

      await db
        .collection<ChatSessionDocument>('chatSessions')
        .updateOne(
          {
            _id: session._id,
            userId: req.user!.id,
          },
          {
            $push: {
              messages: assistantMessage,
            },
            $set: {
              updatedAt: new Date(),
            },
          },
        );

      writeSse(res, 'done', {
        messageId: assistantMessage.id,
        createdAt: assistantMessage.createdAt.toISOString(),
      });

      res.end();
    } catch (error) {
      if (res.headersSent) {
        writeSse(res, 'error', {
          error:
            error instanceof Error
              ? error.message
              : 'Chat request failed.',
        });

        res.end();
        return;
      }

      next(error);
    }
  },
);
