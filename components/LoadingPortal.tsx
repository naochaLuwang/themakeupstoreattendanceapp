export default function LoadingPortal() {
    return (
        <div className="flex flex-col items-center gap-4 animate-pulse">
            <div className="w-12 h-1 bg-black" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-20">
                Authenticating_Session
            </span>
        </div>
    );
}