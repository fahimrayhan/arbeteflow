import type { NextFunction, Request, Response } from "express";
import { config } from "../config.js";

/*
  DEVELOPMENT ONLY:
  Send x-user-id: any-stable-local-id from your frontend.

  Replace this with verified JWT/session middleware from:
  - Clerk
  - Firebase Auth
  - Auth0
  - Better Auth
  - Auth.js / NextAuth

  The key rule: do not accept userId from the JSON body.
  Derive it from verified authentication.
*/
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (config.allowDevelopmentAuth) {
    const userId = req.header("x-user-id")?.trim();

    if (!userId) {
      res.status(401).json({
        error:
          "Missing x-user-id. Set a stable development user ID in the frontend.",
      });
      return;
    }

    req.user = { id: userId };
    next();
    return;
  }

  res.status(501).json({
    error:
      "Authentication is not configured. Replace development auth with verified session/JWT middleware.",
  });
}
