import { ObjectId, type Filter } from "mongodb";
import { Router } from "express";
import { z } from "zod";
import { collections } from "../db.js";
import { asyncHandler, HttpError, notFound, parseObjectId, userIdOf } from "../lib/http.js";
import { createMessage, sendMessageSchema, serializeMessage } from "../lib/messages.js";
import { runSseStream } from "../lib/sse.js";
import { requireAuth } from "../middleware/auth.js";
import { streamLlmResponse } from "../services/llm.js";
import { buildInterviewSystemPrompt } from "../services/prompts.js";
import {
  INTERVIEW_DIFFICULTIES,
  INTERVIEW_TYPES,
  type InterviewSessionDocument,
  type ResumeDocument,
} from "../types.js";

/** Bounds the prompt size for long interviews while keeping enough history for feedback. */
const CONTEXT_MESSAGE_LIMIT = 30;

const END_INTERVIEW_PATTERN = /\b(end|finish|stop)\s+(the\s+)?interview\b/i;

const createInterviewSchema = z.object({
  role: z.string().trim().min(2).max(200),
  company: z.string().trim().max(200).optional(),
  jobDescription: z.string().trim().max(50_000).optional(),
  interviewType: z.enum(INTERVIEW_TYPES).default("mixed"),
  difficulty: z.enum(INTERVIEW_DIFFICULTIES).default("mid"),
  resumeId: z.string().trim().max(64).optional(),
});

function serializeInterview(session: InterviewSessionDocument) {
  return {
    id: session._id?.toString(),
    role: session.role,
    company: session.company ?? "",
    jobDescription: session.jobDescription ?? "",
    interviewType: session.interviewType,
    difficulty: session.difficulty,
    resumeId: session.resumeId,
    status: session.status,
    messages: session.messages.map(serializeMessage),
    feedback: session.feedback,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

export const interviewRouter = Router();

interviewRouter.use(requireAuth);

interviewRouter.post("/", asyncHandler(async (req, res) => {
  const input = createInterviewSchema.parse(req.body);
  const now = new Date();

  const session: InterviewSessionDocument = {
    userId: userIdOf(req),
    role: input.role,
    company: input.company || undefined,
    jobDescription: input.jobDescription || undefined,
    interviewType: input.interviewType,
    difficulty: input.difficulty,
    resumeId: input.resumeId || undefined,
    status: "active",
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  const { interviewSessions } = await collections();
  const result = await interviewSessions.insertOne(session);

  res.status(201).json({
    interview: serializeInterview({ ...session, _id: result.insertedId }),
  });
}));

interviewRouter.get("/", asyncHandler(async (req, res) => {
  const { interviewSessions } = await collections();

  const interviews = await interviewSessions
    .find({ userId: userIdOf(req) })
    .sort({ updatedAt: -1 })
    .limit(50)
    .toArray();

  res.json({ interviews: interviews.map(serializeInterview) });
}));

interviewRouter.get("/:interviewId", asyncHandler(async (req, res) => {
  const { interviewSessions } = await collections();

  const interview = await interviewSessions.findOne({
    _id: parseObjectId(req.params.interviewId, "interview ID"),
    userId: userIdOf(req),
  });

  if (!interview) {
    throw notFound("Interview not found.");
  }

  res.json({ interview: serializeInterview(interview) });
}));

interviewRouter.post("/:interviewId/messages", asyncHandler(async (req, res) => {
  const { content } = sendMessageSchema.parse(req.body);
  const userId = userIdOf(req);
  const interviewId = parseObjectId(req.params.interviewId, "interview ID");
  const { interviewSessions, resumes } = await collections();

  const interview = await interviewSessions.findOne({ _id: interviewId, userId });

  if (!interview) {
    throw notFound("Interview not found.");
  }

  if (interview.status === "completed") {
    throw new HttpError(
      409,
      "This interview has already ended. Start a new session to continue practicing.",
    );
  }

  const userMessage = createMessage("user", content);

  await interviewSessions.updateOne(
    { _id: interviewId, userId },
    { $push: { messages: userMessage }, $set: { updatedAt: new Date() } },
  );

  const resumeFilter: Filter<ResumeDocument> =
    interview.resumeId && ObjectId.isValid(interview.resumeId)
      ? { _id: new ObjectId(interview.resumeId), userId }
      : { userId, isPrimary: true };

  const resume = await resumes.findOne(resumeFilter);

  const systemPrompt = buildInterviewSystemPrompt({
    role: interview.role,
    company: interview.company,
    jobDescription: interview.jobDescription,
    resumeText: resume?.rawText,
    interviewType: interview.interviewType,
    difficulty: interview.difficulty,
  });

  await runSseStream(req, res, async (stream) => {
    let fullResponse = "";

    await streamLlmResponse({
      systemPrompt,
      messages: [...interview.messages, userMessage].slice(-CONTEXT_MESSAGE_LIMIT),
      signal: stream.signal,
      onToken: (token) => {
        fullResponse += token;
        stream.send("token", { token });
      },
    });

    const assistantMessage = createMessage("assistant", fullResponse.trim());
    const endedByUser = END_INTERVIEW_PATTERN.test(content);

    await interviewSessions.updateOne(
      { _id: interviewId, userId },
      {
        $push: { messages: assistantMessage },
        $set: {
          updatedAt: new Date(),
          ...(endedByUser ? { status: "completed" as const } : {}),
        },
      },
    );

    stream.send("done", {
      messageId: assistantMessage.id,
      completed: endedByUser,
      createdAt: assistantMessage.createdAt.toISOString(),
    });
  }, "Interview response failed.");
}));
