import type { Ref } from 'react';
import { UserRound, type LucideIcon } from 'lucide-react';
import type { Message } from '../../lib/types';
import { PRIMARY_GRADIENT } from '../ui/styles';
import { TypingDots } from '../ui/TypingDots';

interface ChatMessageListProps {
  messages: Message[];
  assistantIcon: LucideIcon;
  /** Accessible label for the typing indicator, e.g. "Coach is typing". */
  typingLabel: string;
  /** Optional sentinel after the last message, used for auto-scrolling. */
  endRef?: Ref<HTMLDivElement>;
}

export function ChatMessageList({
  messages,
  assistantIcon: AssistantIcon,
  typingLabel,
  endRef,
}: ChatMessageListProps) {
  return (
    <div className="space-y-4 max-w-4xl mx-auto" aria-live="polite">
      {messages.map((message) => {
        const isAssistant = message.role === 'assistant';

        return (
          <article
            key={message.id}
            className={`flex gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
          >
            {isAssistant && (
              <div
                className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center"
                style={{
                  background: 'rgba(163,230,53,0.1)',
                  color: 'var(--color-primary)',
                }}
              >
                <AssistantIcon size={15} />
              </div>
            )}

            <div
              className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap"
              style={{
                color: isAssistant ? 'var(--color-foreground)' : 'var(--color-primary-foreground)',
                background: isAssistant ? 'var(--color-muted)' : PRIMARY_GRADIENT,
                border: isAssistant ? '1px solid var(--color-border)' : 'none',
              }}
            >
              {message.content || <TypingDots label={typingLabel} />}
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

      {endRef && <div ref={endRef} />}
    </div>
  );
}
