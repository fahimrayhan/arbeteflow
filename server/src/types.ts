import type { ObjectId } from "mongodb";

/*
  Enum values are declared once as const tuples so the same source feeds
  both the TypeScript types and the zod request schemas.
*/
export const JOB_STATUSES = [
  "bookmarked",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const COACH_MODES = ["resume", "career", "jobcritic"] as const;
export type CoachMode = (typeof COACH_MODES)[number];

export const INTERVIEW_TYPES = ["behavioral", "technical", "mixed", "case"] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_DIFFICULTIES = ["junior", "mid", "senior"] as const;
export type InterviewDifficulty = (typeof INTERVIEW_DIFFICULTIES)[number];

export const MODEL_PROVIDERS = ["vllm", "ollama", "openai", "anthropic"] as const;
export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export const COVER_LETTER_TONES = ["professional", "confident", "warm"] as const;
export type CoverLetterTone = (typeof COVER_LETTER_TONES)[number];

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface ResumeDocument {
  _id?: ObjectId;
  userId: string;
  title: string;
  rawText: string;
  enhancedText?: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobDocument {
  _id?: ObjectId;
  userId: string;
  company: string;
  role: string;
  location: string;
  status: JobStatus;
  salary?: string;
  appliedDate?: string;
  deadline?: string;
  notes: string;
  url?: string;
  jobDescription?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSessionDocument {
  _id?: ObjectId;
  userId: string;
  mode: CoachMode;
  messages: StoredMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface InterviewFeedback {
  overallScore: number;
  strengths: string[];
  improvements: string[];
  suggestedAnswers: string[];
  preparationPlan: string[];
}

export interface InterviewSessionDocument {
  _id?: ObjectId;
  userId: string;
  role: string;
  company?: string;
  jobDescription?: string;
  interviewType: InterviewType;
  difficulty: InterviewDifficulty;
  resumeId?: string;
  status: "active" | "completed";
  messages: StoredMessage[];
  feedback?: InterviewFeedback;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredModelConfig {
  _id: "model-configuration";
  provider: ModelProvider;
  baseUrl: string;
  model: string;
  apiKey: string;
  updatedAt: Date;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}
