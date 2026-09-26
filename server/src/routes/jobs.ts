import { ObjectId } from "mongodb";
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import type { JobDocument, JobStatus } from "../types.js";

const jobStatusSchema = z.enum([
  "bookmarked",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
]);

const jobInputSchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).default(""),
  status: jobStatusSchema.default("bookmarked"),
  salary: z.string().trim().max(100).optional(),
  appliedDate: z.string().trim().max(30).optional(),
  deadline: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(10_000).default(""),
  url: z.string().url().optional().or(z.literal("")),
  jobDescription: z.string().trim().max(50_000).optional(),
});

function serializeJob(job: JobDocument) {
  return {
    id: job._id?.toString(),
    company: job.company,
    role: job.role,
    location: job.location,
    status: job.status,
    salary: job.salary ?? "",
    appliedDate: job.appliedDate ?? "",
    deadline: job.deadline ?? "",
    notes: job.notes,
    url: job.url ?? "",
    jobDescription: job.jobDescription ?? "",
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function getJobId(value: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new Error("Invalid job ID.");
  }

  return new ObjectId(value);
}

export const jobsRouter = Router();

jobsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();

    const jobs = await db
      .collection<JobDocument>("jobs")
      .find({ userId: req.user!.id })
      .sort({ updatedAt: -1 })
      .toArray();

    res.json({ jobs: jobs.map(serializeJob) });
  } catch (error) {
    next(error);
  }
});

jobsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const input = jobInputSchema.parse(req.body);
    const now = new Date();

    const job: JobDocument = {
      userId: req.user!.id,
      company: input.company,
      role: input.role,
      location: input.location,
      status: input.status as JobStatus,
      salary: input.salary || undefined,
      appliedDate: input.appliedDate || undefined,
      deadline: input.deadline || undefined,
      notes: input.notes,
      url: input.url || undefined,
      jobDescription: input.jobDescription || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();
    const result = await db.collection<JobDocument>("jobs").insertOne(job);

    res.status(201).json({
      job: serializeJob({
        ...job,
        _id: result.insertedId,
      }),
    });
  } catch (error) {
    next(error);
  }
});

jobsRouter.patch("/:jobId", requireAuth, async (req, res, next) => {
  try {
    const input = jobInputSchema.partial().parse(req.body);
    const db = await getDb();

    const result = await db
      .collection<JobDocument>("jobs")
      .findOneAndUpdate(
        {
          _id: getJobId(String(req.params.jobId)),
          userId: req.user!.id,
        },
        {
          $set: {
            ...input,
            ...(input.salary === "" ? { salary: undefined } : {}),
            ...(input.url === "" ? { url: undefined } : {}),
            updatedAt: new Date(),
          },
        },
        {
          returnDocument: "after",
        },
      );

    if (!result) {
      res.status(404).json({ error: "Job not found." });
      return;
    }

    res.json({ job: serializeJob(result) });
  } catch (error) {
    next(error);
  }
});

jobsRouter.delete("/:jobId", requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();

    const result = await db.collection<JobDocument>("jobs").deleteOne({
      _id: getJobId(String(req.params.jobId)),
      userId: req.user!.id,
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Job not found." });
      return;
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
