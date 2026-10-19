import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Database, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { cardStyle, fieldStyle, foregroundText, mutedText, primaryText, secondaryButtonStyle } from '../components/ui/styles';

type Section = 'overview' | 'privacy' | 'responsible' | 'fairness' | 'setup' | 'disclaimer' | 'faq';

const FAQS = [
  ['Is my data sent anywhere?', 'The app sends text to the model provider you select when you request AI help. With a local model, it can stay on your computer. Cloud providers receive the text needed for the request and apply their own terms and retention policies.'],
  ['Do you store my resume?', 'Saved resumes, applications, interview sessions, and model settings are stored in this app’s MongoDB. The app has no analytics or telemetry. Delete saved content from the relevant page; deleting the database volume removes all local data.'],
  ['What happens with a cloud API key?', 'The server encrypts provider keys before storing them in MongoDB and never returns the key to the browser. Never export or share database files without protecting the encryption key.'],
  ['Does the model make things up?', 'It can. The guardrails discourage unsupported claims, but they do not prove truth. Verify every employer, date, metric, skill, and company detail before using generated text.'],
  ['Why was my message blocked?', 'The deterministic input check found instruction-injection, fabrication, discrimination, or harmful/off-topic language. Remove the unsafe request; career-related alternatives are still welcome.'],
  ['Can it guarantee a job or pass an ATS?', 'No. It cannot guarantee employment, interviews, salary, legal compliance, or ATS performance. Treat output as a draft and use the employer’s instructions.'],
  ['Is it biased?', 'Any model can reflect bias, especially small or non-English models. We remove common personal identifiers from job matching, lint some coded language, and document limitations, but this is mitigation—not proof of fairness.'],
  ['How do I verify output?', 'Compare it with the source resume and job description. Check every factual claim, link, company detail, and requirement. Remove placeholders and any flagged or unfamiliar claim.'],
  ['What personal information is removed before matching?', 'The recommendation request removes common contact details and labels for age, gender, nationality, religion, disability, family status, address, and photos before vector matching. This heuristic is not perfect.'],
  ['How do I delete my data?', 'Use the delete controls on Resume and Tracker, and remove the local MongoDB data volume when you want a complete local reset. Also clear browser storage and any provider-side history.'],
  ['What is RAG and what is stored?', 'Retrieval-augmented generation (RAG) means finding relevant saved context before a model request. This project uses local MongoDB for user data and a local vector service for job listings; retrieved text is still treated as untrusted data.'],
  ['Can I use it offline?', 'Yes for the UI, local API, MongoDB, local job index, and a local model. Company research and cloud providers require network access.'],
  ['Is this legal advice or an EU AI Act compliance tool?', 'No. This is a candidate-side university project, not legal advice or a compliance certification. Recruitment uses can be regulated; check current EU and local rules for your situation.'],
  ['How can I report a problem?', 'Stop using the affected output, preserve a minimal reproduction without secrets, and report it through the project repository. Never include API keys, resumes, or private database files.'],
];

