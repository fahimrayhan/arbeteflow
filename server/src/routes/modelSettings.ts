import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getModelConfig,
  toPublicModelConfig,
  updateModelConfig,
} from '../services/modelConfig.js';
import { MODEL_PROVIDERS } from '../types.js';

const updateSchema = z.object({
  provider: z.enum(MODEL_PROVIDERS),
  baseUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => /^https?:\/\//i.test(value), 'Base URL must use http or https.'),
  model: z.string().trim().min(1).max(300),
  apiKey: z.string().trim().max(1000).optional(),
});

export const modelSettingsRouter = Router();

modelSettingsRouter.use(requireAuth);

modelSettingsRouter.get('/', asyncHandler(async (_req, res) => {
  res.json({ config: toPublicModelConfig(await getModelConfig()) });
}));

modelSettingsRouter.put('/', asyncHandler(async (req, res) => {
  const input = updateSchema.parse(req.body);
  res.json({ config: toPublicModelConfig(await updateModelConfig(input)) });
}));
