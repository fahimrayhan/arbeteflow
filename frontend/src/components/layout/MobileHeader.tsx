import { Menu, Moon, Sun } from 'lucide-react';
import type { Theme } from '../../app/useTheme';
import { foregroundText, mutedText } from '../ui/styles';

interface MobileHeaderProps {
  title: string;
  theme: Theme;
  onOpenMenu: () => void;
  onToggleTheme: () => void;
}

const iconButtonStyle = {
  background: 'var(--color-muted)',
  color: 'var(--color-foreground)',
};

export function MobileHeader({ title, theme, onOpenMenu, onToggleTheme }: MobileHeaderProps) {
  const themeLabel = theme === 'dark' ? 'Use light theme' : 'Use dark theme';

  return (
    <header
      className="sticky top-0 z-20 lg:hidden h-16 flex items-center gap-3 px-4"
      style={{
        background: 'var(--color-background)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={iconButtonStyle}
        aria-label="Open navigation menu"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0">
        <div className="font-semibold truncate" style={foregroundText}>
          {title}
        </div>

        <div className="text-xs truncate" style={mutedText}>
          Local career accelerator
        </div>
      </div>

      <button
        type="button"
        onClick={onToggleTheme}
        className="ml-auto w-10 h-10 rounded-lg flex items-center justify-center"
        style={iconButtonStyle}
        aria-label={themeLabel}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}
