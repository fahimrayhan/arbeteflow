import { ObjectId } from "mongodb";
import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { streamLlmResponse } from "../services/llm.js";
import { buildInterviewSystemPrompt } from "../services/prompts.js";
import type {
  InterviewDifficulty,
  InterviewSessionDocument,
  InterviewType,
  ResumeDocument,
  StoredMessage,
} from "../types.js";

const interviewTypeSchema = z.enum([
  "behavioral",
  "technical",
  "mixed",
  "case",
]);

const difficultySchema = z.enum(["junior", "mid", "senior"]);

const createInterviewSchema = z.object({
  role: z.string().trim().min(2).max(200),
  company: z.string().trim().max(200).optional(),
  jobDescription: z.string().trim().max(50_000).optional(),
  interviewType: interviewTypeSchema.default("mixed"),
  difficulty: difficultySchema.default("mid"),
  resumeId: z.string().trim().optional(),
});

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(12_000),
});

function messageId(): string {
  return crypto.randomUUID();
}

function parseObjectId(value: string, label: string): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new Error(`Invalid ${label}.`);
  }

  return new ObjectId(value);
}

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
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    })),
    feedback: session.feedback,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function writeSse(res: import("express").Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export const interviewRouter = Router();

interviewRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const input = createInterviewSchema.parse(req.body);
    const now = new Date();

    const session: InterviewSessionDocument = {
      userId: req.user!.id,
      role: input.role,
      company: input.company || undefined,
      jobDescription: input.jobDescription || undefined,
      interviewType: input.interviewType as InterviewType,
      difficulty: input.difficulty as InterviewDifficulty,
      resumeId: input.resumeId || undefined,
      status: "active",
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    const db = await getDb();
    const result = await db
      .collection<InterviewSessionDocument>("interviewSessions")
      .insertOne(session);

    res.status(201).json({
      interview: serializeInterview({
        ...session,
        _id: result.insertedId,
      }),
    });
  } catch (error) {
    next(error);
  }
});

interviewRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();

    const interviews = await db
      .collection<InterviewSessionDocument>("interviewSessions")
      .find({ userId: req.user!.id })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    res.json({
      interviews: interviews.map(serializeInterview),
    });
  } catch (error) {
    next(error);
  }
});

interviewRouter.get("/:interviewId", requireAuth, async (req, res, next) => {
  try {
    const db = await getDb();

    const interview = await db
      .collection<InterviewSessionDocument>("interviewSessions")
      .findOne({
        _id: parseObjectId(String(req.params.interviewId), "interview ID"),
        userId: req.user!.id,
      });

    if (!interview) {
      res.status(404).json({ error: "Interview not found." });
      return;
    }

    res.json({ interview: serializeInterview(interview) });
  } catch (error) {
    next(error);
  }
});

interviewRouter.post(
  "/:interviewId/messages",
  requireAuth,
  async (req, res, next) => {
    try {
      const { content } = sendMessageSchema.parse(req.body);
      const db = await getDb();

      const interview = await db
        .collection<InterviewSessionDocument>("interviewSessions")
        .findOne({
          _id: parseObjectId(String(req.params.interviewId), "interview ID"),
          userId: req.user!.id,
        });

      if (!interview) {
        res.status(404).json({ error: "Interview not found." });
        return;
      }

      if (interview.status === "completed") {
        res.status(409).json({
          error:
            "This interview has already ended. Start a new session to continue practicing.",
        });
        return;
      }

      const userMessage: StoredMessage = {
        id: messageId(),
        role: "user",
        content,
        createdAt: new Date(),
      };

      await db
        .collection<InterviewSessionDocument>("interviewSessions")
        .updateOne(
          {
            _id: interview._id,
            userId: req.user!.id,
          },
          {
            $push: { messages: userMessage },
            $set: { updatedAt: new Date() },
          },
        );

      const resumeFilter =
        interview.resumeId && ObjectId.isValid(interview.resumeId)
          ? {
              _id: new ObjectId(interview.resumeId),
              userId: req.user!.id,
            }
          : {
              userId: req.user!.id,
              isPrimary: true,
            };

      const resume = await db
        .collection<ResumeDocument>("resumes")
        .findOne(resumeFilter);

      const systemPrompt = buildInterviewSystemPrompt({
        role: interview.role,
        company: interview.company,
        jobDescription: interview.jobDescription,
        resumeText: resume?.rawText,
        interviewType: interview.interviewType,
        difficulty: interview.difficulty,
      });

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      let fullResponse = "";

      await streamLlmResponse({
        systemPrompt,
        messages: [...interview.messages, userMessage].map((message) => ({
          role: message.role,
          content: message.content,
        })),
        onToken: (token) => {
          fullResponse += token;
          writeSse(res, "token", { token });
        },
      });

      const assistantMessage: StoredMessage = {
        id: messageId(),
        role: "assistant",
        content: fullResponse.trim(),
        createdAt: new Date(),
      };

      const endedByUser =
        /\b(end|finish|stop)\s+(the\s+)?interview\b/i.test(content);

      await db
        .collection<InterviewSessionDocument>("interviewSessions")
        .updateOne(
          {
            _id: interview._id,
            userId: req.user!.id,
          },
          {
            $push: { messages: assistantMessage },
            $set: {
              updatedAt: new Date(),
              ...(endedByUser ? { status: "completed" as const } : {}),
            },
          },
        );

      writeSse(res, "done", {
        messageId: assistantMessage.id,
        completed: endedByUser,
        createdAt: assistantMessage.createdAt.toISOString(),
      });

      res.end();
    } catch (error) {
      next(error);
    }
  },
);
