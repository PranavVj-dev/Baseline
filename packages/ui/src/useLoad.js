import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './auth.jsx';

// Loads a GET endpoint and exposes { data, error, loading, reload }.
export function useLoad(path) {
  const { api } = useAuth();
  const [s, setS] = useState({ data: null, error: '', loading: true });
  const reload = useCallback(
    () => api.request(path)
      .then((data) => setS({ data, error: '', loading: false }))
      .catch((e) => setS({ data: null, error: e.message, loading: false })),
    [api, path],
  );
  useEffect(() => { reload(); }, [reload]);
  return { ...s, reload };
}
