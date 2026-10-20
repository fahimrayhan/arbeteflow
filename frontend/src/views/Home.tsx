import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  FileText,
  Kanban,
  Mail,
  MessageSquare,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';
import { useApp } from '../app/AppContext';
import type { View } from '../lib/types';
import { cardStyle, foregroundText, mutedText, primaryButtonStyle, secondaryButtonStyle } from '../components/ui/styles';

const WORKFLOWS: Array<{
  id: View;
  icon: typeof FileText;
  title: string;
  description: string;
  action: string;
}> = [
  {
    id: 'resume',
    icon: FileText,
    title: 'Build your resume',
    description: 'Import your CV, improve its wording, and tailor it to a target role.',
    action: 'Open Resume',
  },
  {
    id: 'finder',
    icon: Search,
    title: 'Find relevant jobs',
    description: 'Search Swedish listings and discover roles that fit your experience.',
    action: 'Explore jobs',
  },
  {
    id: 'coverletter',
    icon: Mail,
    title: 'Prepare applications',
    description: 'Draft a cover letter around the role, company, and your background.',
    action: 'Write a letter',
  },
  {
    id: 'tracker',
    icon: Kanban,
    title: 'Track your progress',
    description: 'Keep saved roles and applications organized through each stage.',
    action: 'Open tracker',
  },
  {
    id: 'interview',
    icon: BriefcaseBusiness,
    title: 'Practice interviews',
    description: 'Rehearse role-specific questions and prepare stronger answers.',
    action: 'Start practice',
  },
  {
    id: 'chat',
    icon: MessageSquare,
    title: 'Get career guidance',
    description: 'Ask the AI coach for resume feedback, job-search ideas, and advice.',
    action: 'Talk to the coach',
  },
];

export default function Home() {
  const { navigate } = useApp();

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-8">
      <section
        className="relative overflow-hidden rounded-3xl p-7 sm:p-10 lg:p-14"
        style={{
          ...cardStyle,
          background: 'radial-gradient(ellipse at 85% 10%, rgba(163,230,53,0.13), transparent 38%), var(--color-card)',
        }}
      >
        <div className="relative max-w-3xl">
          <p className="text-xs font-bold tracking-[0.2em] mb-4" style={{ color: 'var(--color-primary)' }}>
            YOUR CAREER WORKSPACE
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08]" style={foregroundText}>
            Make your next move <span style={{ color: 'var(--color-primary)' }}>with confidence.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg leading-7 max-w-2xl" style={mutedText}>
            ArbetsFlow brings your job search together: shape your resume, find opportunities, prepare each application, and keep track of what comes next.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <button
              type="button"
              onClick={() => navigate('resume')}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
              style={primaryButtonStyle}
            >
              Start with your resume <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => navigate('finder')}
              className="rounded-xl px-5 py-3 text-sm font-semibold"
              style={secondaryButtonStyle}
            >
              Browse job matches
            </button>
          </div>
        </div>
      </section>

      <section aria-labelledby="workflow-heading">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'var(--color-primary)' }}>ONE WORKSPACE, EVERY STEP</p>
            <h2 id="workflow-heading" className="text-2xl sm:text-3xl font-bold" style={foregroundText}>Move your search forward</h2>
          </div>
          <p className="text-sm max-w-md" style={mutedText}>Choose a tool to jump into the part of your job search you’re working on today.</p>
        </div>

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {WORKFLOWS.map(({ id, icon: Icon, title, description, action }) => (
            <button
              key={id}
              type="button"
              onClick={() => navigate(id)}
              className="group rounded-2xl p-5 text-left transition-transform hover:-translate-y-0.5"
              style={cardStyle}
            >
              <span
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(163,230,53,0.12)', color: 'var(--color-primary)' }}
              >
                <Icon size={21} />
              </span>
              <h3 className="text-lg font-semibold" style={foregroundText}>{title}</h3>
              <p className="text-sm leading-6 mt-2 min-h-12" style={mutedText}>{description}</p>
              <span className="inline-flex items-center gap-1.5 mt-5 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                {action} <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="responsible-ai-heading" className="rounded-2xl p-6 sm:p-8" style={{ ...cardStyle, borderColor: 'rgba(163,230,53,0.3)' }}>
        <div className="flex flex-col md:flex-row md:items-start gap-5">
          <div className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center" style={{ background: 'rgba(163,230,53,0.12)', color: 'var(--color-primary)' }}>
            <ShieldCheck size={23} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest mb-2" style={{ color: 'var(--color-primary)' }}>RESPONSIBLE AI</p>
            <h2 id="responsible-ai-heading" className="text-2xl font-bold" style={foregroundText}>AI support with people in control</h2>
            <p className="text-sm leading-6 mt-2 max-w-3xl" style={mutedText}>
              ArbetsFlow includes checks intended to discourage prompt injection, invented qualifications, and discriminatory requests. Job matching removes some common personal identifiers, but these protections are imperfect. AI output can still be inaccurate or biased, so review every draft and make your own decisions.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 mt-5">
              <div className="flex gap-2.5 text-sm leading-6" style={mutedText}>
                <CheckCircle2 size={17} className="mt-1 shrink-0" style={{ color: 'var(--color-primary)' }} />
                Choose a local model for local processing, or review the data terms of a cloud provider.
              </div>
              <div className="flex gap-2.5 text-sm leading-6" style={mutedText}>
                <UserRoundCheck size={17} className="mt-1 shrink-0" style={{ color: 'var(--color-primary)' }} />
                Verify facts and keep hiring and application decisions in human hands.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
