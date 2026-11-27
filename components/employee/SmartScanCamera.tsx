'use client';
import { useEffect, useRef, useState } from 'react';
import { Flashlight, Pause, Play, Camera, RotateCcw } from 'lucide-react';
import { cameraError, startAttendanceCamera, type CameraSession } from '@/lib/attendance/smart-scan/camera';
import { isAttendanceQr } from '@/lib/attendance/smart-scan/validation';

export default function SmartScanCamera({ onScan }: { onScan: (value: string) => void }) {
    const video = useRef<HTMLVideoElement>(null);
    const camera = useRef<CameraSession | null>(null);
    const callback = useRef(onScan);
    useEffect(() => { callback.current = onScan; }, [onScan]);
    const [retry, setRetry] = useState(0);
    const [paused, setPaused] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [torchAvailable, setTorchAvailable] = useState(false);
    const [torch, setTorch] = useState(false);
    const [hint, setHint] = useState('Align the store QR');
    useEffect(() => {
        if (paused || !video.current) return;
        const controller = new AbortController(); let accepted = false;
        const hide = () => { if (document.hidden) { controller.abort(); setPaused(true); setReady(false); } };
        document.addEventListener('visibilitychange', hide);
        setError(null); setReady(false); setTorch(false); setTorchAvailable(false); setHint('Align the store QR');
        void startAttendanceCamera(video.current, value => {
            if (accepted || controller.signal.aborted) return;
            if (!isAttendanceQr(value)) { setHint('Use the store attendance QR'); return; }
            accepted = true; controller.abort(); callback.current(value);
        }, controller.signal).then(session => {
            if (controller.signal.aborted) { session.stop(); return; }
            camera.current = session; setReady(true); setTorchAvailable(session.torchAvailable);
        }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cameraError(cause)); });
        return () => { controller.abort(); camera.current = null; document.removeEventListener('visibilitychange', hide); };
    }, [retry, paused]);
    return <section className="smart-camera" aria-label="Attendance camera">
        <div className="smart-camera-preview" data-ready={ready && !paused && !error}><video ref={video} muted playsInline autoPlay aria-label="Live camera preview" /><div className="smart-camera-frame" aria-hidden="true"><i /><i /><i /><i /></div>
            {(!ready || paused || error) && <div className="smart-camera-overlay"><Camera size={28} strokeWidth={1.5} aria-hidden="true" /><p>{error ? 'Camera unavailable' : paused ? 'Camera paused' : 'Opening camera'}</p></div>}
        </div>
        {error ? <div className="smart-camera-error" role="alert"><p>{error}</p><button type="button" className="smart-secondary" onClick={() => setRetry(v => v + 1)}><RotateCcw size={16} aria-hidden="true" />Retry camera</button></div>
            : <div className="smart-camera-toolbar"><p className="smart-camera-hint" role="status">{paused ? 'Resume to scan' : hint}</p>
                <div className="smart-camera-controls">
                    {torchAvailable && !paused && <button type="button" aria-pressed={torch} aria-label={torch ? 'Turn torch off' : 'Turn torch on'} title={torch ? 'Turn torch off' : 'Turn torch on'} onClick={async () => { try { await camera.current?.setTorch(!torch); setTorch(v => !v); } catch { setHint('Torch unavailable'); } }}><Flashlight size={18} aria-hidden="true" /></button>}
                    <button type="button" aria-label={paused ? 'Resume camera' : 'Pause camera'} title={paused ? 'Resume camera' : 'Pause camera'} onClick={() => { if (paused) { setPaused(false); setRetry(v => v + 1); } else { setPaused(true); setReady(false); } }}>{paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}</button>
                </div>
            </div>}
    </section>;
}
