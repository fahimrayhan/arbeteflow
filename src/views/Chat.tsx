import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  Lightbulb,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  UserRound,
} from 'lucide-react';
import {
  apiMessagesToUiMessages,
  createCoachSession,
  getCoachSession,
  streamCoachMessage,
} from '../lib/api';
import type { ChatMode, Message } from '../lib/types';

type CoachModeConfig = {
  id: ChatMode;
  label: string;
  description: string;
  icon: typeof FileText;
  suggestedPrompts: string[];
};

const COACH_MODES: CoachModeConfig[] = [
  {
    id: 'resume',
    label: 'Resume Coach',
    description: 'Improve your CV, bullets, keywords, and ATS fit.',
    icon: FileText,
    suggestedPrompts: [
      'Review my resume and identify the three highest-impact improvements.',
      'Help me rewrite my experience bullets for a machine learning engineer role.',
      'What ATS keywords are missing for the role I am targeting?',
    ],
  },
  {
    id: 'career',
    label: 'Career Coach',
    description: 'Plan your next move, skills, networking, and job search.',
    icon: GraduationCap,
    suggestedPrompts: [
      'Help me build a four-week job-search plan.',
      'How should I prepare for a transition into machine learning engineering?',
      'Help me identify the strongest story for my LinkedIn profile.',
    ],
  },
  {
    id: 'jobcritic',
    label: 'Job Critic',
    description: 'Analyze job posts, fit, interview questions, and red flags.',
    icon: BriefcaseBusiness,
    suggestedPrompts: [
      'Analyze this job description for likely hiring priorities and red flags.',
      'Help me decide whether this role is a good match for my background.',
      'What questions should I ask the recruiter before applying?',
    ],
  },
];

