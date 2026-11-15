import { Suspense } from 'react';
import { DailyCheckPage } from '@/components/pages/daily-check-page';
import { LoadingState } from '@/components/ui/ui';
export const metadata = { title: 'Daily Health Check' };
export default function Page() {
  return (
    <Suspense fallback={<LoadingState label="Opening daily check…" />}>
      <DailyCheckPage />
    </Suspense>
  );
}
