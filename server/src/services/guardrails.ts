import { HttpError } from "../lib/http.js";

export type GuardTask = "coach" | "resume" | "cover-letter" | "interview" | "recommendation";

export type GuardReport = {
  task: GuardTask;
  promptVersion: "2026-10-19";
  checks: string[];
  flags: string[];
};

const MAX_FIELD_LENGTH = 50_000;
const INVISIBLE_CHARS = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;
const INJECTION_PATTERNS = [
  /\b(ignore|disregard|forget|override)\s+(all|any|the|previous|prior|above|earlier)\s+(instructions?|rules?)/i,
  /\b(reveal|print|show|repeat|dump)\b.{0,40}\b(system prompt|developer message|hidden instructions?)\b/i,
  /\b(you are now|act as|developer mode|jailbreak|dan\b)/i,
  /(?:^|\n)\s*(?:system|assistant|developer)\s*:/i,
  /<\/?(?:system|assistant|developer|resume|job_description|user_message|retrieved_context)\b/i,
  /\b(base64|rot13|decode this|obfuscat|encoded instructions?)\b/i,
];
const DISHONEST_PATTERNS = [
  /\b(make|invent|fabricate|fake|lie about|pretend)\b.{0,50}\b(experience|degree|certification|employer|reference|metrics?|salary|skills?)\b/i,
  /\b(add|claim)\b.{0,35}\b(fake|made[- ]up|untrue)\b/i,
];
const DISCRIMINATION_PATTERNS = [
  /\b(screen|rank|reject|filter|exclude|prefer|sort)\b.{0,60}\b(gender|sex|age|ethnic|nationality|religion|disab|marital|pregnan|sexual orientation|race)\b/i,
  /\b(young|old|female|male|native speaker|citizen only)\b.{0,35}\b(candidate|applicant|hire|reject)\b/i,
];
const OUT_OF_SCOPE_PATTERNS = [
  /\b(build|write|deploy|hack|ransom|steal|malware|phish|exploit)\b/i,
  /\b(weapon|bomb|self[- ]harm|suicide|kill|sexual)\b/i,
  /\b(do my homework|cheat on|impersonat)\b/i,
];
const NONCAREER_ETHICS_PATTERNS = [
  /\b(find|found|finds| 발견)\b.{0,40}\b(wallet|purse)\b/i,
  /\b(return|keep)\b.{0,35}\b(money|cash)\b/i,
  /\b(moral|ethical)\s+dilemma\b/i,
  /\b(is it ever okay|is it ever right|should one)\b.{0,60}\b(break|lie|steal|promise|rule)\b/i,
  /\b(give|explain|discuss)\s+(both sides|pros and cons)\b.{0,80}\b(promise|moral|ethical|right|wrong)\b/i,
  /\bwhat would you do\b.{0,30}\b(a|b)\b/i,
  /\b(answer|choose)\s+[ab]\b/i,
];
const CAREER_CONTEXT_PATTERNS = [
  /\b(job|work|career|resume|cv|interview|employer|employee|manager|workplace|application|cover letter|role|salary|colleague|client|professional|engineer|developer|analyst|designer|teacher|nurse|consultant|intern|specialist|coordinator|director|assistant|officer|scientist|architect|administrator|recruiter|sales|marketing|finance|accountant|researcher|product|data|customer support)\b/i,
];
const OFF_TOPIC_OUTPUT_PATTERNS = [
  /\b(wallet|purse)\b.{0,120}\b(return|keep|money|cash)\b/i,
  /\b(return|keep)\b.{0,50}\b(wallet|money|cash)\b/i,
  /\b(recipe|directions to|joke|political campaign|medical diagnosis)\b/i,
  /\bchoose\s+\(?[ab]\)?\b.{0,30}\b(or|versus)\b.{0,30}\b(keep|return|steal)\b/i,
];

