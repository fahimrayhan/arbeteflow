import type { FormEvent, ReactNode } from 'react';
import { Send } from 'lucide-react';
import { fieldStyle, foregroundText, mutedText, PRIMARY_GRADIENT } from '../ui/styles';

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (content: string) => void;
  /** Disables the textarea and the send button. */
  disabled: boolean;
  placeholder: string;
  sendLabel: string;
  hint: ReactNode;
}

/** Message box with Enter-to-send and Shift+Enter for a new line. */
export function ChatComposer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  sendLabel,
  hint,
}: ChatComposerProps) {
  const canSend = !disabled && value.trim().length > 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSend) onSend(value);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4"
      style={{ borderTop: '1px solid var(--color-border)' }}
    >
      <div
        className="rounded-xl p-2 flex items-end gap-2"
        style={{ background: fieldStyle.background, border: fieldStyle.border }}
      >
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (canSend) onSend(value);
            }
          }}
          rows={2}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={placeholder}
          className="flex-1 min-h-[44px] max-h-36 resize-y bg-transparent px-3 py-2 text-sm outline-none disabled:opacity-60"
          style={foregroundText}
        />

        <button
          type="submit"
          disabled={!canSend}
          className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center disabled:opacity-60"
          style={{
            background: PRIMARY_GRADIENT,
            color: 'var(--color-primary-foreground)',
          }}
          aria-label={sendLabel}
        >
          <Send size={17} />
        </button>
      </div>

      <p className="text-xs mt-2 px-1" style={mutedText}>
        {hint}
      </p>
    </form>
  );
}
