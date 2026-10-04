import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { foregroundText, mutedText } from './styles';

interface EmptyStateProps {
  icon: LucideIcon;
  title: ReactNode;
  description: ReactNode;
  className?: string;
  descriptionClassName?: string;
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  className = 'h-full min-h-[380px] flex flex-col items-center justify-center text-center px-8',
  descriptionClassName = 'mt-2 text-sm max-w-sm',
  children,
}: EmptyStateProps) {
  return (
    <div className={className}>
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: 'rgba(163,230,53,0.1)',
          color: 'var(--color-primary)',
        }}
      >
        <Icon size={22} />
      </div>

      <h3 className="font-semibold" style={foregroundText}>
        {title}
      </h3>

      <p className={descriptionClassName} style={mutedText}>
        {description}
      </p>

      {children}
    </div>
  );
}
