import { HttpError } from "../lib/http.js";

export type GuardTask = "coach" | "resume" | "cover-letter" | "interview" | "recommendation";

export type GuardReport = {
  task: GuardTask;
  promptVersion: "2026-10-19";
  checks: string[];
  flags: string[];
};

const MAX_FIELD_LENGTH = 50_000;
// Control characters except tab (\u0009) and line feed (\u000a); the original range also removed every line break.
const INVISIBLE_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;

const INJECTION_PATTERNS = [
  /\b(ignore|disregard|forget|override)\s+(all|any|the|previous|prior|above|earlier)\s+(instructions?|rules?)/i,
  // Swedish
  /\b(ignorera|bortse från|glöm)\s+(alla|tidigare|föregående|dina)\s+(instruktioner|regler)/i,
  /\b(reveal|print|show|repeat|dump)\b.{0,40}\b(system prompt|developer message|hidden instructions?)\b/i,
  /\b(you are now|developer mode|jailbreak|do anything now)\b/i,
  // Persona hijacks only. Plain "act as a team lead" or "act as my interviewer" stays allowed.
  /\b(act as|pretend to be|you are)\s+(an?\s+)?(DAN|developer|root|admin|unrestricted|jailbroken|evil|different (ai|assistant))\b/i,
  /(?:^|\n)\s*(?:system|assistant|developer)\s*:/i,
  /<\/?(?:system|assistant|developer|resume|job_description|user_message|retrieved_context)\b/i,
  // Encoded instructions: needs an instruction to decode/run, so a resume that merely mentions base64 passes.
  /\b(decode|decrypt|execute|run|follow)\b[^.\n]{0,30}\b(base64|rot13|hex|encoded|obfuscated)\b/i,
  /\b(decode this|encoded instructions?)\b/i,
];

// Things that can be made up on a resume.
const ITEM = String.raw`(?:skills?|projects?|experience|degrees?|education|certifications?|certificates?|employers?|jobs?|references?|achievements?|accomplishments?|metrics?|qualifications?|awards?|titles?|salary|kompetens\w*|erfarenhet\w*|examen|projekt)`;
// "fabricated skills", "fake projects", "made-up experience" (adjective forms)
const FAKE_ADJ = String.raw`(?:fabricated|fake|faked|made[- ]?up|fictitious|bogus|imaginary|non-?existent|påhittade|fabricerade|fejkade)`;
// "fabricate skills", "invent a degree", "make up some experience" (base verb forms, as in a request)
const FAKE_VERB = String.raw`(?:fabricate|fake|invent|make\s+up|exaggerate|embellish|påhitta|fabricera|hitta\s+på|fejka)`;

