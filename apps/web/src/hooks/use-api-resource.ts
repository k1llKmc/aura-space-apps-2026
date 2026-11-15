'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/services/api/client';
export function useApiResource<T>(
  path: string | null,
  interval = 0,
  stopWhen?: (value: T) => boolean,
) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!path);
  const [revision, setRevision] = useState(0);
  const previous = useRef<string | null>(null);
  const stop = useRef(stopWhen);
  stop.current = stopWhen;
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    if (previous.current !== path) {
      setData(undefined);
      previous.current = path;
    }
    if (!path) {
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    apiClient
      .get<T>(path, { signal: controller.signal })
      .then(({ data: value }) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : 'Unable to load data.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision]);
  useEffect(() => {
    if (!path || !interval || (data && stop.current?.(data))) return;
    const timer = setInterval(refresh, interval);
    return () => clearInterval(timer);
  }, [path, interval, refresh, data]);
  return { data, error, loading, refresh };
}
