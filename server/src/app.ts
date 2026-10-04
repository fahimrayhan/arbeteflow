import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { chatRouter } from "./routes/chat.js";
import { coverLetterRouter } from "./routes/coverLetter.js";
import { finderRouter } from "./routes/finder.js";
import { interviewRouter } from "./routes/interviews.js";
import { jobsRouter } from "./routes/jobs.js";
import { modelSettingsRouter } from "./routes/modelSettings.js";
import { resumeRouter } from "./routes/resume.js";
import { resumeEnhanceRouter } from "./routes/resumeEnhance.js";

const rateLimitDefaults = {
  windowMs: 60_000,
  standardHeaders: "draft-7",
  legacyHeaders: false,
} as const;

/** Generous limit for ordinary CRUD calls. */
const apiLimiter = rateLimit({ ...rateLimitDefaults, limit: 90 });

/** Tighter limit for endpoints that call the model — each request can cost real compute or money. */
const aiLimiter = rateLimit({
  ...rateLimitDefaults,
  limit: 30,
  message: { error: "Too many AI requests. Please wait a minute and try again." },
});

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.use(
    cors({
      origin: config.clientOrigins,
      credentials: false,
      allowedHeaders: ["Content-Type", "x-user-id"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, environment: config.isProduction ? "production" : "development" });
  });

  app.use("/api", apiLimiter);
  app.use(
    [
      "/api/resume/enhance",
      "/api/cover-letter",
      "/api/chat/sessions/:sessionId/messages",
      "/api/interviews/:interviewId/messages",
    ],
    aiLimiter,
  );

  app.use("/api/resume/enhance", resumeEnhanceRouter);
  app.use("/api/resume", resumeRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api/chat", chatRouter);
  app.use("/api/interviews", interviewRouter);
  app.use("/api/cover-letter", coverLetterRouter);
  app.use("/api/settings/model", modelSettingsRouter);
  app.use("/api/finder", finderRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