export function normalizeUserText(value: string, maxLength = MAX_FIELD_LENGTH): string {
  return value
    .normalize("NFKC")
    .replace(INVISIBLE_CHARS, "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function findPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export function inspectUserInput(task: GuardTask, values: Record<string, string | undefined>): GuardReport {
  const checks = ["normalization", "prompt-injection", "honesty", "fairness", "scope"];
  const flags: string[] = [];
  const combined = Object.values(values).filter(Boolean).join("\n");

  if (findPattern(combined, INJECTION_PATTERNS)) flags.push("prompt-injection");
  if (findPattern(combined, DISHONEST_PATTERNS)) flags.push("dishonest-claim");
  if (findPattern(combined, DISCRIMINATION_PATTERNS)) flags.push("protected-attribute-discrimination");
  const hasNonCareerEthics =
    findPattern(combined, NONCAREER_ETHICS_PATTERNS) &&
    !findPattern(combined, CAREER_CONTEXT_PATTERNS);
  const hasGeneralHarmfulContent =
    (task === "coach" || task === "interview") && findPattern(combined, OUT_OF_SCOPE_PATTERNS);

  if (hasNonCareerEthics || hasGeneralHarmfulContent) {
    flags.push("out-of-scope-or-harmful");
  }

  return { task, promptVersion: "2026-10-19", checks, flags };
}

export function enforceInputGuards(
  task: GuardTask,
  values: Record<string, string | undefined>,
): { values: Record<string, string | undefined>; report: GuardReport } {
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === undefined ? undefined : normalizeUserText(value)]),
  );
  const report = inspectUserInput(task, normalized);

  if (report.flags.includes("prompt-injection")) {
    throw new HttpError(400, "This input contains instruction-like text that cannot be safely processed. Remove it or paste only the relevant career content. See Responsible AI for why.");
  }
  if (report.flags.includes("dishonest-claim")) {
    throw new HttpError(400, "I can help present your real experience clearly, but I cannot fabricate qualifications, employers, certifications, or results.");
  }
  if (report.flags.includes("protected-attribute-discrimination")) {
    throw new HttpError(400, "I cannot help screen or rank people using protected characteristics. I can help compare job-related skills and requirements instead.");
  }
  if (report.flags.includes("out-of-scope-or-harmful")) {
    throw new HttpError(400, "I can help with careers, applications, resumes, job searching, and interview practice. I cannot help with that request.");
  }

  return { values: normalized, report };
}

export function wrapUntrustedData(value: string | undefined, label: string, fallback: string): string {
  const token = `${label}_${Math.random().toString(36).slice(2, 10)}`;
  const safeValue = normalizeUserText(value ?? "") || fallback;
  return `<${token}>\n${safeValue.replaceAll(`<${label}>`, `[${label}]`).replaceAll(`</${label}>`, `[/${label}]`)}\n</${token}>`;
}

export function anonymizeResumeForMatching(value: string): string {
  return normalizeUserText(value)
    .replace(/\b(?:date of birth|dob|born|age|gender|sex|nationality|citizenship|marital status|religion|disability|photo|address|street|postcode|zip code)\b[^\n|]*/gi, "")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "")
    .replace(/(?:\+?\d[\d\s().-]{7,})/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function lintGeneratedText(text: string, source: string): string[] {
  const flags: string[] = [];
  const biased = /\b(rockstar|ninja|digital native|young and energetic|native speaker|clean[- ]cut|manpower|he\/she)\b/gi;
  const matches = text.match(biased);
  if (matches) flags.push(`biased-language:${[...new Set(matches.map((item) => item.toLowerCase()))].join(",")}`);
  if (/\b(ignore previous|system prompt|developer message|jailbreak)\b/i.test(text)) flags.push("instruction-leak");
  if (source && /\b\d{1,3}%\b/.test(text) && !/\b\d{1,3}%\b/.test(source)) flags.push("unsupported-metric");
  return flags;
}

export function validateCareerOutput(text: string): string | undefined {
  const normalized = normalizeUserText(text, 8_000);
  if (findPattern(normalized, OFF_TOPIC_OUTPUT_PATTERNS)) {
    return "off-topic-output";
  }
  return undefined;
}
