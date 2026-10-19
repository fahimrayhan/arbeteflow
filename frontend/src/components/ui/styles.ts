import type { CSSProperties } from 'react';

/*
  Shared inline-style tokens. The app styles components with CSS variables
  from index.css plus a few brand rgba() tints; keeping them here means a
  colour tweak happens once instead of in every view.
*/

export const PRIMARY_GRADIENT = 'linear-gradient(135deg, #84CC16, #A3E635)';

export const PRIMARY_TINT = 'rgba(163,230,53,0.10)';

/** Gradient call-to-action button. */
export const primaryButtonStyle: CSSProperties = {
  background: PRIMARY_GRADIENT,
  color: 'var(--color-primary-foreground)',
  boxShadow: 'var(--shadow-btn-glow)',
};

/** Bordered neutral button. */
export const secondaryButtonStyle: CSSProperties = {
  background: 'var(--color-muted)',
  color: 'var(--color-foreground)',
  border: '1px solid var(--color-border)',
};

/** Borderless neutral button used in toolbars. */
export const ghostButtonStyle: CSSProperties = {
  color: 'var(--color-foreground)',
  background: 'var(--color-muted)',
};

export const cardStyle: CSSProperties = {
  background: 'var(--color-card)',
  border: '1px solid var(--color-border)',
};

/** Text inputs, textareas and read-only output boxes. */
export const fieldStyle: CSSProperties = {
  background: 'var(--color-muted)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-foreground)',
};

/** Small square tile holding an icon. */
export const iconTileStyle: CSSProperties = {
  background: PRIMARY_TINT,
  color: 'var(--color-primary)',
};

export const foregroundText: CSSProperties = { color: 'var(--color-foreground)' };
export const mutedText: CSSProperties = { color: 'var(--color-muted-foreground)' };
export const primaryText: CSSProperties = { color: 'var(--color-primary)' };

/** Selectable card / pill (provider, tone, interview type, …). */
export function selectableStyle(
  active: boolean,
  inactiveBackground = 'var(--color-muted)',
): CSSProperties {
  return {
    background: active ? PRIMARY_TINT : inactiveBackground,
    border: active ? '1px solid rgba(163,230,53,0.45)' : '1px solid var(--color-border)',
    color: active ? 'var(--color-primary)' : 'var(--color-foreground)',
  };
}
