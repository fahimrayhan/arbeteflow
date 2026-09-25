import { MongoClient, type Db } from "mongodb";
import { config } from "./config.js";

let clientPromise: Promise<MongoClient> | undefined;

export async function getDb(): Promise<Db> {
  if (!clientPromise) {
    const client = new MongoClient(config.mongoUri);
    clientPromise = client.connect();
  }

  const client = await clientPromise;
  return client.db(config.mongoDbName);
}

export async function ensureIndexes(): Promise<void> {
  const db = await getDb();

  await Promise.all([
    db.collection("resumes").createIndex(
      { userId: 1, updatedAt: -1 },
      { name: "resumes_by_user_updated" },
    ),
    db.collection("resumes").createIndex(
      { userId: 1, isPrimary: 1 },
      { name: "primary_resume_by_user" },
    ),
    db.collection("jobs").createIndex(
      { userId: 1, status: 1, updatedAt: -1 },
      { name: "jobs_by_user_status_updated" },
    ),
    db.collection("chatSessions").createIndex(
      { userId: 1, updatedAt: -1 },
      { name: "chat_sessions_by_user_updated" },
    ),
    db.collection("interviewSessions").createIndex(
      { userId: 1, updatedAt: -1 },
      { name: "interviews_by_user_updated" },
    ),
  ]);
}
