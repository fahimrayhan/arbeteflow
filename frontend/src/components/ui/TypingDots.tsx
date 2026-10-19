interface TypingDotsProps {
  /** `sm` inside buttons, `md` inside chat bubbles. */
  size?: 'sm' | 'md';
  label?: string;
}

export function TypingDots({ size = 'md', label }: TypingDotsProps) {
  const dot = size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5';

  return (
    <span
      className={size === 'sm' ? 'flex gap-1' : 'inline-flex gap-1'}
      aria-label={label}
      role={label ? 'status' : undefined}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={`${dot} rounded-full animate-pulse`}
          style={{
            background: 'currentColor',
            animationDelay: `${index * 150}ms`,
          }}
        />
      ))}
    </span>
  );
}
