'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type {
  AlertResponse,
  CrewSummary,
  ListResponse,
  MissionStatusResponse,
} from '@aura/shared-types';
import { useApiResource } from '@/hooks/use-api-resource';
import { apiClient } from '@/services/api/client';
function useRoster() {
  const [data, setData] = useState<CrewSummary[]>();
  const [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    async function load() {
      const rows: CrewSummary[] = [];
      let total = Infinity;
      while (rows.length < total) {
        const { data: page } = await apiClient.get<ListResponse<CrewSummary>>(
          `/crew?limit=100&offset=${rows.length}`,
          { signal: controller.signal },
        );
        total = page.total;
        if (!page.items.length) break;
        rows.push(...page.items);
      }
      if (!controller.signal.aborted) setData(rows);
    }
    void load()
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : 'Unable to load crew.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  return { data, error, loading, refresh };
}
interface Workspace {
  mission: ReturnType<typeof useApiResource<MissionStatusResponse>>;
  alerts: ReturnType<typeof useApiResource<ListResponse<AlertResponse>>>;
  roster: ReturnType<typeof useRoster>;
}
const Context = createContext<Workspace | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const mission = useApiResource<MissionStatusResponse>(
    '/missions/current',
    15000,
  );
  const alerts = useApiResource<ListResponse<AlertResponse>>(
    '/alerts?isResolved=false&limit=5',
    15000,
  );
  const roster = useRoster();
  return (
    <Context.Provider value={{ mission, alerts, roster }}>
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkspaceProvider is required.');
  return value;
}
