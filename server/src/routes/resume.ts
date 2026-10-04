import { Router } from "express";
import { z } from "zod";
import { collections } from "../db.js";
import { asyncHandler, HttpError, userIdOf } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import type { ResumeDocument } from "../types.js";

const resumeInputSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  rawText: z.string().trim().min(1).max(50_000),
  enhancedText: z.string().trim().max(50_000).optional(),
});

function serializeResume(resume: ResumeDocument) {
  return {
    id: resume._id?.toString(),
    title: resume.title,
    rawText: resume.rawText,
    enhancedText: resume.enhancedText,
    isPrimary: resume.isPrimary,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  };
}

export const resumeRouter = Router();

resumeRouter.get("/primary", requireAuth, asyncHandler(async (req, res) => {
  const { resumes } = await collections();
  const resume = await resumes.findOne({ userId: userIdOf(req), isPrimary: true });

  res.json({ resume: resume ? serializeResume(resume) : null });
}));

resumeRouter.put("/primary", requireAuth, asyncHandler(async (req, res) => {
  const input = resumeInputSchema.parse(req.body);
  const userId = userIdOf(req);
  const now = new Date();
  const { resumes } = await collections();

  const result = await resumes.findOneAndUpdate(
    { userId, isPrimary: true },
    {
      $set: {
        title: input.title ?? "Primary resume",
        rawText: input.rawText,
        enhancedText: input.enhancedText,
        updatedAt: now,
      },
      $setOnInsert: { userId, isPrimary: true, createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!result) {
    throw new HttpError(500, "Could not save the resume.");
  }

  res.json({ resume: serializeResume(result) });
}));

resumeRouter.delete("/primary", requireAuth, asyncHandler(async (req, res) => {
  const { resumes } = await collections();
  await resumes.deleteOne({ userId: userIdOf(req), isPrimary: true });

  res.status(204).send();
}));
