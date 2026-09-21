import { useState, createContext, useContext, useEffect } from 'react';
import {
  FileText,
  Mail,
  MessageSquare,
  Kanban,
  Settings,
  Sparkles,
  ChevronRight,
  Menu,
  Sun,
  Moon,
} from 'lucide-react';
import type { View, AppSettings } from './lib/types';
import { PROVIDER_META } from './lib/types';
import { loadSettings, saveSettings } from './lib/storage';

import Resume from './views/Resume';
import CoverLetter from './views/CoverLetter';
import Chat from './views/Chat';
import Tracker from './views/Tracker';
import SettingsView from './views/Settings';

type Theme = 'dark' | 'light';

interface AppContextType {
  settings: AppSettings;
  updateSettings: (s: AppSettings) => void;
  navigate: (v: View) => void;
  theme: Theme;
}

export const AppContext = createContext<AppContextType>({
  settings: {
    providers: { anthropic: { apiKey: '' }, openai: { apiKey: '' }, gemini: { apiKey: '' }, ollama: { baseUrl: '', customModel: '' } },
    activeProvider: 'anthropic',
    activeModel: 'claude-fable-5-1',
  },
  updateSettings: () => { },
  navigate: () => { },
  theme: 'dark',
});

export const useApp = () => useContext(AppContext);

const NAV_ITEMS: { id: View; label: string; icon: typeof FileText; description: string }[] = [
  { id: 'resume', label: 'Resume', icon: FileText, description: 'AI-enhance your CV' },
  { id: 'coverletter', label: 'Cover Letter', icon: Mail, description: 'Generate cover letters' },
  { id: 'chat', label: 'AI Coach', icon: MessageSquare, description: 'Chat & get feedback' },
  { id: 'tracker', label: 'Job Tracker', icon: Kanban, description: 'Track applications' },
  { id: 'settings', label: 'Settings', icon: Settings, description: 'API keys & models' },
];

function loadTheme(): Theme {
  try { return (localStorage.getItem('careerAI-theme') as Theme) || 'dark'; }
  catch { return 'dark'; }
}

