import { useCallback, useMemo, useState, type ComponentType } from 'react';
import { AppContext, type AppContextType } from './app/AppContext';
import { NAV_ITEMS } from './app/navigation';
import { useTheme } from './app/useTheme';
import { MobileHeader } from './components/layout/MobileHeader';
import { Sidebar } from './components/layout/Sidebar';
import type { JobDraft, View } from './lib/types';

import Home from './views/Home';
import Chat from './views/Chat';
import CoverLetter from './views/CoverLetter';
import Interview from './views/Interview';
import JobFinder from './views/JobFinder';
import Resume from './views/Resume';
import SettingsView from './views/Settings';
import Tracker from './views/Tracker';
import TrustView, { FaqView } from './views/Trust';

const VIEWS: Record<View, ComponentType> = {
  home: Home,
  resume: Resume,
  coverletter: CoverLetter,
  chat: Chat,
  interview: Interview,
  finder: JobFinder,
  tracker: Tracker,
  settings: SettingsView,
  trust: TrustView,
  faq: FaqView,
};

export default function App() {
  const [view, setView] = useState<View>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jobDraft, setJobDraft] = useState<JobDraft | null>(null);
  const { theme, toggleTheme } = useTheme();

  const navigate = useCallback((nextView: View) => {
    setView(nextView);
    setSidebarOpen(false);
  }, []);

  const openWithJob = useCallback(
    (nextView: View, draft: JobDraft) => {
      setJobDraft(draft);
      navigate(nextView);
    },
    [navigate],
  );

  const clearJobDraft = useCallback(() => setJobDraft(null), []);

  const contextValue = useMemo<AppContextType>(
    () => ({ navigate, theme, toggleTheme, jobDraft, openWithJob, clearJobDraft }),
    [navigate, theme, toggleTheme, jobDraft, openWithJob, clearJobDraft],
  );

  const activeNavigationItem = NAV_ITEMS.find((item) => item.id === view);
  const ActiveView = VIEWS[view];

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
            style={{ background: 'rgba(0, 0, 0, 0.55)' }}
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          view={view}
          open={sidebarOpen}
          theme={theme}
          onNavigate={navigate}
          onToggleTheme={toggleTheme}
        />

        <main className="min-w-0 flex-1">
          <MobileHeader
            title={activeNavigationItem?.label ?? 'ArbetsFlow'}
            theme={theme}
            onOpenMenu={() => setSidebarOpen(true)}
            onToggleTheme={toggleTheme}
          />

          <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <ActiveView />
          </div>
        </main>
      </div>
    </AppContext.Provider>
  );
}
