import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { collections } from "../db.js";
import { asyncHandler, badRequest, userIdOf } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { callJobsService } from "../services/jobsService.js";
import { anonymizeResumeForMatching, enforceInputGuards } from "../services/guardrails.js";

const filterSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
  /** Only ads whose location contains this text (e.g. "Göteborg"). */
  location: z.string().trim().max(100).optional(),
  /** Only ads published within this many days. */
  maxAgeDays: z.number().int().min(1).max(365).optional(),
});

/** Maps API filter names to the vector service's snake_case fields, dropping empty values. */
function toServiceFilters(input: z.infer<typeof filterSchema>) {
  return {
    limit: input.limit,
    location: input.location || undefined,
    max_age_days: input.maxAgeDays,
  };
}

const searchInputSchema = filterSchema.extend({
  query: z.string().trim().min(1).max(1000),
});

const recommendInputSchema = filterSchema.extend({
  cv: z.string().trim().max(50_000).optional(),
});

const syncInputSchema = z.object({
  queries: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  limit: z.number().int().min(5).max(100).optional().default(30),
});

export const finderRouter = Router();

/**
 * Health / connectivity check with the Python jobs vector service
 */
finderRouter.get("/health", async (_req, res) => {
  try {
    const data = await callJobsService<Record<string, unknown>>("/health", {
      method: "GET",
      timeoutMs: 4_000,
    });
    res.json({ ...data, available: true });
  } catch (error) {
    res.json({
      available: false,
      error: error instanceof Error ? error.message : "Vector service unreachable.",
      hint: `Make sure the jobs-service container is running on ${config.jobsServiceUrl}`,
    });
  }
});

/**
 * Search job listings using semantic vector search
 */
finderRouter.post(
  "/search",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = searchInputSchema.parse(req.body);
    res.json(
      await callJobsService("/jobs/search", {
        body: { query: input.query, ...toServiceFilters(input) },
        timeoutMs: 12_000,
      }),
    );
  }),
);

/**
 * Recommend jobs using the user's primary CV stored in MongoDB
 */
finderRouter.post(
  "/recommend",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = recommendInputSchema.parse(req.body);
    let cvText = input.cv;

    // Without an explicit CV in the payload, fall back to the user's saved primary resume.
    if (!cvText) {
      const { resumes } = await collections();
      const resume = await resumes.findOne({ userId: userIdOf(req), isPrimary: true });
      cvText = resume?.enhancedText || resume?.rawText;
    }

    if (!cvText?.trim()) {
      throw badRequest(
        "No resume found. Please save a primary resume in the Resume tab or upload one first.",
      );
    }
    const guarded = enforceInputGuards("recommendation", { cv: cvText });

    res.json(
      await callJobsService("/jobs/recommend", {
        body: { cv: anonymizeResumeForMatching(guarded.values.cv!), ...toServiceFilters(input) },
        timeoutMs: 15_000,
      }),
    );
  }),
);

/**
 * Trigger sync of jobs from Arbetsförmedlingen API
 */
finderRouter.post(
  "/sync",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = syncInputSchema.parse(req.body);
    res.json(await callJobsService("/jobs/sync", { body: input, timeoutMs: 8_000 }));
  }),
);
