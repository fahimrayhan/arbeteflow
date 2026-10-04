import type { ModelProvider, PublicModelConfig } from '../types';
import { jsonBody, request } from './client';

export async function getModelSettings(): Promise<PublicModelConfig> {
  const response = await request<{ config: PublicModelConfig }>('/api/settings/model');
  return response.config;
}

export async function saveModelSettings(input: {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
}): Promise<PublicModelConfig> {
  const response = await request<{ config: PublicModelConfig }>(
    '/api/settings/model',
    jsonBody('PUT', input),
  );
  return response.config;
}