export default function App() {
  const [view, setView] = useState<View>('resume');
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme);

  const updateSettings = (s: AppSettings) => { setSettings(s); saveSettings(s); };
  const navigate = (v: View) => setView(v);

  useEffect(() => { setSidebarOpen(false); }, [view]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('careerAI-theme', theme); } catch { }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const providerMeta = PROVIDER_META[settings.activeProvider];
  const hasKey = settings.activeProvider === 'ollama'
    ? !!settings.providers.ollama.baseUrl
    : !!(settings.providers[settings.activeProvider] as { apiKey: string }).apiKey;

  return (
    <AppContext.Provider value={{ settings, updateSettings, navigate, theme }}>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-background)' }}>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/60 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:relative z-30 lg:z-auto h-full flex flex-col
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
          style={{
            width: 240,
            background: 'var(--color-sidebar)',
            borderRight: '1px solid var(--color-sidebar-border)',
          }}
        >
          {/* Logo */}
          <div
            className="flex items-center gap-3 px-5 py-5"
            style={{ borderBottom: '1px solid var(--color-sidebar-border)' }}
          >
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: 36,
                height: 36,
                background: 'linear-gradient(135deg, #65A30D, #A3E635)',
                boxShadow: 'var(--shadow-primary-glow)',
              }}
            >
              <Sparkles size={18} color="#111800" strokeWidth={2.5} />
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 14,
                  color: 'var(--color-foreground)',
                  lineHeight: 1.2,
                }}
              >
                CareerAI
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}>
                Your career co-pilot
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-4 px-3 space-y-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon, description }) => {
              const active = view === id;
              return (
                <button
                  key={id}
                  onClick={() => navigate(id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150"
                  style={{
                    background: active ? 'rgba(163,230,53,0.12)' : 'transparent',
                    border: active ? '1px solid rgba(163,230,53,0.2)' : '1px solid transparent',
                  }}
                >
                  <Icon
                    size={17}
                    style={{ color: active ? 'var(--color-primary)' : 'var(--color-muted-foreground)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: active ? 600 : 500,
                        fontSize: 13,
                        color: active ? 'var(--color-foreground)' : 'var(--color-secondary-foreground)',
                        lineHeight: 1.3,
                      }}
                    >
                      {label}
                    </div>
                    {active && (
                      <div style={{ fontSize: 11, color: 'var(--color-muted-foreground)', marginTop: 1 }}>
                        {description}
                      </div>
                    )}
                  </div>
                  {active && (
                    <ChevronRight size={13} style={{ color: 'var(--color-primary)' }} />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom: theme toggle + provider status */}
          <div className="px-4 py-4 space-y-3" style={{ borderTop: '1px solid var(--color-sidebar-border)' }}>
            {/* Theme toggle */}
            <div
              className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: 'var(--color-muted)', border: '1px solid var(--color-border)' }}
            >
              <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
                {theme === 'dark' ? 'Dark mode' : 'Light mode'}
              </span>
              <button
                onClick={toggleTheme}
                className="relative flex items-center rounded-full transition-all duration-300"
                style={{
                  width: 44,
                  height: 24,
                  background: theme === 'light'
                    ? 'linear-gradient(135deg, #84CC16, #A3E635)'
                    : 'var(--color-secondary)',
                  border: '1px solid var(--color-border)',
                  padding: 2,
                }}
                aria-label="Toggle theme"
              >
                {/* Track icons */}
                <Moon
                  size={11}
                  style={{
                    position: 'absolute',
                    left: 5,
                    color: theme === 'dark' ? '#A0A0A0' : 'transparent',
                    transition: 'color 0.2s',
                  }}
                />
                <Sun
                  size={11}
                  style={{
                    position: 'absolute',
                    right: 5,
                    color: theme === 'light' ? '#111800' : 'transparent',
                    transition: 'color 0.2s',
                  }}
                />
                {/* Thumb */}
                <span
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: 18,
                    height: 18,
                    background: theme === 'light' ? '#111800' : 'var(--color-muted-foreground)',
                    transform: theme === 'light' ? 'translateX(20px)' : 'translateX(0)',
                    flexShrink: 0,
                    display: 'block',
                  }}
                />
              </button>
            </div>

            {/* Provider status */}
            {hasKey ? (
              <button
                onClick={() => navigate('settings')}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all"
                style={{
                  background: providerMeta.bg,
                  border: `1px solid ${providerMeta.border}`,
                }}
              >
                <span style={{ fontSize: 15, color: providerMeta.color }}>{providerMeta.logo}</span>
                <div className="flex-1 min-w-0 text-left">
                  <div style={{ fontSize: 12, fontWeight: 600, color: providerMeta.color, fontFamily: 'var(--font-display)' }}>
                    {providerMeta.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {settings.activeModel}
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--color-primary)', flexShrink: 0 }} />
              </button>
            ) : (
              <button
                onClick={() => navigate('settings')}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition-all"
                style={{
                  background: 'rgba(163,230,53,0.07)',
                  border: '1px solid rgba(163,230,53,0.18)',
                  color: 'var(--color-primary)',
                }}
              >
                <div className="w-2 h-2 rounded-full bg-yellow-400" />
                Add API key to start →
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Mobile top bar */}
          <div
            className="flex items-center justify-between px-4 py-3 lg:hidden"
            style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-card)' }}
          >
            <button onClick={() => setSidebarOpen(true)}>
              <Menu size={22} style={{ color: 'var(--color-muted-foreground)' }} />
            </button>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--color-foreground)' }}>
              {NAV_ITEMS.find((n) => n.id === view)?.label}
            </span>
            <button onClick={toggleTheme} className="p-1">
              {theme === 'dark'
                ? <Sun size={18} style={{ color: 'var(--color-muted-foreground)' }} />
                : <Moon size={18} style={{ color: 'var(--color-muted-foreground)' }} />
              }
            </button>
          </div>

          {/* View */}
          <div className="flex-1 overflow-hidden">
            {view === 'resume' && <Resume />}
            {view === 'coverletter' && <CoverLetter />}
            {view === 'chat' && <Chat />}
            {view === 'tracker' && <Tracker />}
            {view === 'settings' && <SettingsView />}
          </div>
        </div>
      </div>
    </AppContext.Provider>
  );
}
