import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, type LucideIcon } from 'lucide-react';

const TONES = {
  error: {
    icon: AlertCircle,
    style: {
      color: 'var(--danger-text)',
      background: 'var(--danger-bg)',
      border: '1px solid var(--danger-border)',
    },
  },
  success: {
    icon: CheckCircle2,
    style: {
      color: 'var(--success-text)',
      background: 'rgba(163,230,53,0.08)',
      border: '1px solid rgba(163,230,53,0.22)',
    },
  },
} as const;

interface AlertProps {
  tone?: keyof typeof TONES;
  /** Optional bold first line, e.g. "Error". */
  title?: string;
  icon?: LucideIcon;
  /** Compact = rounded-lg / px-3 (inside panels); default = rounded-xl / px-4. */
  compact?: boolean;
  /** Extra classes, typically margins. */
  className?: string;
  children: ReactNode;
}

export function Alert({
  tone = 'error',
  title,
  icon,
  compact = false,
  className = '',
  children,
}: AlertProps) {
  const Icon = icon ?? TONES[tone].icon;
  const shape = compact ? 'rounded-lg px-3 py-3' : 'rounded-xl px-4 py-3';

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`${className} flex gap-2 ${shape} text-sm`.trim()}
      style={TONES[tone].style}
    >
      <Icon size={compact ? 17 : 18} className="shrink-0 mt-0.5" />

      {title ? (
        <div>
          <div className="font-semibold">{title}</div>
          <div>{children}</div>
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

/** Small primary-tinted status line used under form controls. */
export function InlineNotice({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <p
      role="status"
      className={`${className} rounded-lg px-3 py-2 text-xs`.trim()}
      style={{
        color: 'var(--color-primary)',
        background: 'rgba(163,230,53,0.08)',
        border: '1px solid rgba(163,230,53,0.18)',
      }}
    >
      {children}
    </p>
  );
}