function createUiMessage(
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

export default function Chat() {
  const [mode, setMode] = useState<ChatMode>('resume');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');

  const [creatingSession, setCreatingSession] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');

  const activeMode = useMemo(
    () => COACH_MODES.find((item) => item.id === mode) ?? COACH_MODES[0],
    [mode],
  );

  useEffect(() => {
    void startNewSession(mode);
    // A new database chat session is intentionally created whenever mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function startNewSession(nextMode: ChatMode) {
    setCreatingSession(true);
    setStreaming(false);
    setError('');
    setDraft('');
    setSessionId(null);

    try {
      const session = await createCoachSession(nextMode);

      setSessionId(session.id);
      setMessages(apiMessagesToUiMessages(session.messages));
    } catch (sessionError) {
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : 'Could not create a new coaching session.',
      );
      setMessages([]);
    } finally {
      setCreatingSession(false);
    }
  }

  async function resumeExistingSession() {
    if (!sessionId) {
      return;
    }

    setCreatingSession(true);
    setError('');

    try {
      const session = await getCoachSession(sessionId);
      setMessages(apiMessagesToUiMessages(session.messages));
    } catch (sessionError) {
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : 'Could not reload this coaching session.',
      );
    } finally {
      setCreatingSession(false);
    }
  }

  async function sendMessage(contentToSend: string) {
    const content = contentToSend.trim();

    if (
      !content ||
      !sessionId ||
      streaming ||
      creatingSession
    ) {
      return;
    }

    setError('');
    setDraft('');

    const userMessage = createUiMessage('user', content);
    const assistantMessage = createUiMessage('assistant', '');

    setMessages((current) => [
      ...current,
      userMessage,
      assistantMessage,
    ]);

    setStreaming(true);

    try {
      await streamCoachMessage(
        sessionId,
        content,
        (token) => {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessage.id
                ? {
                    ...message,
                    content: message.content + token,
                  }
                : message,
            ),
          );
        },
      );
    } catch (streamError) {
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id &&
          !message.content.trim()
            ? {
                ...message,
                content:
                  'I could not complete that response. Please try again.',
              }
            : message,
        ),
      );

      setError(
        streamError instanceof Error
          ? streamError.message
          : 'The coaching response failed.',
      );
    } finally {
      setStreaming(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendMessage(draft);
  }

  function handleModeChange(nextMode: ChatMode) {
    if (nextMode === mode || streaming || creatingSession) {
      return;
    }

    setMode(nextMode);
  }

  return (
    <div className="view-content h-full min-h-0 flex flex-col">
      <div className="flex flex-col gap-5 mb-6">
        <div>
          <div
            className="flex items-center gap-2 text-xs font-semibold tracking-widest mb-2"
            style={{ color: 'var(--color-primary)' }}
          >
            <Sparkles size={14} />
            AI CAREER COACH
          </div>

          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ color: 'var(--color-foreground)' }}
          >
            CareerAI Coach
          </h1>

          <p
            className="mt-2"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Resume feedback, career guidance, and job-post analysis using your
            locally hosted model.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {COACH_MODES.map((item) => {
            const Icon = item.icon;
            const active = item.id === mode;

            return (
              <button
                key={item.id}
                type="button"
                disabled={streaming || creatingSession}
                onClick={() => handleModeChange(item.id)}
                className="text-left rounded-xl p-4 transition-colors disabled:opacity-60"
                style={{
                  background: active
                    ? 'rgba(163,230,53,0.09)'
                    : 'var(--color-card)',
                  border: active
                    ? '1px solid rgba(163,230,53,0.45)'
                    : '1px solid var(--color-border)',
                  color: active
                    ? 'var(--color-primary)'
                    : 'var(--color-foreground)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon size={17} />
                  <span className="font-semibold text-sm">
                    {item.label}
                  </span>
                </div>

                <p
                  className="mt-2 text-xs leading-5"
                  style={{
                    color: active
                      ? 'var(--color-primary)'
                      : 'var(--color-muted-foreground)',
                  }}
                >
                  {item.description}
                </p>
              </button>
            );
          })}
        </div>
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
                background: 'rgba(163,230,53,0.1)',
                color: 'var(--color-primary)',
              }}
            >
              <activeMode.icon size={18} />
            </div>

            <div>
              <h2
                className="font-semibold"
                style={{ color: 'var(--color-foreground)' }}
              >
                {activeMode.label}
              </h2>

              <p
                className="text-xs mt-0.5"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {creatingSession
                  ? 'Creating a new session…'
                  : streaming
                    ? 'Coach is responding…'
                    : 'New conversations are saved to the backend.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sessionId && (
              <button
                type="button"
                onClick={resumeExistingSession}
                disabled={streaming || creatingSession}
                className="text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                style={{
                  color: 'var(--color-foreground)',
                  background: 'var(--color-muted)',
                }}
              >
                Reload
              </button>
            )}

            <button
              type="button"
              onClick={() => void startNewSession(mode)}
              disabled={streaming || creatingSession}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-60"
              style={{
                color: 'var(--color-foreground)',
                background: 'var(--color-muted)',
              }}
            >
              <Plus size={14} />
              New chat
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {error && (
            <div
              className="flex gap-2 rounded-lg px-3 py-3 text-sm mb-4"
              style={{
                color: '#F87171',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.22)',
              }}
            >
              <AlertCircle size={17} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Error</div>
                <div>{error}</div>
              </div>
            </div>
          )}

          {creatingSession ? (
            <div className="h-full min-h-[320px] flex items-center justify-center">
              <div
                className="flex items-center gap-3 text-sm"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                <span
                  className="w-4 h-4 rounded-full animate-spin border-2"
                  style={{
                    borderColor: 'rgba(163,230,53,0.25)',
                    borderTopColor: 'var(--color-primary)',
                  }}
                />
                Preparing your coaching session…
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-6">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{
                  background: 'rgba(163,230,53,0.1)',
                  color: 'var(--color-primary)',
                }}
              >
                <MessageSquare size={22} />
              </div>

              <h3
                className="font-semibold"
                style={{ color: 'var(--color-foreground)' }}
              >
                Start a conversation with your {activeMode.label}
              </h3>

              <p
                className="mt-2 text-sm max-w-md"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                CareerAI stays focused on resumes, job searching, career
                strategy, and interview preparation.
              </p>

              <div className="flex flex-wrap justify-center gap-2 mt-5 max-w-3xl">
                {activeMode.suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    disabled={streaming || !sessionId}
                    className="text-left text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                    style={{
                      color: 'var(--color-foreground)',
                      background: 'var(--color-muted)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <Lightbulb
                      size={13}
                      className="inline mr-1.5"
                      style={{ color: 'var(--color-primary)' }}
                    />
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
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
                          background: 'rgba(163,230,53,0.1)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        <Sparkles size={15} />
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
                          aria-label="Coach is typing"
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
            </div>
          )}
        </div>

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
              disabled={creatingSession || streaming || !sessionId}
              placeholder={
                creatingSession
                  ? 'Preparing your session…'
                  : 'Ask about your resume, career, job applications, or interviews…'
              }
              className="flex-1 min-h-[44px] max-h-36 resize-y bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-60"
              style={{ color: 'var(--color-foreground)' }}
            />

            <button
              type="submit"
              disabled={
                creatingSession ||
                streaming ||
                !sessionId ||
                !draft.trim()
              }
              className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, #84CC16, #A3E635)',
                color: 'var(--color-primary-foreground)',
              }}
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          </div>

          <p
            className="text-xs mt-2 px-1"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Press Enter to send · Shift + Enter for a new line
          </p>
        </form>
      </section>
    </div>
  );
}
