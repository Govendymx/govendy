import { Suspense } from 'react';
import { ResetPasswordClient } from './ResetPasswordClient';

export default function ResetPasswordPage() {
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
      <ResetPasswordClient />
    </Suspense>
  );
}
