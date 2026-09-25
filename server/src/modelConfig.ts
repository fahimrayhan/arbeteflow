import { getDb } from './db.js';

export type ModelProvider =
  | 'vllm'
  | 'ollama'
  | 'openai'
  | 'anthropic';

export type StoredModelConfig = {
  _id: 'model-configuration';
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  updatedAt: Date;
};

export type PublicModelConfig = {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  updatedAt: string;
};

const CONFIG_ID = 'model-configuration' as const;

function normaliseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export async function getModelConfig(): Promise<StoredModelConfig> {
  const db = await getDb();

  const stored = await db
    .collection<StoredModelConfig>('appSettings')
    .findOne({ _id: CONFIG_ID });

  if (stored) {
    return stored;
  }

  const initial: StoredModelConfig = {
    _id: CONFIG_ID,
    provider: 'vllm',
    baseUrl: process.env.MODEL_BASE_URL?.trim() || 'http://127.0.0.1:8000',
    model:
      process.env.MODEL_NAME?.trim() ||
      'Qwen/Qwen2-VL-2B-Instruct',
    apiKey: process.env.MODEL_API_KEY?.trim() || '',
    updatedAt: new Date(),
  };

  await db
    .collection<StoredModelConfig>('appSettings')
    .insertOne(initial);

  return initial;
}

export function toPublicModelConfig(
  config: StoredModelConfig,
): PublicModelConfig {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    hasApiKey: Boolean(config.apiKey),
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function updateModelConfig(input: {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
}): Promise<StoredModelConfig> {
  const db = await getDb();
  const current = await getModelConfig();
  const now = new Date();

  const next: StoredModelConfig = {
    _id: CONFIG_ID,
    provider: input.provider,
    baseUrl: normaliseUrl(input.baseUrl),
    model: input.model.trim(),
    apiKey:
      input.apiKey === undefined || input.apiKey === ''
        ? current.apiKey
        : input.apiKey.trim(),
    updatedAt: now,
  };

  await db
    .collection<StoredModelConfig>('appSettings')
    .replaceOne(
      { _id: CONFIG_ID },
      next,
      { upsert: true },
    );

  return next;
}