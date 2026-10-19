import type { InputHTMLAttributes, ReactNode } from 'react';
import { fieldStyle, foregroundText, mutedText } from './styles';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'style'> {
  label: ReactNode;
  hint?: ReactNode;
  className?: string;
}

/** Labelled single-line input in the app's standard field style. */
export function TextField({ label, hint, className = '', ...inputProps }: TextFieldProps) {
  return (
    <label
      className={`${className} flex flex-col gap-2 text-sm font-medium`.trim()}
      style={foregroundText}
    >
      {label}
      <input
        {...inputProps}
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none disabled:opacity-60"
        style={fieldStyle}
      />

      {hint && (
        <span className="text-xs font-normal" style={mutedText}>
          {hint}
        </span>
      )}
    </label>
  );
}
