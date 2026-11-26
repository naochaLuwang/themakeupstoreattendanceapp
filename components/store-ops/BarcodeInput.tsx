'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { lookupOperationsBarcode } from '@/app/actions/store-ops/restocking';
import { startAttendanceCamera, cameraError } from '@/lib/attendance/smart-scan/camera';

export default function BarcodeInput({ value, onChange, onProduct }: { value: string; onChange: (code: string) => void; onProduct?: (product: { product_name: string; brand: string | null }) => void }) {
    const id = useId();
    const video = useRef<HTMLVideoElement>(null);
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const lookupSequence = useRef(0);
    const latest = useRef({ onChange, onProduct }); latest.current = { onChange, onProduct };
    async function lookup(code: string) {
        if (!code.trim()) return;
        const sequence = ++lookupSequence.current;
        setMessage('Looking up product…');
        try { const product = await lookupOperationsBarcode(code); if (sequence !== lookupSequence.current) return; if (product) { latest.current.onProduct?.(product); setMessage('Product details found in store history.'); } else setMessage('New barcode. Enter the product details below.'); }
        catch { if (sequence === lookupSequence.current) setMessage('Lookup unavailable. You can enter the product details manually.'); }
    }
    useEffect(() => {
        if (!open || !video.current) return;
        const controller = new AbortController();
        let handled = false;
        void startAttendanceCamera(video.current, code => {
            if (handled || !code || code.length > 100) return;
            handled = true; controller.abort(); latest.current.onChange(code); setOpen(false); void lookup(code);
        }, controller.signal, 'barcode').catch(cause => { if (!controller.signal.aborted) setMessage(cameraError(cause).replace(/Manual attendance is available below\.|use manual attendance\./g, 'Enter the barcode manually.')); });
        return () => controller.abort();
    }, [open]);
    return <div className="space-y-2"><label htmlFor={id} className="sr-only">Barcode</label><div className="flex gap-2"><input id={id} value={value} onChange={event => onChange(event.target.value)} onBlur={() => void lookup(value)} required maxLength={100} inputMode="numeric" className="min-w-0 flex-1 rounded-lg border bg-transparent p-3 text-sm" /><button type="button" onClick={() => setOpen(true)} className="rounded-lg border px-3 text-sm">Scan</button></div>{message && <p role="status" className="text-xs text-slate-500">{message}</p>}
        {open && <dialog open aria-label="Scan product barcode" className="fixed inset-0 z-50 w-[min(90vw,500px)] rounded-xl border bg-white p-4 dark:bg-slate-900" onCancel={() => setOpen(false)}><p className="mb-3 text-sm">Point the camera at the product barcode.</p><video ref={video} autoPlay muted playsInline className="aspect-video w-full rounded-lg bg-black" /><button type="button" autoFocus onClick={() => setOpen(false)} className="mt-3 rounded border px-4 py-2 text-sm">Close camera</button></dialog>}
    </div>;
}