function TrustNav({ active, onSelect }: { active: Section; onSelect: (section: Section) => void }) {
  const items: Array<[Section, string]> = [
    ['overview', 'How it works'],
    ['privacy', 'Privacy & data flow'],
    ['responsible', 'Responsible AI'],
    ['fairness', 'Fairness & bias'],
    ['setup', 'Model setup'],
    ['disclaimer', 'Disclaimer'],
    ['faq', 'FAQ'],
  ];
  return (
    <div className="flex flex-wrap gap-2 mb-6" role="tablist" aria-label="Trust and help topics">
      {items.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={active === id}
          onClick={() => onSelect(id)}
          className="rounded-full px-3 py-2 text-sm"
          style={active === id ? { background: 'var(--color-primary)', color: 'var(--color-primary-foreground)' } : secondaryButtonStyle}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function HowItWorks() {
  return (
    <div className="space-y-5">
      <p style={mutedText}>ArbeteFlow is a local-first career workspace. The model is replaceable; the safety checks and data-flow explanation should remain understandable regardless of provider.</p>
      <div className="grid gap-3 md:grid-cols-5">
        {['React UI', 'Input guard', 'Prompt + local context', 'Chosen model', 'Output review'].map((item, index) => (
          <div key={item} className="rounded-xl p-4 text-center" style={cardStyle}>
            <div className="text-xs mb-2" style={primaryText}>STEP {index + 1}</div>
            <div className="font-semibold" style={foregroundText}>{item}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard icon={<ShieldCheck size={18} />} title="Deterministic checks" text="Inputs are normalized and checked for prompt injection, fabrication, protected-attribute discrimination, and harmful off-topic requests before the model is called." />
        <InfoCard icon={<Database size={18} />} title="Untrusted data" text="Resume, job, research, and saved-context blocks are data, not instructions. The model is told not to follow instructions inside them." />
        <InfoCard icon={<Sparkles size={18} />} title="Human review" text="Generated text is a draft. Verify facts, remove placeholders, and check the employer’s rules before sending it." />
      </div>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="rounded-xl p-4" style={cardStyle}><div className="flex gap-2 items-center font-semibold" style={foregroundText}>{icon}{title}</div><p className="text-sm leading-6 mt-2" style={mutedText}>{text}</p></div>;
}

function Privacy() {
  return (
    <div className="space-y-5">
      <div className="rounded-xl p-4" style={{ ...cardStyle, borderColor: 'var(--color-primary)' }}>
        <div className="flex gap-2 items-center font-semibold" style={foregroundText}><LockKeyhole size={18} /> No telemetry</div>
        <p className="text-sm leading-6 mt-2" style={mutedText}>This project does not collect analytics or send background tracking events. AI requests do send the text needed for that request to your selected provider.</p>
      </div>
      <div className="overflow-x-auto rounded-xl" style={cardStyle}>
        <table className="w-full text-sm text-left"><thead><tr style={{ borderBottom: '1px solid var(--color-border)' }}><th className="p-4">Setup</th><th className="p-4">What leaves this device</th><th className="p-4">Stored locally</th></tr></thead><tbody>
          <tr><td className="p-4">Local model</td><td className="p-4">AI text stays with your configured local server.</td><td className="p-4">MongoDB data, browser preferences, model key.</td></tr>
          <tr><td className="p-4">Cloud LLM</td><td className="p-4">Prompt context and requested content go to that provider.</td><td className="p-4">MongoDB data and encrypted provider key.</td></tr>
          <tr><td className="p-4">Company research</td><td className="p-4">Company and role are sent to the optional research provider; resume text is not.</td><td className="p-4">Research is used for the request, not a permanent app record.</td></tr>
        </tbody></table>
      </div>
      <p className="text-sm leading-6" style={mutedText}>Use disk encryption, keep backups protected, and review the retention policy of any cloud provider. Clearing the app does not delete provider-side logs or browser downloads.</p>
    </div>
  );
}

function Responsible() {
  return <div className="space-y-4 text-sm leading-6" style={mutedText}>
    <h2 className="text-lg font-semibold" style={foregroundText}>What we try to prevent</h2>
    <ul className="list-disc pl-5 space-y-2"><li>Prompt injection and attempts to reveal hidden instructions.</li><li>Fabricating qualifications, employers, metrics, or certifications.</li><li>Screening or ranking people by protected characteristics.</li><li>Harmful or unrelated requests in the career coach and interview flows.</li></ul>
    <h2 className="text-lg font-semibold" style={foregroundText}>What we cannot guarantee</h2>
    <p>Guardrails are deterministic mitigation plus model instructions, not a safety proof. Small models can misunderstand context, produce biased wording, or hallucinate. Verify every output and do not use this tool as an automated hiring decision-maker.</p>
  </div>;
}

function Fairness() {
  return <div className="space-y-4 text-sm leading-6" style={mutedText}>
    <h2 className="text-lg font-semibold" style={foregroundText}>Fairness approach</h2>
    <p>Job matching is sent an anonymized version of the resume with common contact details and protected-attribute labels removed. Advice should rely on job-related skills and requirements, not names, photos, age, gender, nationality, religion, disability, or family status.</p>
    <p>Generated wording is linted for a small configurable set of coded terms such as “digital native”, “rockstar”, and “native speaker”. A flag is a prompt to review, not a claim that the whole document is discriminatory.</p>
    <p>These are incomplete heuristics. Names, language style, institutions, locations, and model training data can still create proxy bias. Non-English resumes and unusual career paths may receive worse results. We do not claim statistical fairness without a representative evaluation.</p>
  </div>;
}

function Setup() {
  return <div className="space-y-4 text-sm leading-6" style={mutedText}><p>For the strongest privacy, run the API, MongoDB, job service, and a model such as Ollama on the same device. In Docker, use <code>http://host.docker.internal:11434</code> for host Ollama or the host gateway shown in Settings for another local OpenAI-compatible server.</p><p>Cloud providers may be more capable but receive the prompt context. Choose a model that supports the required API format, then verify the exact model ID returned by its models endpoint. Smaller local models are often slower or less accurate and need especially careful review.</p></div>;
}

function Disclaimer() {
  return <div className="space-y-4 text-sm leading-6" style={mutedText}>
    <h2 className="text-lg font-semibold" style={foregroundText}>A drafting and learning aid</h2>
    <p>ArbeteFlow is a university project for career preparation. It is not a recruiter, employer, lawyer, immigration adviser, therapist, or hiring decision system. It does not assess a person’s worth or determine whether someone should be hired.</p>
    <p>AI output may be incomplete, incorrect, outdated, biased, or inappropriate for a specific employer or country. You are responsible for checking facts, protecting confidential information, getting professional advice where needed, and deciding whether and how to use generated text.</p>
    <p>Do not use this app to make automated decisions about other people, infer sensitive traits, or submit qualifications you do not have. Follow employer policies about AI-assisted applications and disclose use where required.</p>
  </div>;
}

function Faq() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const filtered = useMemo(() => FAQS.filter(([question, answer]) => `${question} ${answer}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <div className="space-y-3"><input aria-label="Search frequently asked questions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions…" className="w-full rounded-lg p-3 outline-none" style={fieldStyle} />{filtered.map(([question, answer]) => { const index = FAQS.findIndex(([item]) => item === question); return <div key={question} className="rounded-xl" style={cardStyle}><button type="button" className="w-full flex justify-between gap-4 text-left p-4 font-semibold" style={foregroundText} aria-expanded={open === index} onClick={() => setOpen((current) => current === index ? null : index)}>{question}<ChevronDown size={18} /></button>{open === index && <p className="px-4 pb-4 text-sm leading-6" style={mutedText}>{answer}</p>}</div>; })}</div>;
}

export default function TrustView() {
  const [section, setSection] = useState<Section>('overview');
  return <TrustLayout section={section} onSelect={setSection} />;
}

export function FaqView() {
  const [section, setSection] = useState<Section>('faq');
  return <TrustLayout section={section} onSelect={setSection} />;
}

function TrustLayout({ section, onSelect }: { section: Section; onSelect: (section: Section) => void }) {
  const content = { overview: <HowItWorks />, privacy: <Privacy />, responsible: <Responsible />, fairness: <Fairness />, setup: <Setup />, disclaimer: <Disclaimer />, faq: <Faq /> }[section];
  return <div className="max-w-5xl"><PageHeader className="mb-6" eyebrow="TRUST & TRANSPARENCY" title={section === 'faq' ? 'Frequently Asked Questions' : 'Responsible use of ArbeteFlow'} description="Understand how the app works, what it stores, what it sends, and where AI can fail." /><TrustNav active={section} onSelect={onSelect} /><section role="tabpanel" className="rounded-2xl p-5" style={cardStyle}>{content}</section></div>;
}
