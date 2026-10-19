import { ChevronRight, Moon, Sparkles, Sun } from 'lucide-react';
import { NAV_ITEMS } from '../../app/navigation';
import type { Theme } from '../../app/useTheme';
import type { View } from '../../lib/types';
import { foregroundText, mutedText } from '../ui/styles';

interface SidebarProps {
  view: View;
  open: boolean;
  theme: Theme;
  onNavigate: (view: View) => void;
  onToggleTheme: () => void;
}

export function Sidebar({ view, open, theme, onNavigate, onToggleTheme }: SidebarProps) {
  return (
    <aside
      className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-[272px] shrink-0 transition-transform duration-200 lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{
        background: 'var(--color-card)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      <div className="h-full flex flex-col p-4">
        <div className="flex items-center gap-3 px-2 py-3 mb-5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #84CC16, #A3E635)',
              color: 'var(--color-primary-foreground)',
              boxShadow: 'var(--shadow-btn-glow)',
            }}
          >
            <Sparkles size={20} />
          </div>

          <div>
            <div className="font-bold tracking-tight" style={foregroundText}>
              ArbeteFlow
            </div>

            <div className="text-xs" style={mutedText}>
              Local career accelerator
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === view;
            const activeColor = isActive ? 'var(--color-primary)' : undefined;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="group flex items-center gap-3 w-full rounded-xl px-3 py-3 text-left transition-colors"
                style={{
                  background: isActive ? 'rgba(163,230,53,0.10)' : 'transparent',
                  color: activeColor ?? 'var(--color-muted-foreground)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: isActive ? 'rgba(163,230,53,0.14)' : 'var(--color-muted)',
                    color: activeColor ?? 'var(--color-muted-foreground)',
                  }}
                >
                  <Icon size={17} />
                </div>

                <div className="min-w-0 flex-1">
                  <div
                    className="text-sm font-semibold"
                    style={{ color: activeColor ?? 'var(--color-foreground)' }}
                  >
                    {item.label}
                  </div>

                  <div
                    className="text-xs truncate mt-0.5"
                    style={{ color: activeColor ?? 'var(--color-muted-foreground)' }}
                  >
                    {item.description}
                  </div>
                </div>

                {isActive && <ChevronRight size={16} />}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-4">
          <div
            className="rounded-xl p-3"
            style={{
              background: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)' }} />

              <span className="text-xs font-semibold" style={foregroundText}>
                MongoDB backend
              </span>
            </div>

            <p className="text-xs leading-5 mt-1" style={mutedText}>
              Resume, applications, and AI requests are handled by the API service.
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className="mt-3 flex items-center gap-2 w-full rounded-xl px-3 py-2.5 text-sm"
            style={{
              color: 'var(--color-muted-foreground)',
              background: 'transparent',
            }}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            {theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
          </button>
        </div>
      </div>
    </aside>
  );
}
