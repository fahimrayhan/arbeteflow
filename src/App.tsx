import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  BriefcaseBusiness,
  ChevronRight,
  Search,
  FileText,
  Kanban,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import type { View } from './lib/types';

import Resume from './views/Resume';
import CoverLetter from './views/CoverLetter';
import Chat from './views/Chat';
import Interview from './views/Interview';
import Tracker from './views/Tracker';
import JobFinder from './views/JobFinder';
import SettingsView from './views/Settings';

type Theme = 'dark' | 'light';

interface AppContextType {
  navigate: (view: View) => void;
  theme: Theme;
  toggleTheme: () => void;
}

const defaultAppContext: AppContextType = {
  navigate: () => undefined,
  theme: 'dark',
  toggleTheme: () => undefined,
};

export const AppContext = createContext<AppContextType>(
  defaultAppContext,
);

export function useApp(): AppContextType {
  return useContext(AppContext);
}

type NavigationItem = {
  id: View;
  label: string;
  icon: typeof FileText;
  description: string;
};

const NAV_ITEMS: NavigationItem[] = [
  {
    id: 'resume',
    label: 'Resume',
    icon: FileText,
    description: 'Import and improve your CV',
  },
  {
    id: 'coverletter',
    label: 'Cover Letter',
    icon: Mail,
    description: 'Generate tailored applications',
  },
  {
    id: 'chat',
    label: 'AI Coach',
    icon: MessageSquare,
    description: 'Career advice and feedback',
  },
  {
    id: 'interview',
    label: 'Interview Practice',
    icon: BriefcaseBusiness,
    description: 'Practice with an AI interviewer',
  },
  {
    id: 'finder',
    label: 'Job Finder',
    icon: Search,
    description: 'Search and match Swedish listings',
  },
  {
    id: 'tracker',
    label: 'Job Tracker',
    icon: Kanban,
    description: 'Track applications and saved jobs',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    description: 'Local app preferences',
  },
];

function loadTheme(): Theme {
  try {
    const storedTheme = localStorage.getItem('careerAI-theme');

    return storedTheme === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export default function App() {
  const [view, setView] = useState<View>('resume');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme);

  const navigate = (nextView: View) => {
    setView(nextView);
  };

  const toggleTheme = () => {
    setTheme((currentTheme) =>
      currentTheme === 'dark' ? 'light' : 'dark',
    );
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [view]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);

    try {
      localStorage.setItem('careerAI-theme', theme);
    } catch {
      // Theme persistence is optional.
    }
  }, [theme]);

  const contextValue = useMemo<AppContextType>(
    () => ({
      navigate,
      theme,
      toggleTheme,
    }),
    [theme],
  );

  const activeNavigationItem = NAV_ITEMS.find(
    (item) => item.id === view,
  );

  return (
    <AppContext.Provider value={contextValue}>
      <div
        className="min-h-screen flex"
        style={{
          background: 'var(--color-background)',
          color: 'var(--color-foreground)',
        }}
      >
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            className="fixed inset-0 z-30 lg:hidden"
            style={{
              background: 'rgba(0, 0, 0, 0.55)',
            }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-[272px] shrink-0 transition-transform duration-200 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
                  background:
                    'linear-gradient(135deg, #84CC16, #A3E635)',
                  color: 'var(--color-primary-foreground)',
                  boxShadow: 'var(--shadow-btn-glow)',
                }}
              >
                <Sparkles size={20} />
              </div>

              <div>
                <div
                  className="font-bold tracking-tight"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  ArbeteFlow
                </div>

                <div
                  className="text-xs"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  Local career accelerator
                </div>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === view;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className="group flex items-center gap-3 w-full rounded-xl px-3 py-3 text-left transition-colors"
                    style={{
                      background: isActive
                        ? 'rgba(163,230,53,0.10)'
                        : 'transparent',
                      color: isActive
                        ? 'var(--color-primary)'
                        : 'var(--color-muted-foreground)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: isActive
                          ? 'rgba(163,230,53,0.14)'
                          : 'var(--color-muted)',
                        color: isActive
                          ? 'var(--color-primary)'
                          : 'var(--color-muted-foreground)',
                      }}
                    >
                      <Icon size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className="text-sm font-semibold"
                        style={{
                          color: isActive
                            ? 'var(--color-primary)'
                            : 'var(--color-foreground)',
                        }}
                      >
                        {item.label}
                      </div>

                      <div
                        className="text-xs truncate mt-0.5"
                        style={{
                          color: isActive
                            ? 'var(--color-primary)'
                            : 'var(--color-muted-foreground)',
                        }}
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
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: '#A3E635' }}
                  />

                  <span
                    className="text-xs font-semibold"
                    style={{ color: 'var(--color-foreground)' }}
                  >
                  MongoDB backend
                  </span>
                </div>

                <p
                  className="text-xs leading-5 mt-1"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  Resume, applications, and AI requests are handled by the API service.
                </p>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="mt-3 flex items-center gap-2 w-full rounded-xl px-3 py-2.5 text-sm"
                style={{
                  color: 'var(--color-muted-foreground)',
                  background: 'transparent',
                }}
              >
                {theme === 'dark' ? (
                  <Sun size={17} />
                ) : (
                  <Moon size={17} />
                )}

                {theme === 'dark'
                  ? 'Use light theme'
                  : 'Use dark theme'}
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header
            className="sticky top-0 z-20 lg:hidden h-16 flex items-center gap-3 px-4"
            style={{
              background: 'var(--color-background)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                background: 'var(--color-muted)',
                color: 'var(--color-foreground)',
              }}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <div
                className="font-semibold truncate"
                style={{ color: 'var(--color-foreground)' }}
              >
                {activeNavigationItem?.label ?? 'ArbeteFlow'}
              </div>

              <div
                className="text-xs truncate"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                Local career accelerator
              </div>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="ml-auto w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                background: 'var(--color-muted)',
                color: 'var(--color-foreground)',
              }}
              aria-label={
                theme === 'dark'
                  ? 'Use light theme'
                  : 'Use dark theme'
              }
            >
              {theme === 'dark' ? (
                <Sun size={18} />
              ) : (
                <Moon size={18} />
              )}
            </button>
          </header>

          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
            {view === 'resume' && <Resume />}
            {view === 'coverletter' && <CoverLetter />}
            {view === 'chat' && <Chat />}
            {view === 'interview' && <Interview />}
            {view === 'finder' && <JobFinder />}
            {view === 'tracker' && <Tracker />}
            {view === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>
    </AppContext.Provider>
  );
}
