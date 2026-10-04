import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ClipboardList,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useConsumeJobDraft } from '../app/AppContext';
import { ChatComposer } from '../components/chat/ChatComposer';
import { ChatMessageList } from '../components/chat/ChatMessageList';
import { Alert } from '../components/ui/Alert';
import { OptionCard } from '../components/ui/OptionCard';
import { PageHeader } from '../components/ui/PageHeader';
import {
  cardStyle,
  fieldStyle,
  foregroundText,
  iconTileStyle,
  mutedText,
  primaryButtonStyle,
  secondaryButtonStyle,
  selectableStyle,
} from '../components/ui/styles';
import { TextField } from '../components/ui/TextField';
import { createUiMessage, useStreamingMessages } from '../hooks/useStreamingMessages';
import { createInterview, streamInterviewMessage } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { ApiInterview, InterviewDifficulty, InterviewType } from '../lib/types';

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

const START_PROMPT =
  'Start the mock interview now. Briefly introduce yourself as the interviewer and ask exactly one first question.';

export default function Interview() {
  const [role, setRole] = useState('');
  const [company, setCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [interviewType, setInterviewType] = useState<InterviewType>('mixed');
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>('mid');

  const [interview, setInterview] = useState<ApiInterview | null>(null);
  const { messages, setMessages, appendToken, fillIfEmpty } = useStreamingMessages();
  const [draft, setDraft] = useState('');

  const [starting, setStarting] = useState(false);
  const [streaming, setStreaming] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Prefill from "Practice AI Interview" in Job Finder.
  useConsumeJobDraft((jobDraft) => {
    setRole(jobDraft.role);
    setCompany(jobDraft.company);
    setJobDescription(jobDraft.description);
  });

  const isComplete = interview?.status === 'completed';
  const isBusy = starting || streaming;

  const title = useMemo(() => {
    if (!interview) {
      return 'Live Interview Practice';
    }

    return interview.company ? `${interview.role} · ${interview.company}` : interview.role;
  }, [interview]);

  // Keep the newest message in view while the interviewer streams.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const streamReply = useCallback(
    async (interviewId: string, content: string, placeholderId: string) =>
      streamInterviewMessage(interviewId, content, (token) => appendToken(placeholderId, token)),
    [appendToken],
  );

  async function startInterview() {
    if (!role.trim()) {
      setError('Enter the role you want to practice for.');
      return;
    }

    if (isBusy) {
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

      const firstInterviewerMessage = createUiMessage('assistant');
      setMessages([firstInterviewerMessage]);
      setStreaming(true);

      await streamReply(created.id, START_PROMPT, firstInterviewerMessage.id);

      setNotice(
        'Interview started. Answer naturally, then type “end interview” when you want structured feedback.',
      );
    } catch (startError) {
      setInterview(null);
      setMessages([]);
      setError(getErrorMessage(startError, 'Could not start the interview.'));
    } finally {
      setStarting(false);
      setStreaming(false);
    }
  }

  async function sendMessage(contentToSend: string) {
    const content = contentToSend.trim();

    if (!content || !interview || isBusy || isComplete) {
      return;
    }

    setError('');
    setNotice('');
    setDraft('');

    const userMessage = createUiMessage('user', content);
    const interviewerMessage = createUiMessage('assistant');

    setMessages((current) => [...current, userMessage, interviewerMessage]);
    setStreaming(true);

    try {
      const result = await streamReply(interview.id, content, interviewerMessage.id);

      if (result.completed) {
        setInterview((current) => (current ? { ...current, status: 'completed' } : current));
        setNotice('Interview completed. Review the final feedback from your interviewer above.');
      }
    } catch (messageError) {
      fillIfEmpty(
        interviewerMessage.id,
        'I could not complete that interview response. Please try again.',
      );
      setError(getErrorMessage(messageError, 'The interview response failed.'));
    } finally {
      setStreaming(false);
    }
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
        <PageHeader
          className="mb-8"
          eyebrow="INTERVIEW PRACTICE"
          title="Live Interview Practice"
          description="Practice a realistic mock interview with your local model. The interviewer asks one question at a time and provides structured feedback when you end the session."
          descriptionClassName="mt-2 max-w-2xl"
        />

        <section className="rounded-2xl p-5 sm:p-6" style={cardStyle}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={iconTileStyle}>
              <BriefcaseBusiness size={20} />
            </div>

            <div>
              <h2 className="font-semibold" style={foregroundText}>
                Configure your interview
              </h2>

              <p className="text-sm mt-1" style={mutedText}>
                Add the role and any context you want the interviewer to use.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TextField
              label="Target role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="e.g. Machine Learning Engineer"
              disabled={isBusy}
              maxLength={200}
            />

            <TextField
              label="Company, optional"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="e.g. Spotify"
              disabled={isBusy}
              maxLength={200}
            />
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium mb-2" style={foregroundText}>
              Interview type
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {INTERVIEW_TYPES.map((option) => (
                <OptionCard
                  key={option.id}
                  label={option.label}
                  description={option.description}
                  active={option.id === interviewType}
                  disabled={isBusy}
                  onSelect={() => setInterviewType(option.id)}
                  className="rounded-xl px-4 py-3 text-left disabled:opacity-60"
                />
              ))}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-medium mb-2" style={foregroundText}>
              Seniority
            </p>

            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={option.id === difficulty}
                  disabled={isBusy}
                  onClick={() => setDifficulty(option.id)}
                  className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
                  style={selectableStyle(option.id === difficulty)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <label className="mt-5 flex flex-col gap-2 text-sm font-medium" style={foregroundText}>
            Job description, optional
            <textarea
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the job description to tailor interview questions to the role."
              disabled={isBusy}
              rows={9}
              maxLength={50_000}
              className="w-full resize-y rounded-xl p-3 text-sm leading-6 outline-none disabled:opacity-60"
              style={fieldStyle}
            />
          </label>

          {error && <Alert className="mt-5">{error}</Alert>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs" style={mutedText}>
              Your saved resume is used automatically when available.
            </span>

            <button
              type="button"
              onClick={() => void startInterview()}
              disabled={isBusy || !role.trim()}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              style={primaryButtonStyle}
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
        <PageHeader
          eyebrow="LIVE INTERVIEW"
          title={title}
          description={
            isComplete
              ? 'This session is complete. Review the final feedback in the conversation.'
              : 'Answer naturally. Type “end interview” when you want final feedback.'
          }
        />

        <button
          type="button"
          onClick={resetInterview}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          style={secondaryButtonStyle}
        >
          <RotateCcw size={16} />
          New interview
        </button>
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
              <Building2 size={18} />
            </div>

            <div>
              <h2 className="font-semibold" style={foregroundText}>
                {interview.interviewType} interview · {interview.difficulty}
              </h2>

              <p className="text-xs mt-0.5" style={mutedText}>
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
                color: 'var(--success-text)',
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
          {error && <Alert className="mb-4">{error}</Alert>}

          {notice && (
            <Alert tone="success" icon={ClipboardList} className="mb-4">
              {notice}
            </Alert>
          )}

          <ChatMessageList
            messages={messages}
            assistantIcon={BriefcaseBusiness}
            typingLabel="Interviewer is typing"
            endRef={messagesEndRef}
          />
        </div>

        {isComplete ? (
          <div
            className="p-4 text-sm"
            style={{
              borderTop: '1px solid var(--color-border)',
              color: 'var(--color-muted-foreground)',
            }}
          >
            This interview is saved to the backend. Start a new interview to continue practicing.
          </div>
        ) : (
          <ChatComposer
            value={draft}
            onChange={setDraft}
            onSend={(content) => void sendMessage(content)}
            disabled={streaming}
            placeholder="Write your interview answer…"
            sendLabel="Send interview answer"
            hint="Press Enter to send · Shift + Enter for a new line · Type “end interview” for structured feedback"
          />
        )}
      </section>
    </div>
  );
}
