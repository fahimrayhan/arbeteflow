import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http.js";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: "Route not found." });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Invalid request data.",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  // body-parser errors (malformed JSON, payload too large) carry a status.
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status < 500
  ) {
    res.status(error.status).json({ error: "Malformed or oversized request body." });
    return;
  }

  if (error instanceof HttpError) {
    if (error.status >= 500) {
      console.error(`[http] ${req.method} ${req.originalUrl}:`, error);
    }

    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error(`[http] ${req.method} ${req.originalUrl}:`, error);
  res.status(500).json({ error: "An unexpected server error occurred." });
}
