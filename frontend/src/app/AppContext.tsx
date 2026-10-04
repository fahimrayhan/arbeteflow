import { createContext, useContext, useEffect, useRef } from 'react';
import type { JobDraft, View } from '../lib/types';
import type { Theme } from './useTheme';

export interface AppContextType {
  navigate: (view: View) => void;
  theme: Theme;
  toggleTheme: () => void;
  /** Job details handed to the next view (from Job Finder). */
  jobDraft: JobDraft | null;
  /** Navigate to `view` and prefill it with `draft`. */
  openWithJob: (view: View, draft: JobDraft) => void;
  clearJobDraft: () => void;
}

const defaultAppContext: AppContextType = {
  navigate: () => undefined,
  theme: 'dark',
  toggleTheme: () => undefined,
  jobDraft: null,
  openWithJob: () => undefined,
  clearJobDraft: () => undefined,
};

export const AppContext = createContext<AppContextType>(defaultAppContext);

export function useApp(): AppContextType {
  return useContext(AppContext);
}

/** Applies a pending job draft once (if any) and clears it. */
export function useConsumeJobDraft(apply: (draft: JobDraft) => void): void {
  const { jobDraft, clearJobDraft } = useApp();
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (!jobDraft) return;
    applyRef.current(jobDraft);
    clearJobDraft();
  }, [jobDraft, clearJobDraft]);
}
