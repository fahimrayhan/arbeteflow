import { useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  FileText,
  GraduationCap,
  Lightbulb,
  MessageSquare,
  Plus,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatMessageList } from '../components/chat/ChatMessageList';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import { OptionCard } from '../components/ui/OptionCard';
import { PageHeader } from '../components/ui/PageHeader';
import { cardStyle, foregroundText, ghostButtonStyle, iconTileStyle, mutedText } from '../components/ui/styles';
import { createUiMessage, useStreamingMessages } from '../hooks/useStreamingMessages';
import {
  apiMessagesToUiMessages,
  createCoachSession,
  getCoachSession,
  streamCoachMessage,
} from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { ChatMode } from '../lib/types';

type CoachModeConfig = {
  id: ChatMode;
  label: string;
  description: string;
  icon: LucideIcon;
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

export default function Chat() {
  const [mode, setMode] = useState<ChatMode>('resume');
  // Sessions are created lazily on the first message, so browsing modes writes nothing.
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { messages, setMessages, appendToken, fillIfEmpty } = useStreamingMessages();
  const [draft, setDraft] = useState('');

  const [reloading, setReloading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');

  const activeMode = useMemo(
    () => COACH_MODES.find((item) => item.id === mode) ?? COACH_MODES[0],
    [mode],
  );

  const isBusy = streaming || reloading;

  function startNewSession() {
    setSessionId(null);
    setMessages([]);
    setDraft('');
    setError('');
  }

  async function reloadSession() {
    if (!sessionId) return;

    setReloading(true);
    setError('');

    try {
      const session = await getCoachSession(sessionId);
      setMessages(apiMessagesToUiMessages(session.messages));
    } catch (reloadError) {
      setError(getErrorMessage(reloadError, 'Could not reload this coaching session.'));
    } finally {
      setReloading(false);
    }
  }

  async function sendMessage(contentToSend: string) {
    const content = contentToSend.trim();

    if (!content || isBusy) {
      return;
    }

    setError('');
    setDraft('');

    const userMessage = createUiMessage('user', content);
    const assistantMessage = createUiMessage('assistant');

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setStreaming(true);

    try {
      let activeSessionId = sessionId;

      if (!activeSessionId) {
        const session = await createCoachSession(mode);
        activeSessionId = session.id;
        setSessionId(session.id);
      }

      await streamCoachMessage(activeSessionId, content, (token) =>
        appendToken(assistantMessage.id, token),
      );
    } catch (streamError) {
      fillIfEmpty(assistantMessage.id, 'I could not complete that response. Please try again.');
      setError(getErrorMessage(streamError, 'The coaching response failed.'));
    } finally {
      setStreaming(false);
    }
  }

  function handleModeChange(nextMode: ChatMode) {
    if (nextMode === mode || isBusy) {
      return;
    }

    setMode(nextMode);
    startNewSession();
  }

  return (
    <div className="view-content h-full min-h-0 flex flex-col">
      <div className="flex flex-col gap-5 mb-6">
        <PageHeader
          eyebrow="AI CAREER COACH"
          title="ArbetsFlow Coach"
          description="Resume feedback, career guidance, and job-post analysis using your locally hosted model."
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {COACH_MODES.map((item) => (
            <OptionCard
              key={item.id}
              label={item.label}
              description={item.description}
              icon={item.icon}
              active={item.id === mode}
              disabled={isBusy}
              onSelect={() => handleModeChange(item.id)}
              className="text-left rounded-xl p-4 transition-colors disabled:opacity-60"
              descriptionClassName="mt-2 text-xs leading-5"
              inactiveBackground="var(--color-card)"
            />
          ))}
        </div>
      </div>

      <section
        className="rounded-2xl flex-1 min-h-0 flex flex-col overflow-hidden"
        style={cardStyle}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--color-border)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={iconTileStyle}>
              <activeMode.icon size={18} />
            </div>

            <div>
              <h2 className="font-semibold" style={foregroundText}>
                {activeMode.label}
              </h2>

              <p className="text-xs mt-0.5" style={mutedText}>
                {reloading
                  ? 'Reloading this session…'
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
                onClick={() => void reloadSession()}
                disabled={isBusy}
                className="text-xs px-3 py-2 rounded-lg disabled:opacity-60"
                style={ghostButtonStyle}
              >
                Reload
              </button>
            )}

            <button
              type="button"
              onClick={startNewSession}
              disabled={isBusy}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg disabled:opacity-60"
              style={ghostButtonStyle}
            >
              <Plus size={14} />
              New chat
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {error && (
            <Alert compact title="Error" className="mb-4">
              {error}
            </Alert>
          )}

          {messages.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={`Start a conversation with your ${activeMode.label}`}
              description="ArbetsFlow stays focused on resumes, job searching, career strategy, and interview preparation."
              className="h-full min-h-[320px] flex flex-col items-center justify-center text-center px-6"
              descriptionClassName="mt-2 text-sm max-w-md"
            >
              <div className="flex flex-wrap justify-center gap-2 mt-5 max-w-3xl">
                {activeMode.suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    disabled={isBusy}
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
            </EmptyState>
          ) : (
            <ChatMessageList
              messages={messages}
              assistantIcon={Sparkles}
              typingLabel="Coach is typing"
            />
          )}
        </div>

        <ChatComposer
          value={draft}
          onChange={setDraft}
          onSend={(content) => void sendMessage(content)}
          disabled={isBusy}
          placeholder="Ask about your resume, career, job applications, or interviews…"
          sendLabel="Send message"
          hint="Press Enter to send · Shift + Enter for a new line"
        />
      </section>
    </div>
  );
}
