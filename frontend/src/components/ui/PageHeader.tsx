import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { foregroundText, mutedText, primaryText } from './styles';

interface PageHeaderProps {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  className?: string;
  descriptionClassName?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  className,
  descriptionClassName = 'mt-2',
}: PageHeaderProps) {
  return (
    <div className={className}>
      <div
        className="flex items-center gap-2 text-xs font-semibold tracking-widest mb-2"
        style={primaryText}
      >
        <Sparkles size={14} />
        {eyebrow}
      </div>

      <h1 className="text-3xl font-bold tracking-tight" style={foregroundText}>
        {title}
      </h1>

      <p className={descriptionClassName} style={mutedText}>
        {description}
      </p>
    </div>
  );
}
