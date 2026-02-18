import { Suspense } from 'react';
import AuthRedirectWrapper from '@/components/auth/AuthRedirectWrapper';
import LoadingPortal from '@/components/LoadingPortal';

export default function RootPage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center relative overflow-hidden">
      {/* Poster Element: Huge Ghost Branding */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <h1 className="text-[20vw] font-black opacity-[0.02] tracking-tighter uppercase">
          WELCOME
        </h1>
      </div>

      {/* The logic is suspended so the build ignores it */}
      <Suspense fallback={<LoadingPortal />}>
        <AuthRedirectWrapper />
      </Suspense>
    </div>
  );
}