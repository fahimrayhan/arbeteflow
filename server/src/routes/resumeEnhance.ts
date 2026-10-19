import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { streamLlmResponse } from '../services/llm.js';

const resumeEnhanceSchema = z.object({
  resumeText: z.string().trim().min(1).max(50_000),
  targetRole: z.string().trim().max(200).optional(),
  industry: z.string().trim().max(100).optional(),
});

function writeSse(
  res: Response,
  event: string,
  data: unknown,
): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function optionalField(
  label: string,
  value: string | undefined,
): string {
  return value?.trim()
    ? `${label}: ${value.trim()}`
    : '';
}

export const resumeEnhanceRouter = Router();

resumeEnhanceRouter.post(
  '/',
  requireAuth,
  async (req, res, next) => {
    try {
      const input = resumeEnhanceSchema.parse(req.body);

      const systemPrompt = `
You create complete professional resumes from rough candidate notes.

OUTPUT RULES:
- Return a complete resume, never a sentence summary.
- Return only the resume.
- Use plain text, not JSON.
- Use the exact section headings shown below.
- If information is missing, use [bracketed placeholders].
- Never output the words "Not specified".
- Never invent facts, dates, degrees, metrics, projects, skills, or contact details.
- Do not explain what you are doing.

REQUIRED OUTPUT FORMAT:

FULL NAME
TARGET JOB TITLE
[Email] | [Phone] | [Location] | [LinkedIn] | [GitHub or Portfolio]

PROFESSIONAL SUMMARY
2 or 3 sentences using only known facts.

EXPERIENCE
Job Title | Company | [Location]
[Start Date] – Present
- A responsibility supported by the notes.
- A second responsibility supported by the notes.
- [Add a truthful project, achievement, or measurable outcome.]

PROJECTS
[Project Name] | [Technologies]
- [Add a truthful project description.]

EDUCATION
[Degree] | [Institution] | [Graduation Year]

TECHNICAL SKILLS
- [Known skill]
- [Add relevant skills]

CERTIFICATIONS
- [Add certifications if applicable.]

EXAMPLE:

Candidate notes:
"My name is Kostas. I am a machine learning engineer at AB Company. I have experience with TensorFlow."

Correct output:
KOSTAS
Machine Learning Engineer
[Email] | [Phone] | [Location] | [LinkedIn] | [GitHub or Portfolio]

PROFESSIONAL SUMMARY
Machine Learning Engineer with experience at AB Company and practical experience using TensorFlow. Interested in developing and improving machine learning solutions.

EXPERIENCE
Machine Learning Engineer | AB Company | [Location]
[Start Date] – Present
- Use TensorFlow in machine learning work at AB Company.
- [Add a truthful responsibility, model type, or business problem.]
- [Add a truthful project, achievement, or measurable outcome.]

PROJECTS
[Project Name] | TensorFlow
- [Add a truthful project description.]

EDUCATION
[Degree] | [Institution] | [Graduation Year]

TECHNICAL SKILLS
- TensorFlow
- [Add programming languages, data tools, and MLOps tools.]

CERTIFICATIONS
- [Add certifications if applicable.]

Follow the format and behavior in the example for every user input.
`;

      const userPrompt = [
        'Create a complete resume from the candidate notes below.',
        optionalField('Requested target role', input.targetRole),
        optionalField('Industry', input.industry),
        '',
        'CANDIDATE NOTES:',
        input.resumeText,
      ]
        .filter(Boolean)
        .join('\n');

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      await streamLlmResponse({
        systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        maxTokens: 700,
        onToken: (token) => {
          writeSse(res, 'token', { token });
        },
      });

      writeSse(res, 'done', {});
      res.end();
    } catch (error) {
      if (res.headersSent) {
        writeSse(res, 'error', {
          error:
            error instanceof Error
              ? error.message
              : 'Resume generation failed.',
        });

        res.end();
        return;
      }

      next(error);
    }
  },
);
