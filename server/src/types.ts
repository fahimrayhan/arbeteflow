import type { ObjectId } from "mongodb";

export type JobStatus =
  | "bookmarked"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected";

export type CoachMode = "resume" | "career" | "jobcritic";

export type InterviewType =
  | "behavioral"
  | "technical"
  | "mixed"
  | "case";

export type InterviewDifficulty = "junior" | "mid" | "senior";

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

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}
