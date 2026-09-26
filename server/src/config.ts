import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:3000",

  mongoUri: required("MONGODB_URI"),
  mongoDbName: process.env.MONGODB_DB_NAME ?? "jobfinder",

  modelBaseUrl: (
    process.env.MODEL_BASE_URL ?? "http://127.0.0.1:8000"
  ).replace(/\/+$/, ""),

  jobsServiceUrl: (process.env.JOBS_SERVICE_URL ?? "http://jobs-service:8000").replace(/\/+$/, ""),

  modelApiKey: process.env.MODEL_API_KEY ?? "local-dev-secret",
  modelName: required("MODEL_NAME"),

  allowDevelopmentAuth:
    process.env.ALLOW_DEVELOPMENT_AUTH === "true",
};
