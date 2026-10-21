import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { runSseStream } from '../lib/sse.js';
import { requireAuth } from '../middleware/auth.js';
import { streamLlmResponse } from '../services/llm.js';
import {
  buildResumeEnhanceUserPrompt,
  RESUME_ENHANCE_SYSTEM_PROMPT,
} from '../services/prompts.js';
import { enforceInputGuards, lintGeneratedText } from '../services/guardrails.js';

const resumeEnhanceSchema = z.object({
  resumeText: z.string().trim().min(1).max(50_000),
  targetRole: z.string().trim().max(200).optional(),
  industry: z.string().trim().max(100).optional(),
});

export const resumeEnhanceRouter = Router();

resumeEnhanceRouter.post('/', requireAuth, asyncHandler(async (req, res) => {
  const input = resumeEnhanceSchema.parse(req.body);
  const guarded = enforceInputGuards('resume', input);

  await runSseStream(req, res, async (stream) => {
    stream.send('guard', { ...guarded.report, providerScope: 'configured provider' });
    await streamLlmResponse({
      systemPrompt: RESUME_ENHANCE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildResumeEnhanceUserPrompt(guarded.values as typeof input) }],
      maxTokens: 1500,
      signal: stream.signal,
      onToken: (token) => stream.send('token', { token }),
      onComplete: (text) => stream.send('guard', { ...guarded.report, outputFlags: lintGeneratedText(text, input.resumeText) }),
    });

    stream.send('done', {});
  }, 'Resume generation failed.');
}));
