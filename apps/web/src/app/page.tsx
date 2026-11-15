import { MissionControlView } from '@/components/mission-control/mission-control-view';
import { SessionGate } from '@/components/auth/session-gate';

export default function HomePage() {
  return <main className="mx-auto min-h-screen max-w-5xl px-6 py-12"><SessionGate><MissionControlView /></SessionGate></main>;
}
