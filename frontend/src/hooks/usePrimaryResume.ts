import { useEffect, useRef, useState } from 'react';
import { getPrimaryResume } from '../lib/api';
import { getErrorMessage } from '../lib/errors';
import type { ApiResume } from '../lib/types';

/**
 * Loads the user's saved primary resume once on mount.
 * `onLoaded` runs after a successful load (also with `null` when none is saved).
 */
export function usePrimaryResume(onLoaded?: (resume: ApiResume | null) => void) {
  const [resume, setResume] = useState<ApiResume | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    let active = true;

    getPrimaryResume()
      .then((loaded) => {
        if (!active) return;
        setResume(loaded);
        onLoadedRef.current?.(loaded);
      })
      .catch((loadError: unknown) => {
        if (active) setError(getErrorMessage(loadError, 'Could not load your saved resume.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { resume, setResume, loading, error };
}
