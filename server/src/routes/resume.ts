import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
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

resumeRouter.get("/primary", requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();

    const resume = await db
      .collection<ResumeDocument>("resumes")
      .findOne({ userId: req.user!.id, isPrimary: true });

    res.json({
      resume: resume ? serializeResume(resume) : null,
    });
  } catch (error) {
    next(error);
  }
});

resumeRouter.put("/primary", requireAuth, async (req, res, next) => {
  try {
    const input = resumeInputSchema.parse(req.body);
    const db = await getDb();
    const now = new Date();

    const result = await db
      .collection<ResumeDocument>("resumes")
      .findOneAndUpdate(
        {
          userId: req.user!.id,
          isPrimary: true,
        },
        {
          $set: {
            title: input.title ?? "Primary resume",
            rawText: input.rawText,
            enhancedText: input.enhancedText,
            updatedAt: now,
          },
          $setOnInsert: {
            userId: req.user!.id,
            isPrimary: true,
            createdAt: now,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
        },
      );

    if (!result) {
      throw new Error("Could not save the resume.");
    }

    res.json({
      resume: serializeResume(result),
    });
  } catch (error) {
    next(error);
  }
});
