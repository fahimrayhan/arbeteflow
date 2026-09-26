import { FormEvent, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  UserRound,
} from 'lucide-react';
import {
  createInterview,
  streamInterviewMessage,
  type ApiInterview,
} from '../lib/api';
import type {
  InterviewDifficulty,
  InterviewType,
  Message,
} from '../lib/types';

const INTERVIEW_TYPES: Array<{
  id: InterviewType;
  label: string;
  description: string;
}> = [
  {
    id: 'mixed',
    label: 'Mixed',
    description: 'Behavioral and role-specific questions',
  },
  {
    id: 'behavioral',
    label: 'Behavioral',
    description: 'Experience, collaboration, and STAR answers',
  },
  {
    id: 'technical',
    label: 'Technical',
    description: 'Role-specific technical knowledge',
  },
  {
    id: 'case',
    label: 'Case study',
    description: 'Structured problem solving and reasoning',
  },
];

const DIFFICULTIES: Array<{
  id: InterviewDifficulty;
  label: string;
}> = [
  { id: 'junior', label: 'Junior' },
  { id: 'mid', label: 'Mid-level' },
  { id: 'senior', label: 'Senior' },
];

function createMessage(
  role: Message['role'],
  content: string,
): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date(),
  };
}

export default function Interview() {
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');

  const [interviewType, setInterviewType] =
    useState<InterviewType>('mixed');

  const [difficulty, setDifficulty] =
    useState<InterviewDifficulty>('mid');

  const [interview, setInterview] =
    useState<ApiInterview | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');

  const [starting, setStarting] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isComplete = interview?.status === 'completed';
  const isBusy = starting || streaming;

  const title = useMemo(() => {
    if (!interview) {
      return 'Live Interview Practice';
    }

    return interview.company
      ? `${interview.role} · ${interview.company}`
      : interview.role;
  }, [interview]);

  function scrollToBottom() {
    window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }, 0);
  }

  async function startInterview() {
    if (!role.trim()) {
      setError('Enter the role you want to practice for.');
      return;
    }

    if (starting || streaming) {
      return;
    }

    setStarting(true);
    setError('');
    setNotice('');
    setMessages([]);

    try {
      const created = await createInterview({
        role: role.trim(),
        company: company.trim() || undefined,
        jobDescription: jobDescription.trim() || undefined,
        interviewType,
        difficulty,
      });

      setInterview(created);

      const firstInterviewerMessage = createMessage(
        'assistant',
        '',
      );

      setMessages([firstInterviewerMessage]);
      setStreaming(true);

      await streamInterviewMessage(
        created.id,
        'Start the mock interview now. Briefly introduce yourself as the interviewer and ask exactly one first question.',
        (token) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === firstInterviewerMessage.id
                ? {
                    ...message,
                    content: message.content + token,
                  }
                : message,
            ),
          );

          scrollToBottom();
        },
      );

      setNotice(
        'Interview started. Answer naturally, then type “end interview” when you want structured feedback.',
      );
    } catch (startError) {
      setInterview(null);
      setMessages([]);

      setError(
        startError instanceof Error
          ? startError.message
          : 'Could not start the interview.',
      );
    } finally {
      setStarting(false);
      setStreaming(false);
    }
  }

  async function sendMessage(contentToSend: string) {
    const content = contentToSend.trim();

    if (
      !content ||
      !interview ||
      isBusy ||
      isComplete
    ) {
      return;
    }

    setError('');
    setNotice('');
    setDraft('');

    const userMessage = createMessage('user', content);
    const interviewerMessage = createMessage('assistant', '');

    setMessages((current) => [
      ...current,
      userMessage,
      interviewerMessage,
    ]);

    setStreaming(true);
    scrollToBottom();

    try {
      const result = await streamInterviewMessage(
        interview.id,
        content,
        (token) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === interviewerMessage.id
                ? {
                    ...message,
                    content: message.content + token,
                  }
                : message,
            ),
          );

          scrollToBottom();
        },
      );

      if (result.completed) {
        setInterview((current) =>
          current
            ? {
                ...current,
                status: 'completed',
              }
            : current,
        );

        setNotice(
          'Interview completed. Review the final feedback from your interviewer above.',
        );
      }
    } catch (messageError) {
      setMessages((current) =>
        current.map((message) =>
          message.id === interviewerMessage.id &&
          !message.content.trim()
            ? {
                ...message,
                content:
                  'I could not complete that interview response. Please try again.',
              }
            : message,
        ),
      );

      setError(
        messageError instanceof Error
          ? messageError.message
          : 'The interview response failed.',
      );
    } finally {
      setStreaming(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(draft);
  }

  function resetInterview() {
    setInterview(null);
    setMessages([]);
    setDraft('');
    setError('');
    setNotice('');
  }

  if (!interview) {
    return (
      <div className="view-content max-w-5xl">
        <div className="mb-8">
          <div
            className="flex items-center gap-2 text-xs font-semibold tracking-widest mb-2"
            style={{ color: 'var(--color-primary)' }}
          >
            <Sparkles size={14} />
            INTERVIEW PRACTICE
          </div>

          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--color-foreground)' }}
          >
            Live Interview Practice
          </h1>

          <p
            className="mt-2 max-w-2xl"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Practice a realistic mock interview with your local model. The
            interviewer asks one question at a time and provides structured
            feedback when you end the session.
          </p>
        </div>

        <section
          className="rounded-2xl p-5 sm:p-6"
          style={{
            background: 'var(--color-card)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'rgba(163,230,53,0.10)',
                color: 'var(--color-primary)',
              }}
            >
              <BriefcaseBusiness size={20} />
            </div>

            <div>
              <h2
                className="font-semibold"
                style={{ color: 'var(--color-foreground)' }}
              >
                Configure your interview
              </h2>

              <p
                className="text-sm mt-1"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                Add the role and any context you want the interviewer to use.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label
              className="flex flex-col gap-2 text-sm font-medium"
              style={{ color: 'var(--color-foreground)' }}
            >
              Target role
              <input
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="e.g. Machine Learning Engineer"
                disabled={isBusy}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none disabled:opacity-60"
                style={{
                  background: 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-foreground)',
                }}
              />
            </label>

            <label
              className="flex flex-col gap-2 text-sm font-medium"
              style={{ color: 'var(--color-foreground)' }}
            >
              Company, optional
              <input
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                placeholder="e.g. Spotify"
                disabled={isBusy}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none disabled:opacity-60"
                style={{
                  background: 'var(--color-muted)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-foreground)',
                }}
              />
            </label>
          </div>

          <div className="mt-5">
            <p
              className="text-sm font-medium mb-2"
              style={{ color: 'var(--color-foreground)' }}
            >
              Interview type
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {INTERVIEW_TYPES.map((option) => {
                const active = option.id === interviewType;

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setInterviewType(option.id)}
                    className="rounded-xl px-4 py-3 text-left disabled:opacity-60"
                    style={{
                      background: active
                        ? 'rgba(163,230,53,0.10)'
                        : 'var(--color-muted)',
                      border: active
                        ? '1px solid rgba(163,230,53,0.45)'
                        : '1px solid var(--color-border)',
                      color: active
                        ? 'var(--color-primary)'
                        : 'var(--color-foreground)',
                    }}
                  >
                    <div className="text-sm font-semibold">
                      {option.label}
                    </div>

                    <div
                      className="text-xs leading-5 mt-1"
                      style={{
                        color: active
                          ? 'var(--color-primary)'
                          : 'var(--color-muted-foreground)',
                      }}
                    >
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5">
            <p
              className="text-sm font-medium mb-2"
              style={{ color: 'var(--color-foreground)' }}
            >
              Seniority
            </p>

            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((option) => {
                const active = option.id === difficulty;

                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setDifficulty(option.id)}
                    className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
                    style={{
                      background: active
                        ? 'rgba(163,230,53,0.10)'
                        : 'var(--color-muted)',
                      border: active
                        ? '1px solid rgba(163,230,53,0.45)'
                        : '1px solid var(--color-border)',
                      color: active
                        ? 'var(--color-primary)'
                        : 'var(--color-foreground)',
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label
            className="mt-5 flex flex-col gap-2 text-sm font-medium"
            style={{ color: 'var(--color-foreground)' }}
          >
            Job description, optional
            <textarea
              value={jobDescription}
              onChange={(event) =>
                setJobDescription(event.target.value)
              }
              placeholder="Paste the job description to tailor interview questions to the role."
              disabled={isBusy}
              rows={9}
              className="w-full resize-y rounded-xl p-3 text-sm leading-6 outline-none disabled:opacity-60"
              style={{
                background: 'var(--color-muted)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
              }}
            />
          </label>

          {error && (
            <div
              className="mt-5 flex gap-2 rounded-xl px-4 py-3 text-sm"
              style={{
                color: '#F87171',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.22)',
              }}
            >
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <span
              className="text-xs"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              Your saved resume is used automatically when available.
            </span>

            <button
              type="button"
              onClick={() => void startInterview()}
              disabled={isBusy || !role.trim()}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #84CC16, #A3E635)',
                color: 'var(--color-primary-foreground)',
                boxShadow: 'var(--shadow-btn-glow)',
              }}
            >
              <Play size={16} />
              {starting ? 'Starting interview…' : 'Start interview'}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="view-content h-full min-h-0 flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div
            className="flex items-center gap-2 text-xs font-semibold tracking-widest mb-2"
            style={{ color: 'var(--color-primary)' }}
          >
            <Sparkles size={14} />
            LIVE INTERVIEW
          </div>

          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--color-foreground)' }}
          >
            {title}
          </h1>

          <p
            className="mt-2"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {isComplete
              ? 'This session is complete. Review the final feedback in the conversation.'
              : 'Answer naturally. Type “end interview” when you want final feedback.'}
          </p>
        </div>

        <button
          type="button"
          onClick={resetInterview}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          style={{
            background: 'var(--color-muted)',
            color: 'var(--color-foreground)',
            border: '1px solid var(--color-border)',
          }}
        >
          <RotateCcw size={16} />
          New interview
        </button>
      </div>

      <section
        className="rounded-2xl flex-1 min-h-0 flex flex-col overflow-hidden"
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'rgba(163,230,53,0.10)',
                color: 'var(--color-primary)',
              }}
            >
              <Building2 size={18} />
            </div>

            <div>
              <h2
                className="font-semibold"
                style={{ color: 'var(--color-foreground)' }}
              >
                {interview.interviewType} interview · {interview.difficulty}
              </h2>

              <p
                className="text-xs mt-0.5"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {streaming
                  ? 'Interviewer is responding…'
                  : isComplete
                    ? 'Interview completed'
                    : 'One question at a time'}
              </p>
            </div>
          </div>

          {isComplete && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{
                color: '#A3E635',
                background: 'rgba(163,230,53,0.10)',
                border: '1px solid rgba(163,230,53,0.25)',
              }}
            >
              <CheckCircle2 size={14} />
              Completed
            </span>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {error && (
            <div
              className="flex gap-2 rounded-xl px-4 py-3 text-sm mb-4"
              style={{
                color: '#F87171',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.22)',
              }}
            >
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {notice && (
            <div
              className="flex gap-2 rounded-xl px-4 py-3 text-sm mb-4"
              style={{
                color: '#A3E635',
                background: 'rgba(163,230,53,0.08)',
                border: '1px solid rgba(163,230,53,0.22)',
              }}
            >
              <ClipboardList size={18} className="shrink-0 mt-0.5" />
              <div>{notice}</div>
            </div>
          )}

          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message) => {
              const isAssistant = message.role === 'assistant';

              return (
                <article
                  key={message.id}
                  className={`flex gap-3 ${
                    isAssistant ? 'justify-start' : 'justify-end'
                  }`}
                >
                  {isAssistant && (
                    <div
                      className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
                      style={{
                        background: 'rgba(163,230,53,0.10)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      <BriefcaseBusiness size={15} />
                    </div>
                  )}

                  <div
                    className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap"
                    style={{
                      color: isAssistant
                        ? 'var(--color-foreground)'
                        : 'var(--color-primary-foreground)',
                      background: isAssistant
                        ? 'var(--color-muted)'
                        : 'linear-gradient(135deg, #84CC16, #A3E635)',
                      border: isAssistant
                        ? '1px solid var(--color-border)'
                        : 'none',
                    }}
                  >
                    {message.content || (
                      <span
                        className="inline-flex gap-1"
                        aria-label="Interviewer is typing"
                      >
                        {[0, 1, 2].map((index) => (
                          <span
                            key={index}
                            className="w-1.5 h-1.5 rounded-full animate-pulse"
                            style={{
                              background: 'currentColor',
                              animationDelay: `${index * 150}ms`,
                            }}
                          />
                        ))}
                      </span>
                    )}
                  </div>

                  {!isAssistant && (
                    <div
                      className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
                      style={{
                        background: 'var(--color-muted)',
                        color: 'var(--color-muted-foreground)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <UserRound size={15} />
                    </div>
                  )}
                </article>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {!isComplete && (
          <form
            onSubmit={handleSubmit}
            className="p-4"
            style={{ borderTop: '1px solid var(--color-border)' }}
          >
            <div
              className="rounded-xl p-2 flex items-end gap-2"
              style={{
                background: 'var(--color-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();

                    if (!streaming && draft.trim()) {
                      void sendMessage(draft);
                    }
                  }
                }}
                rows={2}
                disabled={streaming}
                placeholder="Write your interview answer…"
                className="flex-1 min-h-[44px] max-h-36 resize-y bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-60"
                style={{ color: 'var(--color-foreground)' }}
              />

              <button
                type="submit"
                disabled={streaming || !draft.trim()}
                className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, #84CC16, #A3E635)',
                  color: 'var(--color-primary-foreground)',
                }}
                aria-label="Send interview answer"
              >
                <Send size={17} />
              </button>
            </div>

            <p
              className="text-xs mt-2 px-1"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              Press Enter to send · Shift + Enter for a new line · Type “end
              interview” for structured feedback
            </p>
          </form>
        )}

        {isComplete && (
          <div
            className="p-4 text-sm"
            style={{
              borderTop: '1px solid var(--color-border)',
              color: 'var(--color-muted-foreground)',
            }}
          >
            This interview is saved to the backend. Start a new interview to continue
            practicing.
          </div>
        )}
      </section>
    </div>
  );
}
