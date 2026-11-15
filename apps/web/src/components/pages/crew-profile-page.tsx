'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CrewProfile } from '@/components/crew/crew-profile';
import { useSession } from '@/components/auth/session-provider';
import { ErrorState, PageHeader } from '@/components/ui/ui';
export function CrewProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useSession();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return (
      <ErrorState message="This crew profile address is invalid. Return to Crew Overview and choose a profile." />
    );
  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Crew / Individual assessment"
        title="Crew Profile"
        description="Review five body zones, measurement freshness, reference comparisons and clinical activity."
        actions={
          <Link
            className="button button-primary"
            href={`/daily-check?crewMemberId=${id}`}
          >
            Daily health check
          </Link>
        }
      />
      {user && <CrewProfile key={id} id={id} actor={user} />}
    </div>
  );
}
