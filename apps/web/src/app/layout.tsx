import type { Metadata } from 'next';
import './globals.css';
import './experience.css';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: { default: 'AURA Mission Workspace', template: '%s | AURA' },
  description: 'Astronaut Unified Risk Assessment',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
