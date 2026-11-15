import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <p className="eyebrow">404</p>
      <h1 className="mt-3 text-3xl font-semibold">Page not found</h1>
      <p className="muted my-4">
        This address is not part of the mission workspace.
      </p>
      <Link className="text-link" href="/mission-control">
        Return to Mission Control →
      </Link>
    </main>
  );
}
