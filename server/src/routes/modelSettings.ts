import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  getModelConfig,
  toPublicModelConfig,
  updateModelConfig,
} from '../modelConfig.js';

const providerSchema = z.enum([
  'vllm',
  'ollama',
  'openai',
  'anthropic',
]);

const updateSchema = z.object({
  provider: providerSchema,
  baseUrl: z.string().trim().url().max(500),
  model: z.string().trim().min(1).max(300),
  apiKey: z.string().trim().max(1000).optional(),
});

export const modelSettingsRouter = Router();

modelSettingsRouter.get(
  '/',
  requireAuth,
  async (_req, res, next) => {
    try {
      const config = await getModelConfig();

      res.json({
        config: toPublicModelConfig(config),
      });
    } catch (error) {
      next(error);
    }
  },
);

modelSettingsRouter.put(
  '/',
  requireAuth,
  async (req, res, next) => {
    try {
      const input = updateSchema.parse(req.body);

      const config = await updateModelConfig(input);

      res.json({
        config: toPublicModelConfig(config),
      });
    } catch (error) {
      next(error);
    }
  },
);
