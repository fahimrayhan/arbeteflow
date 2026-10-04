import { Router } from "express";
import { z } from "zod";
import { collections } from "../db.js";
import { asyncHandler, notFound, parseObjectId, userIdOf } from "../lib/http.js";
import { requireAuth } from "../middleware/auth.js";
import { JOB_STATUSES, type JobDocument } from "../types.js";

/** Only http(s) links are stored — blocks `javascript:` and other dangerous schemes. */
const httpUrlSchema = z
  .string()
  .trim()
  .max(2_000)
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "URL must start with http:// or https://");

const jobInputSchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  location: z.string().trim().max(200).default(""),
  status: z.enum(JOB_STATUSES).default("bookmarked"),
  salary: z.string().trim().max(100).optional(),
  appliedDate: z.string().trim().max(30).optional(),
  deadline: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(10_000).default(""),
  url: httpUrlSchema.optional().or(z.literal("")),
  jobDescription: z.string().trim().max(50_000).optional(),
});

/** Optional fields that are removed from the document when sent as an empty string. */
const CLEARABLE_FIELDS = ["salary", "appliedDate", "deadline", "url", "jobDescription"] as const;

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

export const jobsRouter = Router();

jobsRouter.use(requireAuth);

jobsRouter.get("/", asyncHandler(async (req, res) => {
  const { jobs } = await collections();

  const userJobs = await jobs
    .find({ userId: userIdOf(req) })
    .sort({ updatedAt: -1 })
    .limit(1_000)
    .toArray();

  res.json({ jobs: userJobs.map(serializeJob) });
}));

jobsRouter.post("/", asyncHandler(async (req, res) => {
  const input = jobInputSchema.parse(req.body);
  const now = new Date();

  const job: JobDocument = {
    userId: userIdOf(req),
    company: input.company,
    role: input.role,
    location: input.location,
    status: input.status,
    salary: input.salary || undefined,
    appliedDate: input.appliedDate || undefined,
    deadline: input.deadline || undefined,
    notes: input.notes,
    url: input.url || undefined,
    jobDescription: input.jobDescription || undefined,
    createdAt: now,
    updatedAt: now,
  };

  const { jobs } = await collections();
  const result = await jobs.insertOne(job);

  res.status(201).json({ job: serializeJob({ ...job, _id: result.insertedId }) });
}));

jobsRouter.patch("/:jobId", asyncHandler(async (req, res) => {
  const input = jobInputSchema.partial().parse(req.body);

  const $set: Partial<JobDocument> = { ...input, updatedAt: new Date() };
  const $unset: Partial<Record<keyof JobDocument, "">> = {};

  for (const field of CLEARABLE_FIELDS) {
    if (input[field] === "") {
      delete $set[field];
      $unset[field] = "";
    }
  }

  const { jobs } = await collections();

  const result = await jobs.findOneAndUpdate(
    { _id: parseObjectId(req.params.jobId, "job ID"), userId: userIdOf(req) },
    Object.keys($unset).length ? { $set, $unset } : { $set },
    { returnDocument: "after" },
  );

  if (!result) {
    throw notFound("Job not found.");
  }

  res.json({ job: serializeJob(result) });
}));

jobsRouter.delete("/:jobId", asyncHandler(async (req, res) => {
  const { jobs } = await collections();

  const result = await jobs.deleteOne({
    _id: parseObjectId(req.params.jobId, "job ID"),
    userId: userIdOf(req),
  });

  if (result.deletedCount === 0) {
    throw notFound("Job not found.");
  }

  res.status(204).send();
}));
