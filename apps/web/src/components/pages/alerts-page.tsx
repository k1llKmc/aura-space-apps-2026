'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import type { AlertResponse, ListResponse } from '@aura/shared-types';
import { useApiResource } from '@/hooks/use-api-resource';
import { useSession } from '@/components/auth/session-provider';
import { useWorkspace } from '@/components/shell/workspace-provider';
import { useNotifications } from '@/components/ui/notifications';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
} from '@/components/ui/ui';
import { apiClient } from '@/services/api/client';
export function AlertsPage() {
  const [offset, setOffset] = useState(0),
    [state, setState] = useState('false'),
    [severity, setSeverity] = useState('');
  const [selected, setSelected] = useState<AlertResponse>();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const { user } = useSession();
  const workspace = useWorkspace();
  const { notify } = useNotifications();
  const params = new URLSearchParams({
    offset: String(offset),
    limit: '20',
    ...(state ? { isResolved: state } : {}),
    ...(severity ? { severity } : {}),
  });
  const resource = useApiResource<ListResponse<AlertResponse>>(
    `/alerts?${params}`,
    15000,
  );
  async function acknowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await apiClient.patch<AlertResponse>(
        `/alerts/${selected.id}/resolve`,
        { note: new FormData(event.currentTarget).get('note') },
      );
      notify(
        data.resolvedById === user!.id
          ? 'Warning acknowledged.'
          : 'This warning was already acknowledged by another operator.',
        'success',
      );
      setSelected(undefined);
      resource.refresh();
      workspace.alerts.refresh();
      workspace.mission.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to acknowledge warning.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operations / Review queue"
        title="Alerts"
        description="Review active and resolved warnings within your mission and profile permissions."
        actions={
          <Button onClick={resource.refresh} disabled={resource.loading}>
            Refresh warnings
          </Button>
        }
      />
      <div className="filter-bar">
        <label>
          Warning status
          <select
            aria-label="Warning status"
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setOffset(0);
            }}
          >
            <option value="false">Active warnings</option>
            <option value="true">Resolved warnings</option>
            <option value="">All warnings</option>
          </select>
        </label>
        <label>
          Severity
          <select
            aria-label="Severity"
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value);
              setOffset(0);
            }}
          >
            <option value="">All severities</option>
            {['CRITICAL', 'ATTENTION', 'OUTDATED', 'NOMINAL'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <p className="muted text-sm">
          {user?.role === 'CREW_MEMBER'
            ? 'Mission-wide and your own profile warnings'
            : 'All warnings in your assigned mission'}
        </p>
      </div>
      {resource.error && (
        <ErrorState message={resource.error} retry={resource.refresh} />
      )}
      {!resource.data && resource.loading && (
        <LoadingState label="Loading warnings…" />
      )}
      {resource.data &&
        (resource.data.items.length ? (
          <>
            <DataTable
              caption="Mission and profile warnings"
              rows={resource.data.items}
              columns={[
                {
                  key: 'severity',
                  label: 'Severity',
                  render: (alert) => <Badge value={alert.severity} />,
                },
                {
                  key: 'title',
                  label: 'Warning',
                  render: (alert) => (
                    <div className="max-w-md">
                      <strong className="block text-white">
                        {alert.title}
                      </strong>
                      <p className="muted mt-1 line-clamp-2 text-xs">
                        {alert.message}
                      </p>
                    </div>
                  ),
                },
                {
                  key: 'scope',
                  label: 'Scope',
                  render: (alert) =>
                    alert.crewMemberId ? (
                      <Link
                        className="text-link"
                        href={`/crew/${alert.crewMemberId}`}
                      >
                        {workspace.roster.data?.find(
                          (member) => member.id === alert.crewMemberId,
                        )?.name || 'Crew profile'}
                      </Link>
                    ) : (
                      'Mission-wide'
                    ),
                },
                {
                  key: 'date',
                  label: 'Created',
                  render: (alert) => (
                    <time className="whitespace-nowrap text-xs">
                      {new Date(alert.createdAt).toLocaleString()}
                    </time>
                  ),
                },
                {
                  key: 'action',
                  label: 'Review',
                  render: (alert) => (
                    <Button
                      onClick={() => {
                        setSelected(alert);
                        setError('');
                      }}
                    >
                      {alert.isResolved ? 'View review' : 'Review warning'}
                    </Button>
                  ),
                },
              ]}
            />
            <Pagination
              offset={offset}
              total={resource.data.total}
              onChange={setOffset}
            />
          </>
        ) : (
          <>
            <EmptyState
              title="No warnings match these filters"
              description="Change the status or severity filter, or refresh to check for updates."
            />
            <Pagination
              offset={offset}
              total={resource.data.total}
              onChange={setOffset}
            />
          </>
        ))}
      <Modal
        open={!!selected}
        title="Warning review"
        onClose={() => setSelected(undefined)}
        busy={busy}
      >
        {selected && (
          <div className="space-y-4">
            <Badge value={selected.severity} />
            <h3 className="text-lg font-semibold">{selected.title}</h3>
            <p className="muted whitespace-pre-wrap break-words">
              {selected.message}
            </p>
            <p className="muted text-xs">
              {selected.origin.replaceAll('_', ' ')} ·{' '}
              {new Date(selected.createdAt).toLocaleString()}
            </p>
            {selected.crewMemberId && (
              <Link
                className="text-link"
                href={`/crew/${selected.crewMemberId}`}
              >
                Open related health profile →
              </Link>
            )}
            {selected.isResolved ? (
              <div className="panel p-4">
                <p className="font-medium">
                  Reviewed{' '}
                  {selected.resolvedAt
                    ? new Date(selected.resolvedAt).toLocaleString()
                    : ''}
                </p>
                <p className="muted mt-2 whitespace-pre-wrap">
                  {selected.resolutionNote || 'No review note is available.'}
                </p>
              </div>
            ) : user?.role === 'CREW_MEMBER' ? (
              <p className="muted">
                A Commander or Medical Officer can acknowledge this warning.
              </p>
            ) : (
              <form onSubmit={acknowledge} className="space-y-4">
                <label>
                  Review note
                  <textarea name="note" required maxLength={2000} rows={4} />
                </label>
                <p className="muted text-xs">
                  Acknowledgement records your review. It does not alter
                  measured risk or data freshness.
                </p>
                {error && <ErrorState message={error} />}
                <Button type="submit" variant="primary" disabled={busy}>
                  {busy ? 'Saving review…' : 'Acknowledge warning'}
                </Button>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
