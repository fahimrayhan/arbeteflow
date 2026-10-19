import { Router } from 'express';
import { z } from 'zod';
import { collections } from '../db.js';
import { asyncHandler, notFound, parseObjectId, userIdOf } from '../lib/http.js';
import { createMessage, sendMessageSchema, serializeMessage } from '../lib/messages.js';
import { runSseStream } from '../lib/sse.js';
import { requireAuth } from '../middleware/auth.js';
import { streamLlmResponse } from '../services/llm.js';
import { buildCoachSystemPrompt } from '../services/prompts.js';
import { COACH_MODES, type ChatSessionDocument } from '../types.js';
import { enforceInputGuards, lintGeneratedText, validateCareerOutput } from '../services/guardrails.js';

/*
  Keep recent conversation history only. This prevents a small-context
  local model (e.g. a 2048-token Qwen setup) from receiving an unbounded conversation.
*/
const CONTEXT_MESSAGE_LIMIT = 10;

const startSessionSchema = z.object({
  mode: z.enum(COACH_MODES),
});

function serializeSession(session: ChatSessionDocument) {
  return {
    id: session._id?.toString(),
    mode: session.mode,
    messages: session.messages.map(serializeMessage),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.post('/sessions', asyncHandler(async (req, res) => {
  const { mode } = startSessionSchema.parse(req.body);
  const now = new Date();

  const session: ChatSessionDocument = {
    userId: userIdOf(req),
    mode,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  const { chatSessions } = await collections();
  const result = await chatSessions.insertOne(session);

  res.status(201).json({
    session: serializeSession({ ...session, _id: result.insertedId }),
  });
}));

chatRouter.get('/sessions', asyncHandler(async (req, res) => {
  const { chatSessions } = await collections();

  const sessions = await chatSessions
    .find({ userId: userIdOf(req) })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();

  res.json({ sessions: sessions.map(serializeSession) });
}));

chatRouter.get('/sessions/:sessionId', asyncHandler(async (req, res) => {
  const { chatSessions } = await collections();

  const session = await chatSessions.findOne({
    _id: parseObjectId(req.params.sessionId, 'chat session ID'),
    userId: userIdOf(req),
  });

  if (!session) {
    throw notFound('Chat session not found.');
  }

  res.json({ session: serializeSession(session) });
}));

chatRouter.post('/sessions/:sessionId/messages', asyncHandler(async (req, res) => {
  const { content } = sendMessageSchema.parse(req.body);
  const guarded = enforceInputGuards('coach', { content });
  const userId = userIdOf(req);
  const sessionId = parseObjectId(req.params.sessionId, 'chat session ID');
  const { chatSessions, resumes, jobs } = await collections();

  const session = await chatSessions.findOne({ _id: sessionId, userId });

  if (!session) {
    throw notFound('Chat session not found.');
  }

  const userMessage = createMessage('user', guarded.values.content!);

  await chatSessions.updateOne(
    { _id: sessionId, userId },
    { $push: { messages: userMessage }, $set: { updatedAt: new Date() } },
  );

  const [resume, savedJobs] = await Promise.all([
    resumes.findOne({ userId, isPrimary: true }),
    jobs.find({ userId }).sort({ updatedAt: -1 }).limit(20).toArray(),
  ]);

  const systemPrompt = buildCoachSystemPrompt({
    mode: session.mode,
    resumeText: resume?.rawText,
    jobs: savedJobs,
  });

  await runSseStream(req, res, async (stream) => {
    stream.send('guard', guarded.report);
    let fullResponse = '';

    await streamLlmResponse({
      systemPrompt,
      messages: [...session.messages, userMessage].slice(-CONTEXT_MESSAGE_LIMIT),
      maxTokens: 350,
      signal: stream.signal,
      onToken: (token) => {
        fullResponse += token;
        stream.send('token', { token });
      },
      onComplete: (text) => stream.send('guard', { ...guarded.report, outputFlags: lintGeneratedText(text, userMessage.content) }),
      outputGuard: {
        validate: validateCareerOutput,
        fallback: 'I’m ArbetsFlow. I can help with resumes, job applications, career planning, and interview preparation.',
      },
    });

    const assistantMessage = createMessage(
      'assistant',
      fullResponse.trim() || 'I could not generate a response. Please try again.',
    );

    await chatSessions.updateOne(
      { _id: sessionId, userId },
      { $push: { messages: assistantMessage }, $set: { updatedAt: new Date() } },
    );

    stream.send('done', {
      messageId: assistantMessage.id,
      createdAt: assistantMessage.createdAt.toISOString(),
    });
  }, 'Chat request failed.');
}));
