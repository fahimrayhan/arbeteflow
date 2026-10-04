import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ObjectId } from "mongodb";

/**
 * An error whose message is safe to show to the client.
 * Anything that is not an HttpError is reported as a generic 500.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const notFound = (message: string) => new HttpError(404, message);

/** Wraps an async route so rejected promises reach the Express error handler. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}

export function parseObjectId(value: unknown, label: string): ObjectId {
  const raw = String(value ?? "");

  if (!ObjectId.isValid(raw)) {
    throw badRequest(`Invalid ${label}.`);
  }

  return new ObjectId(raw);
}

/** Returns the authenticated user ID. `requireAuth` must run before the handler. */
export function userIdOf(req: Request): string {
  const userId = req.user?.id;

  if (!userId) {
    throw new HttpError(401, "Not authenticated.");
  }

  return userId;
}

export function publicErrorMessage(error: unknown, fallback: string): string {
  return error instanceof HttpError ? error.message : fallback;
}
