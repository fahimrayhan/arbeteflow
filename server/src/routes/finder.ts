import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { getDb } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { ResumeDocument } from "../types.js";

const searchInputSchema = z.object({
  query: z.string().trim().min(1).max(1000),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

const recommendInputSchema = z.object({
  cv: z.string().trim().max(50_000).optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

const syncInputSchema = z.object({
  queries: z.array(z.string().trim().min(1).max(100)).optional(),
  limit: z.number().int().min(5).max(100).optional().default(30),
});

export const finderRouter = Router();

/**
 * Health / connectivity check with the Python jobs vector service
 */
finderRouter.get("/health", async (_req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${config.jobsServiceUrl}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.status(502).json({
        available: false,
        error: `Vector service responded with status ${response.status}`,
      });
      return;
    }

    const data = await response.json();
    res.json({ available: true, ...data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Vector service unreachable.";
    res.json({
      available: false,
      error: message,
      hint: "Make sure the jobs-service container is running on " + config.jobsServiceUrl,
    });
  }
});

/**
 * Search job listings using semantic vector search
 */
finderRouter.post("/search", requireAuth, async (req, res, next) => {
  try {
    const input = searchInputSchema.parse(req.body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(`${config.jobsServiceUrl}/jobs/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: input.query,
        limit: input.limit,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      res.status(response.status).json({
        error: `Search error from vector engine: ${err}`,
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      res.status(504).json({ error: "Vector search service timed out." });
      return;
    }
    next(error);
  }
});

/**
 * Recommend jobs using the user's primary CV stored in MongoDB
 */
finderRouter.post("/recommend", requireAuth, async (req, res, next) => {
  try {
    const input = recommendInputSchema.parse(req.body);
    let cvText = input.cv;

    // If no CV was explicitly submitted in the request payload,
    // automatically retrieve the user's primary resume from MongoDB
    if (!cvText) {
      const db = await getDb();
      const resume = await db.collection<ResumeDocument>("resumes").findOne({
        userId: req.user!.id,
        isPrimary: true,
      });

      if (resume) {
        cvText = resume.enhancedText || resume.rawText;
      }
    }

    if (!cvText || !cvText.trim()) {
      res.status(400).json({
        error:
          "No resume found. Please save a primary resume in the Resume tab or upload one first.",
      });
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${config.jobsServiceUrl}/jobs/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cv: cvText,
        limit: input.limit,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const err = await response.text();
      res.status(response.status).json({
        error: `Recommendation error from vector engine: ${err}`,
      });
      return;
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      res.status(504).json({ error: "Vector recommendation service timed out." });
      return;
    }
    next(error);
  }
});

/**
 * Trigger sync of jobs from Arbetsförmedlingen API
 */
finderRouter.post("/sync", requireAuth, async (req, res, next) => {
  try {
    const input = syncInputSchema.parse(req.body);

    const response = await fetch(`${config.jobsServiceUrl}/jobs/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    next(error);
  }
});
