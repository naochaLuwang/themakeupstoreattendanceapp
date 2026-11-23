'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <h1 className="text-[20vw] font-black opacity-[0.02] tracking-tighter uppercase">
          OFFLINE
        </h1>
      </div>

      <div className="relative z-10 text-center px-6 max-w-md">
        <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636a9 9 0 010 12.728m-2.829-2.829a5 5 0 000-7.07m-4.243 4.243a1 1 0 010-1.414" />
          </svg>
        </div>

        <h2 className="text-2xl font-black tracking-tight mb-2">No Connection</h2>
        <p className="text-sm text-neutral-500 font-medium mb-8">
          You are currently offline. Some features may be unavailable until your connection is restored.
        </p>

        <button
          onClick={() => window.location.reload()}
          className="bg-black text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] active:scale-[0.98] transition-all"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
