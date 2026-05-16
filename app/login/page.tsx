import { Suspense } from 'react';
import { LoginClient } from './LoginClient';

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const email = typeof searchParams?.email === 'string' ? searchParams?.email : '';
  const returnTo = typeof searchParams?.returnTo === 'string' ? searchParams?.returnTo : '';

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="h-80 rounded-3xl bg-white/70 ring-1 ring-black/5" />
          </div>
        </div>
      }
    >
      <LoginClient initialEmail={email} returnTo={returnTo} />
    </Suspense>
  );
}

