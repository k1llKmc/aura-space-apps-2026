'use client';
import { ErrorState } from '@/components/ui/ui';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      message="This section could not be displayed. Try loading it again."
      retry={reset}
    />
  );
}
