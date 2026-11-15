'use client';
import type { ReactNode } from 'react';
import { SessionProvider, useSession } from './auth/session-provider';
import { NotificationProvider } from './ui/notifications';
function ScopedNotifications({ children }: { children: ReactNode }) {
  const { user } = useSession();
  return (
    <NotificationProvider
      key={
        user
          ? `${user.id}/${user.role}/${user.missionId}/${user.crewMemberId}`
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
      <ScopedNotifications>{children}</ScopedNotifications>
    </SessionProvider>
  );
}
