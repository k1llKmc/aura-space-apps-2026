'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import type {
  AlertResponse,
  CrewSummary,
  HealthZoneStatus,
} from '@aura/shared-types';
import { Badge } from './ui';

export const zoneLabels: Record<string, string> = {
  HEAD_EYES: 'Head & eyes',
  CHEST_CARDIO: 'Chest & cardiovascular',
  ABDOMEN_METABOLISM: 'Abdomen & metabolism',
  WHOLE_BODY_IMMUNE: 'Whole body & immune',
  SKELETON_MUSCLES: 'Skeleton & muscles',
};
export function StatusBadge({ value }: { value?: string | null }) {
  return (
    <Badge
      value={value || 'UNKNOWN'}
      label={`Risk: ${value || 'Not assessed'}`}
    />
  );
}
export function DataFreshnessBadge({ value }: { value: string }) {
  return (
    <span className="freshness-badge" data-state={value}>
      Data: {value.replaceAll('_', ' ')}
    </span>
  );
}
export function CommDelayBadge({ value }: { value?: string }) {
  return (
    <span className="comm-delay-badge">
      <span aria-hidden="true">↔</span> Comm delay{' '}
      <strong>{value || '—'}</strong>
    </span>
  );
}
export function CrewCard({ member }: { member: CrewSummary }) {
  return (
    <article className="panel crew-card">
      <span className="avatar" aria-hidden="true">
        {member.name
          .split(' ')
          .filter(Boolean)
          .slice(-2)
          .map((part) => part[0])
          .join('')}
      </span>
      <div>
        <h2>{member.name}</h2>
        <p className="muted">{member.role}</p>
      </div>
      <Link
        className="text-link"
        href={`/crew/${member.id}`}
        aria-label={`Open health profile for ${member.name}`}
      >
        Open profile →
      </Link>
    </article>
  );
}
export function AlertCard({
  alert,
  children,
}: {
  alert: AlertResponse;
  children?: ReactNode;
}) {
  return (
    <article className="panel alert-card" data-severity={alert.severity}>
      <div className="flex flex-wrap items-center gap-3">
        <Badge value={alert.severity} />
        <h4>{alert.title}</h4>
      </div>
      <p className="muted mt-3">{alert.message}</p>
      {children}
    </article>
  );
}
export function ZoneStatusCard({
  zone,
  selected,
  children,
}: {
  zone: HealthZoneStatus;
  selected?: boolean;
  children?: ReactNode;
}) {
  return (
    <article
      id={`zone-${zone.zone}`}
      tabIndex={-1}
      className={`panel zone-status-card space-y-3 ${selected ? 'is-selected' : ''}`}
      aria-label={zoneLabels[zone.zone]}
    >
      <h4 className="text-lg font-medium">{zoneLabels[zone.zone]}</h4>
      <div className="flex flex-wrap gap-2">
        <StatusBadge value={zone.riskStatus} />
        <DataFreshnessBadge value={zone.dataState} />
      </div>
      {children}
    </article>
  );
}
