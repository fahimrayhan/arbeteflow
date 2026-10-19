import { MongoClient, type Collection, type Db } from "mongodb";
import { config } from "./config.js";
import type {
  ChatSessionDocument,
  InterviewSessionDocument,
  JobDocument,
  ResumeDocument,
  StoredModelConfig,
} from "./types.js";

let clientPromise: Promise<MongoClient> | undefined;

function connect(): Promise<MongoClient> {
  if (!clientPromise) {
    const client = new MongoClient(config.mongoUri, {
      serverSelectionTimeoutMS: 10_000,
    });

    clientPromise = client.connect().catch((error: unknown) => {
      // Allow the next call to retry instead of caching a rejected promise forever.
      clientPromise = undefined;
      throw error;
    });
  }

  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await connect();
  return client.db(config.mongoDbName);
}

export interface Collections {
  resumes: Collection<ResumeDocument>;
  jobs: Collection<JobDocument>;
  chatSessions: Collection<ChatSessionDocument>;
  interviewSessions: Collection<InterviewSessionDocument>;
  appSettings: Collection<StoredModelConfig>;
}

/** Typed access to every collection, so names are defined in one place. */
export async function collections(): Promise<Collections> {
  const db = await getDb();

  return {
    resumes: db.collection<ResumeDocument>("resumes"),
    jobs: db.collection<JobDocument>("jobs"),
    chatSessions: db.collection<ChatSessionDocument>("chatSessions"),
    interviewSessions: db.collection<InterviewSessionDocument>("interviewSessions"),
    appSettings: db.collection<StoredModelConfig>("appSettings"),
  };
}

export async function ensureIndexes(): Promise<void> {
  const { resumes, jobs, chatSessions, interviewSessions } = await collections();

  await Promise.all([
    resumes.createIndex(
      { userId: 1, updatedAt: -1 },
      { name: "resumes_by_user_updated" },
    ),
    resumes.createIndex(
      { userId: 1, isPrimary: 1 },
      { name: "primary_resume_by_user" },
    ),
    jobs.createIndex(
      { userId: 1, status: 1, updatedAt: -1 },
      { name: "jobs_by_user_status_updated" },
    ),
    chatSessions.createIndex(
      { userId: 1, updatedAt: -1 },
      { name: "chat_sessions_by_user_updated" },
    ),
    interviewSessions.createIndex(
      { userId: 1, updatedAt: -1 },
      { name: "interviews_by_user_updated" },
    ),
  ]);
}

export async function closeDb(): Promise<void> {
  if (!clientPromise) {
    return;
  }

  const client = await clientPromise.catch(() => undefined);
  clientPromise = undefined;
  await client?.close();
}
