import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { ensureIndexes } from "./db.js";
import { chatRouter } from "./routes/chat.js";
import { interviewRouter } from "./routes/interviews.js";
import { jobsRouter } from "./routes/jobs.js";
import { resumeRouter } from "./routes/resume.js";
import { coverLetterRouter } from "./routes/coverLetter.js";
import { resumeEnhanceRouter } from "./routes/resumeEnhance.js";
import { modelSettingsRouter } from './routes/modelSettings.js';

const app = express();

app.use(
  cors({
    origin: config.clientOrigin,
    credentials: false,
    allowedHeaders: ["Content-Type", "x-user-id"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "1mb" }));

app.use(
  "/api",
  rateLimit({
    windowMs: 60_000,
    limit: 90,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    environment: process.env.NODE_ENV ?? "development",
  });
});

app.use("/api/resume", resumeRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/interviews", interviewRouter);
app.use("/api/cover-letter", coverLetterRouter);
app.use("/api/resume/enhance", resumeEnhanceRouter);
app.use('/api/settings/model', modelSettingsRouter);

app.use(
  (
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    console.error(error);

    if (
      typeof error === "object" &&
      error !== null &&
      "issues" in error
    ) {
      res.status(400).json({
        error: "Invalid request data.",
        details: error,
      });
      return;
    }

    const message =
      error instanceof Error
        ? error.message
        : "An unexpected server error occurred.";

    res.status(500).json({ error: message });
  },
);

async function start() {
  await ensureIndexes();

  app.listen(config.port, () => {
    console.log(
      `JobFinder backend running at http://localhost:${config.port}`,
    );
  });
}

start().catch((error) => {
  console.error("Could not start server:", error);
  process.exit(1);
});
