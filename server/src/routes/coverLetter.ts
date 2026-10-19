import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/http.js";
import { runSseStream } from "../lib/sse.js";
import { requireAuth } from "../middleware/auth.js";
import {
  isResearchAvailable,
  researchCompany,
  ResearchError,
  type CompanyResearch,
} from "../services/companyResearch.js";
import { streamLlmResponse } from "../services/llm.js";
import { buildCoverLetterPrompts } from "../services/prompts.js";
import { COVER_LETTER_TONES } from "../types.js";
import {
  enforceInputGuards,
  lintGeneratedText,
  validateCareerOutput,
} from "../services/guardrails.js";

const coverLetterSchema = z.object({
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  jobDescription: z.string().trim().max(50_000).optional(),
  resumeText: z.string().trim().max(50_000).optional(),
  tone: z.enum(COVER_LETTER_TONES),
  /** Search the web for the company before writing. */
  researchCompany: z.boolean().optional().default(false),
});

export const coverLetterRouter = Router();

/** Lets the UI enable or disable optional features. */
coverLetterRouter.get("/capabilities", requireAuth, (_req, res) => {
  res.json({ companyResearch: isResearchAvailable() });
});

coverLetterRouter.post("/generate", requireAuth, asyncHandler(async (req, res) => {
  const input = coverLetterSchema.parse(req.body);
  const guarded = enforceInputGuards("cover-letter", {
    company: input.company,
    role: input.role,
    jobDescription: input.jobDescription,
    resumeText: input.resumeText,
  });
  const guardedInput = {
    ...input,
    company: guarded.values.company!,
    role: guarded.values.role!,
    jobDescription: guarded.values.jobDescription,
    resumeText: guarded.values.resumeText,
  };

  await runSseStream(req, res, async (stream) => {
    stream.send("guard", guarded.report);
    /*
      Research events:
        { status: "searching" }                 — search started
        { status: "used", sources: [...] }      — results are in the prompt
        { status: "skipped", reason: "..." }    — search failed; the letter is written without it
    */
    let research: CompanyResearch | undefined;

    if (input.researchCompany) {
      stream.send("research", { status: "searching" });

      try {
        research = await researchCompany({ company: guardedInput.company, role: guardedInput.role });
        stream.send("research", { status: "used", sources: research.sources });
      } catch (error) {
        const reason =
          error instanceof ResearchError ? error.message : "The company research failed.";
        if (!(error instanceof ResearchError)) {
          console.error("[research]", error);
        }
        stream.send("research", { status: "skipped", reason });
      }
    }

    const { systemPrompt, userPrompt } = buildCoverLetterPrompts({
      ...guardedInput,
      companyResearch: research?.context,
    });

    await streamLlmResponse({
      systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      signal: stream.signal,
      onToken: (token) => stream.send("token", { token }),
      onComplete: (text) => stream.send("guard", { ...guarded.report, outputFlags: lintGeneratedText(text, `${guardedInput.resumeText ?? ""}\n${guardedInput.jobDescription ?? ""}`) }),
      outputGuard: {
        validate: validateCareerOutput,
        fallback:
          "I can only write cover letters for a real job application. Provide a company, target role, and relevant job details.",
      },
    });

    stream.send("done", {});
  }, "Cover letter generation failed.");
}));
