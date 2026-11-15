'use client';
import type { ReactNode } from 'react';
import { SessionProvider, useSession } from './auth/session-provider';
import { NotificationProvider } from './ui/notifications';
import { CrewSessionProvider, useCrewSession } from './experience/crew-session';
function ScopedNotifications({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const { crewId } = useCrewSession();
  return (
    <NotificationProvider
      key={
        user
          ? `${user.id}/${user.role}/${user.missionId}/${user.crewMemberId}/${crewId}`
          : 'guest'
      }
    >
      {children}
    </NotificationProvider>
  );
}
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CrewSessionProvider>
        <ScopedNotifications>{children}</ScopedNotifications>
      </CrewSessionProvider>
    </SessionProvider>
  );
}
