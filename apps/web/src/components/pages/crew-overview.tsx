'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useWorkspace } from '@/components/shell/workspace-provider';
import { CrewCard } from '@/components/ui/aura';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
} from '@/components/ui/ui';
export function CrewOverview() {
  const { roster } = useWorkspace();
  const [search, setSearch] = useState(''),
    [offset, setOffset] = useState(0);
  const rows =
    roster.data?.filter((member) =>
      `${member.name} ${member.role}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    ) || [];
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Operations / People"
        title="Crew Overview"
        description="Find a crew member, inspect their health profile or record a daily check."
        actions={
          <Button onClick={roster.refresh} disabled={roster.loading}>
            Refresh crew
          </Button>
        }
      />
      {roster.error && (
        <ErrorState message={roster.error} retry={roster.refresh} />
      )}
      {!roster.data && roster.loading && (
        <LoadingState label="Loading accessible crew profiles…" />
      )}
      {roster.data && (
        <>
          <label className="search-field">
            Search crew
            <input
              type="search"
              value={search}
              placeholder="Name or mission role"
              onChange={(event) => {
                setSearch(event.target.value);
                setOffset(0);
              }}
            />
          </label>
          <p className="muted text-sm">
            {roster.data.length} profiles accessible to your account. Medical
            state is assessed inside each profile.
          </p>
          {rows.length ? (
            <>
              <div
                className="crew-card-grid"
                aria-label="Crew profile shortcuts"
              >
                {rows.slice(offset, offset + 20).map((member) => (
                  <CrewCard key={member.id} member={member} />
                ))}
              </div>
              <DataTable
                caption="Accessible crew roster"
                rows={rows.slice(offset, offset + 20)}
                columns={[
                  {
                    key: 'name',
                    label: 'Crew member',
                    render: (member) => (
                      <Link className="crew-name" href={`/crew/${member.id}`}>
                        <span className="avatar" aria-hidden="true">
                          {member.name
                            .split(' ')
                            .filter(Boolean)
                            .slice(-2)
                            .map((part) => part[0])
                            .join('')}
                        </span>
                        <strong>{member.name}</strong>
                      </Link>
                    ),
                  },
                  {
                    key: 'role',
                    label: 'Mission role',
                    render: (member) => member.role,
                  },
                  {
                    key: 'profile',
                    label: 'Health profile',
                    render: (member) => (
                      <Link className="text-link" href={`/crew/${member.id}`}>
                        View profile →
                      </Link>
                    ),
                  },
                  {
                    key: 'check',
                    label: 'Daily report',
                    render: (member) => (
                      <Link
                        className="button button-secondary"
                        href={`/daily-check?crewMemberId=${member.id}`}
                      >
                        Record check
                      </Link>
                    ),
                  },
                ]}
              />
              <Pagination
                total={rows.length}
                offset={offset}
                onChange={setOffset}
              />
            </>
          ) : (
            <EmptyState
              title={search ? 'No matching crew' : 'No crew profiles'}
              description={
                search
                  ? 'Try another name or role.'
                  : 'Your account has no accessible crew profiles.'
              }
            />
          )}
        </>
      )}
    </div>
  );
}
