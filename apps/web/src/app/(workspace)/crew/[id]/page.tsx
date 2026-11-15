import { CrewProfilePage } from '@/components/pages/crew-profile-page';
import { demoCrewIds } from '@/demo/config';
export function generateStaticParams() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? demoCrewIds.map(id => ({ id })) : [];
}
export const metadata = { title: 'Crew Profile' };
export default function Page() {
  return <CrewProfilePage />;
}
