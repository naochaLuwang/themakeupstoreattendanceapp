'use client';
import { useEffect, useRef, useState } from 'react';
import { Flashlight, Pause, Camera } from 'lucide-react';
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
    const [hint, setHint] = useState('Keep the whole code inside the frame.');
    useEffect(() => {
        if (paused || !video.current) return;
        const controller = new AbortController(); let accepted = false;
        const hide = () => { if (document.hidden) { controller.abort(); setPaused(true); setReady(false); } };
        document.addEventListener('visibilitychange', hide);
        setError(null); setReady(false); setTorch(false); setTorchAvailable(false);
        void startAttendanceCamera(video.current, value => {
            if (accepted || controller.signal.aborted) return;
            if (!isAttendanceQr(value)) { setHint('Use the attendance QR on your branch display.'); return; }
            accepted = true; controller.abort(); callback.current(value);
        }, controller.signal).then(session => {
            if (controller.signal.aborted) { session.stop(); return; }
            camera.current = session; setReady(true); setTorchAvailable(session.torchAvailable);
        }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cameraError(cause)); });
        return () => { controller.abort(); camera.current = null; document.removeEventListener('visibilitychange', hide); };
    }, [retry, paused]);
    return <section className="smart-camera" aria-label="Attendance camera">
        <div className="smart-camera-preview"><video ref={video} muted playsInline autoPlay aria-label="Live camera preview" /><div className="smart-camera-frame" aria-hidden="true"><i /><i /><i /><i /></div>
            {(!ready || paused || error) && <div className="smart-camera-overlay"><Camera size={28} aria-hidden="true" /><p>{error ? 'Camera unavailable' : paused ? 'Camera paused' : 'Starting camera…'}</p></div>}
        </div>
        {error ? <div className="smart-camera-error" role="alert"><p>{error}</p><button type="button" onClick={() => setRetry(v => v + 1)}>Try camera again</button></div> : <p className="smart-camera-hint" role="status">{paused ? 'Resume when you’re ready to scan.' : hint}</p>}
        <div className="smart-camera-controls">{paused ? <button type="button" onClick={() => { setPaused(false); setRetry(v => v + 1); }}>Resume camera</button> : <button type="button" onClick={() => { setPaused(true); setReady(false); }}><Pause size={16} />Pause camera</button>}
            {torchAvailable && !paused && !error && <button type="button" aria-pressed={torch} onClick={async () => { try { await camera.current?.setTorch(!torch); setTorch(v => !v); } catch { setHint('The torch is unavailable on this camera.'); } }}><Flashlight size={16} />{torch ? 'Torch off' : 'Torch on'}</button>}
        </div>
    </section>;
}