const DISHONEST_PATTERNS = [
  new RegExp(String.raw`\b${FAKE_ADJ}\s+(?:\w+\s+)?${ITEM}\b`, "i"),
  new RegExp(String.raw`\b${FAKE_VERB}\s+(?:\w+\s+){0,2}${ITEM}\b`, "i"),
  // "skills that are fabricated"
  new RegExp(String.raw`\b${ITEM}\s+(?:that\s+(?:are|is)|which\s+(?:are|is)|(?:are|is|should be|must be|to be))\s+(?:fabricated|fake|made[- ]?up|invented|fictitious|bogus)\b`, "i"),
  /\b(?:lie|lying|lies)\s+(?:about|on)\b[^.\n]{0,30}\b(?:experience|degree|skills?|resume|cv|references?)\b/i,
  /\bpretend\b[^.\n]{0,20}\b(?:i|that i|to)\b[^.\n]{0,30}\b(?:have|had|hold|worked|studied|am)\b/i,
  // "Add a master's degree even though I do not have one"
  /\b(?:add|include|claim|list|put|write|say)\b[^.\n]{0,50}\b(?:even though|although|despite the fact that)\s+i\s+(?:do not|don't|did not|didn't|have not|haven't|never|lack|have no)\b/i,
];

const DISCRIMINATION_PATTERNS = [
  /\b(screen|rank|reject|filter|exclude|sort)\b.{0,60}\b(gender|sex|age|ethnic|nationality|religion|disab|marital|pregnan|sexual orientation|race)\b/i,
  // Preference or exclusion, not someone describing themselves ("I am a female applicant" passes)
  /\b(?:only hire|prefer|reject|exclude|avoid)\b[^.\n]{0,25}\b(?:young(?:er)?|old(?:er)?|female|male|women|men|native speakers?|citizens? only)\b[^.\n]{0,25}\b(?:candidates?|applicants?|hires?|workers?|employees?)\b/i,
  /\b(?:citizens? only|native speakers? only)\b/i,
];

// Only clearly harmful requests. Ordinary words like "write", "build" or "kill it" must not be blocked.
const OUT_OF_SCOPE_PATTERNS = [
  /\b(?:write|build|create|develop|code|make|deploy)\b[^.\n]{0,40}\b(?:malware|ransomware|virus|keylogger|trojan|botnet|phishing|exploit|backdoor)\b/i,
  /\b(?:hack(?:ing)?\s+into|steal\s+(?:data|passwords?|credentials?|money|identity)|ransomware|malware|phishing)\b/i,
  /\b(?:build|make|assemble|manufacture)\s+(?:an?\s+)?(?:bomb|weapon|explosive)s?\b/i,
  /\bkill\s+(?:him|her|them|someone|people)\b/i,
  /\b(?:sexual\s+(?:content|story|roleplay|fantasy)|explicit\s+sexual|porn\w*|erotic\w*)\b/i,
  /\b(?:do my homework|cheat on|impersonat\w+)\b/i,
  // Revealing blurred or censored sensitive locations
  /\b(?:deblur|unblur|de-?blur|uncensor|depixelate)\b[^.\n]{0,60}\b(?:restricted|censored|classified|military|secret)\b/i,
  // Requests to write abusive messages ("write a message to bully a classmate")
  /\b(?:write|draft|compose|send|help me)\b[^.\n]{0,40}\b(?:bully|harass|threaten|intimidate|insult|humiliate)\b/i,
];
// Group stereotypes: "Women are bad at math", "Bangladeshi are usually..."
const GROUPS = String.raw`(?:women|men|girls|boys|immigrants|muslims|jews|christians|blacks|whites|asians|arabs|africans|old people|older people|young people|bangladeshis?|indians?|pakistanis?|swedes?|chinese)`;
const STEREOTYPE_PATTERNS = [
  new RegExp(String.raw`\b${GROUPS}\s+(?:are|is|aren'?t)\s+(?:\w+\s+){0,2}(?:bad|worse|better|lazy|stupid|dumb|inferior|superior|smarter|weaker|violent|criminals?|terrorists?)\b`, "i"),
  new RegExp(String.raw`\b${GROUPS}\s+(?:are|is)\s+(?:usually|always|generally|typically|naturally|mostly)\b`, "i"),
  /\b(?:complete|finish)\s+the\s+sentence\b[^\n]{0,60}\b(?:usually|always|generally|typically|naturally|mostly|all)\b/i,
];
// First person only, so "I worked in suicide prevention" is not treated as a crisis.
const SELF_HARM_PATTERNS = [
  /\b(?:kill myself|end my life|want to die|hurt myself|harm myself|suicidal|commit suicide)\b/i,
];
const NONCAREER_ETHICS_PATTERNS = [
  /\b(find|found|finds)\b.{0,40}\b(wallet|purse)\b/i,
  /\b(return|keep)\b.{0,35}\b(money|cash)\b/i,
  /\b(moral|ethical)\s+dilemma\b/i,
  /\b(is it ever okay|is it ever right|should one)\b.{0,60}\b(break|lie|steal|promise|rule)\b/i,
  /\b(give|explain|discuss)\s+(both sides|pros and cons)\b.{0,80}\b(promise|moral|ethical|right|wrong)\b/i,
  /\bwhat would you do\b.{0,30}\b(a|b)\b/i,
  /\b(answer|choose)\s+[ab]\b/i,
  // "(A) lie or (B) tell the truth" style multiple-choice dilemmas
  /\(\s*[ab]\s*\)[^()]{1,80}\bor\b[^()]{0,10}\(\s*[ab]\s*\)/i,
  /\bdo you\b[^.?]{0,60}\bor\b[^.?]{0,40}\?/i,
];
const CAREER_CONTEXT_PATTERNS = [
  /\b(job|work|career|resume|cv|interview|employer|employee|manager|workplace|application|cover letter|role|salary|colleague|client|professional|engineer|developer|analyst|designer|teacher|nurse|consultant|intern|specialist|coordinator|director|assistant|officer|scientist|architect|administrator|recruiter|sales|marketing|finance|accountant|researcher|product|data|customer support)\b/i,
];
const OFF_TOPIC_OUTPUT_PATTERNS = [
  /\b(wallet|purse)\b.{0,120}\b(return|keep|money|cash)\b/i,
  /\b(return|keep)\b.{0,50}\b(wallet|money|cash)\b/i,
  /\b(recipe|directions to|joke|political campaign|medical diagnosis)\b/i,
  /\b(lie|lying)\b.{0,30}\b(police|friend)\b/i,
  /\bchoose\s+\(?[ab]\)?\b.{0,30}\b(or|versus)\b.{0,30}\b(keep|return|steal)\b/i,
];

export function normalizeUserText(value: string, maxLength = MAX_FIELD_LENGTH): string {
  return value
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
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
  // Checked per field, so a dilemma typed into one field is caught even when the other fields look like a real job.
  const hasNonCareerEthics = Object.values(values).some(
    (value) =>
      Boolean(value) &&
      findPattern(value as string, NONCAREER_ETHICS_PATTERNS) &&
      !findPattern(value as string, CAREER_CONTEXT_PATTERNS),
  );
  const hasGeneralHarmfulContent =
    (task === "coach" || task === "interview") && findPattern(combined, OUT_OF_SCOPE_PATTERNS);

  if (hasNonCareerEthics || hasGeneralHarmfulContent) {
    flags.push("out-of-scope-or-harmful");
  }
  if ((task === "coach" || task === "interview") && findPattern(combined, STEREOTYPE_PATTERNS)) {
    flags.push("stereotype");
  }
  if ((task === "coach" || task === "interview") && findPattern(combined, SELF_HARM_PATTERNS)) {
    flags.push("self-harm");
  }

  return { task, promptVersion: "2026-10-19", checks, flags };
}

// Short form fields must hold a name or a title, not a question or an instruction.
// Adjust the key names to match your routes.
const SHORT_FIELD_LIMITS: Record<string, number> = {
  company: 120,
  role: 120,
  targetRole: 120,
  jobTitle: 120,
  industry: 100,
};

function assertShortFieldsLookLikeNames(values: Record<string, string | undefined>): void {
  for (const [key, limit] of Object.entries(SHORT_FIELD_LIMITS)) {
    const value = values[key];
    if (!value) continue;
    const words = value.split(/\s+/).filter(Boolean).length;
    if (value.length > limit || words > 12 || /[?\n]/.test(value) || /\(\s*[ab]\s*\)/i.test(value)) {
      throw new HttpError(400, "Company, role and industry should be a short name or title, not a question or an instruction.");
    }
  }
}

export function enforceInputGuards(
  task: GuardTask,
  values: Record<string, string | undefined>,
): { values: Record<string, string | undefined>; report: GuardReport } {
  const normalized = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === undefined ? undefined : normalizeUserText(value)]),
  );
  assertShortFieldsLookLikeNames(normalized);
  const report = inspectUserInput(task, normalized);

  // Distress comes first: answer with care, not with a policy refusal.
  if (report.flags.includes("self-harm")) {
    throw new HttpError(400, "I'm sorry you're going through this. I'm a career tool and can't help with it, but please talk to someone you trust or a professional. If you are in danger right now, call 112. In Sweden you can also reach Mind Självmordslinjen on 90101.");
  }
  if (report.flags.includes("prompt-injection")) {
    throw new HttpError(400, "This input contains instruction-like text that cannot be safely processed. Remove it or paste only the relevant career content. See Responsible AI for why.");
  }
  if (report.flags.includes("dishonest-claim")) {
    throw new HttpError(400, "I can help present your real experience clearly, but I cannot fabricate qualifications, employers, certifications, or results.");
  }
  if (report.flags.includes("protected-attribute-discrimination")) {
    throw new HttpError(400, "I cannot help screen or rank people using protected characteristics. I can help compare job-related skills and requirements instead.");
  }
  if (report.flags.includes("stereotype")) {
    throw new HttpError(400, "I don't make generalizations about groups of people, and I won't judge anyone by gender, nationality or similar traits. I can help with job-related skills and your career instead.");
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
    // Labelled personal fields only ("Address: ...", "Nationality - ..."), so a bullet such as
    // "Address customer complaints" or "Born into ..." keeps its content.
    .replace(/\b(?:date of birth|dob|age|gender|sex|nationality|citizenship|marital status|religion|disability|photo|address|street|postcode|zip code)\b\s*[:\-–]\s*[^\n|]*/gi, "")
    .replace(/\bborn\s+(?:on\s+|in\s+)?\d[^\n|]*/gi, "")
    .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "")
    // Phone numbers need 9+ digits, so year ranges such as 2019-2023 stay.
    .replace(/\+?\d[\d\s().-]{7,}\d/g, (match) => (match.replace(/\D/g, "").length >= 9 ? "" : match))
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function lintGeneratedText(text: string, source: string): string[] {
  const flags: string[] = [];
  const biased = /\b(rockstar|ninja|digital native|young and energetic|native speaker|clean[- ]cut|manpower|he\/she)\b/gi;
  const matches = text.match(biased);
  if (matches) flags.push(`biased-language:${[...new Set(matches.map((item) => item.toLowerCase()))].join(",")}`);
  if (/\b(ignore previous|system prompt|developer message|jailbreak)\b/i.test(text)) flags.push("instruction-leak");
  // Email addresses in the output that are not in the source were invented by the model.
  const emails = text.match(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g) ?? [];
  if (emails.some((email) => !source.toLowerCase().includes(email.toLowerCase()))) flags.push("unsupported-contact-detail");
  if (source && /\b\d{1,3}%\b/.test(text) && !/\b\d{1,3}%\b/.test(source)) flags.push("unsupported-metric");
  return flags;
}

// The prompt tells the model to answer unrelated requests with a fixed redirect sentence.
// Small models often print it and then answer anyway, so a reply that starts with it is treated as off-topic
// and replaced by the safe fallback in full.
const SCOPE_REDIRECT_PREFIX = /^\s*I[’']m ArbeteFlow\.\s*I can help with/i;

export function validateCareerOutput(text: string): string | undefined {
  const normalized = normalizeUserText(text, 8_000);
  if (SCOPE_REDIRECT_PREFIX.test(normalized)) {
    return "off-topic-output";
  }
  if (findPattern(normalized, OFF_TOPIC_OUTPUT_PATTERNS)) {
    return "off-topic-output";
  }
  return undefined;
}