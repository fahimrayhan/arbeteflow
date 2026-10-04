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

  await runSseStream(req, res, async (stream) => {
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
        research = await researchCompany({ company: input.company, role: input.role });
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
      ...input,
      companyResearch: research?.context,
    });

    await streamLlmResponse({
      systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      signal: stream.signal,
      onToken: (token) => stream.send("token", { token }),
    });

    stream.send("done", {});
  }, "Cover letter generation failed.");
}));
