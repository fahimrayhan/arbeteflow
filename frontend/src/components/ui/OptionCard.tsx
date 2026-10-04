import type { LucideIcon } from 'lucide-react';
import { selectableStyle } from './styles';

interface OptionCardProps {
  label: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  /** Shape/padding classes for the button. */
  className: string;
  descriptionClassName?: string;
  /** When set, renders the icon beside the label (coach mode cards). */
  icon?: LucideIcon;
  inactiveBackground?: string;
}

/** A selectable card with a label and a one-line description. */
export function OptionCard({
  label,
  description,
  active,
  disabled,
  onSelect,
  className,
  descriptionClassName = 'text-xs leading-5 mt-1',
  icon: Icon,
  inactiveBackground,
}: OptionCardProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onSelect}
      className={className}
      style={selectableStyle(active, inactiveBackground)}
    >
      {Icon ? (
        <div className="flex items-center gap-2">
          <Icon size={17} />
          <span className="font-semibold text-sm">{label}</span>
        </div>
      ) : (
        <div className="text-sm font-semibold">{label}</div>
      )}

      <div
        className={descriptionClassName}
        style={{
          color: active ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
        }}
      >
        {description}
      </div>
    </button>
  );
}
