import { config } from "../config.js";
import { collections } from "../db.js";
import { decryptSecret, encryptSecret, isEncrypted } from "../lib/secretBox.js";
import type { ModelProvider, StoredModelConfig } from "../types.js";

export type PublicModelConfig = {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  updatedAt: string;
};

const CONFIG_ID = "model-configuration" as const;

function normaliseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

/*
  Documents in MongoDB hold the API key encrypted. Everything returned from this
  module carries the decrypted key, so callers never deal with ciphertext.
*/
function decryptDocument(document: StoredModelConfig): StoredModelConfig {
  try {
    return { ...document, apiKey: decryptSecret(document.apiKey) };
  } catch (error) {
    // Wrong or lost encryption key: keep the app usable and let the user re-enter the key.
    console.error("[secrets] Could not decrypt the stored provider API key:", error);
    return { ...document, apiKey: "" };
  }
}

export async function getModelConfig(): Promise<StoredModelConfig> {
  const { appSettings } = await collections();

  const initial: StoredModelConfig = {
    _id: CONFIG_ID,
    provider: "vllm",
    baseUrl: config.modelDefaults.baseUrl,
    model: config.modelDefaults.model,
    apiKey: encryptSecret(config.modelDefaults.apiKey),
    updatedAt: new Date(),
  };

  // Atomic "insert if missing" — safe when two requests arrive on a fresh database.
  const stored =
    (await appSettings.findOneAndUpdate(
      { _id: CONFIG_ID },
      { $setOnInsert: initial },
      { upsert: true, returnDocument: "after" },
    )) ?? initial;

  const decrypted = decryptDocument(stored);

  // Upgrade a plaintext key saved by an older version.
  if (stored.apiKey && !isEncrypted(stored.apiKey)) {
    await appSettings.updateOne(
      { _id: CONFIG_ID, apiKey: stored.apiKey },
      { $set: { apiKey: encryptSecret(decrypted.apiKey) } },
    );
  }

  return decrypted;
}

export function toPublicModelConfig(
  stored: StoredModelConfig,
): PublicModelConfig {
  return {
    provider: stored.provider,
    baseUrl: stored.baseUrl,
    model: stored.model,
    hasApiKey: Boolean(stored.apiKey),
    updatedAt: stored.updatedAt.toISOString(),
  };
}

export async function updateModelConfig(input: {
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
}): Promise<StoredModelConfig> {
  const { appSettings } = await collections();
  const current = await getModelConfig();

  // An empty key keeps the stored one, but only when the provider is unchanged —
  // a key for one provider must never be sent to another.
  const keepCurrentKey = !input.apiKey && current.provider === input.provider;

  const next: StoredModelConfig = {
    _id: CONFIG_ID,
    provider: input.provider,
    baseUrl: normaliseUrl(input.baseUrl),
    model: input.model.trim(),
    apiKey: input.apiKey ? input.apiKey.trim() : keepCurrentKey ? current.apiKey : "",
    updatedAt: new Date(),
  };

  await appSettings.replaceOne(
    { _id: CONFIG_ID },
    { ...next, apiKey: encryptSecret(next.apiKey) },
    { upsert: true },
  );

  return next;
}
