import "dotenv/config";
import { z } from "zod";

const trimmedUrl = z
  .string()
  .trim()
  .url()
  .transform((value) => value.replace(/\/+$/, ""));

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  CLIENT_ORIGIN: z.string().trim().default("http://localhost:3000"),

  MONGODB_URI: z.string().trim().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().trim().min(1).default("jobfinder"),

  JOBS_SERVICE_URL: trimmedUrl.default("http://jobs-service:8000"),

  MODEL_BASE_URL: trimmedUrl.default("http://host.docker.internal:8000"),
  MODEL_NAME: z.string().trim().min(1).default("Qwen/Qwen2-VL-2B-Instruct"),
  MODEL_API_KEY: z.string().trim().default(""),
  /** Upper bound for a single model request, including streaming. */
  MODEL_TIMEOUT_MS: z.coerce.number().int().min(5_000).default(120_000),

  /** Encrypts provider API keys at rest. Optional: a key file is generated when unset. */
  APP_ENCRYPTION_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(16, "APP_ENCRYPTION_KEY must be at least 16 characters").optional(),
  ),
  ENCRYPTION_KEY_FILE: z.string().trim().min(1).default("./.data/encryption.key"),

  /** Enables "research the company" in the cover letter generator. Optional. */
  TAVILY_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  TAVILY_API_URL: trimmedUrl.default("https://api.tavily.com"),
  RESEARCH_TIMEOUT_MS: z.coerce.number().int().min(1_000).default(12_000),

  ALLOW_DEVELOPMENT_AUTH: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment configuration:\n${issues}`);
}

const env = parsed.data;

export const config = {
  isProduction: env.NODE_ENV === "production",
  port: env.PORT,
  /** Comma-separated list is supported, e.g. "http://localhost:3000,http://127.0.0.1:3000". */
  clientOrigins: env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),

  mongoUri: env.MONGODB_URI,
  mongoDbName: env.MONGODB_DB_NAME,

  jobsServiceUrl: env.JOBS_SERVICE_URL,

  /** Defaults used only to seed the model configuration on first start. */
  modelDefaults: {
    baseUrl: env.MODEL_BASE_URL,
    model: env.MODEL_NAME,
    apiKey: env.MODEL_API_KEY,
  },
  modelTimeoutMs: env.MODEL_TIMEOUT_MS,

  encryption: {
    key: env.APP_ENCRYPTION_KEY,
    keyFile: env.ENCRYPTION_KEY_FILE,
  },

  research: {
    tavilyApiKey: env.TAVILY_API_KEY,
    tavilyApiUrl: env.TAVILY_API_URL,
    timeoutMs: env.RESEARCH_TIMEOUT_MS,
  },

  allowDevelopmentAuth: env.ALLOW_DEVELOPMENT_AUTH,
} as const;
