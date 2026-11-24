export type CameraSession = { stop: () => void; torchAvailable: boolean; setTorch: (on: boolean) => Promise<void> };
export function cameraError(error: unknown): string {
    const name = error instanceof Error ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') return 'Allow camera access in app or browser settings, then try again. Manual attendance is available below.';
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No usable camera was found. Try another device or use manual attendance.';
    if (name === 'NotReadableError') return 'The camera is busy. Close other camera apps and try again.';
    if (name === 'TimeoutError') return 'Camera access took too long. Check its permission and try again.';
    return 'The camera could not start. Try again or use manual attendance.';
}
function requestCamera(signal: AbortSignal): Promise<MediaStream> {
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = () => { settled = true; window.clearTimeout(timer); signal.removeEventListener('abort', abort); };
        const abort = () => { finish(); reject(new DOMException('Camera cancelled.', 'AbortError')); };
        const timer = window.setTimeout(() => { finish(); reject(new DOMException('Camera timed out.', 'TimeoutError')); }, 15000);
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) { abort(); return; }
        let permission: Promise<MediaStream>;
        try { permission = navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }); }
        catch (error: unknown) { finish(); reject(error); return; }
        permission.then(stream => {
            if (settled) { stream.getTracks().forEach(track => track.stop()); return; }
            finish(); resolve(stream);
        }, error => { if (!settled) { finish(); reject(error); } });
    });
}
/** Frames are decoded locally. Stop also disposes a late permission response. */
export async function startAttendanceCamera(video: HTMLVideoElement, onCode: (value: string) => void, signal: AbortSignal): Promise<CameraSession> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
    // Load before requesting a stream so a failed chunk cannot orphan a camera.
    const decoder = await import('@zxing/browser');
    const stream = await requestCamera(signal);
    let controls: { stop: () => void } | undefined;
    let stopped = false;
    const stop = () => {
        if (stopped) return;
        stopped = true; controls?.stop(); stream.getTracks().forEach(track => track.stop());
        video.pause(); video.srcObject = null; signal.removeEventListener('abort', stop);
    };
    signal.addEventListener('abort', stop, { once: true });
    if (signal.aborted) { stop(); throw new DOMException('Camera cancelled.', 'AbortError'); }
    try {
        const reader = new decoder.BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 200, delayBetweenScanSuccess: 500 });
        controls = await reader.decodeFromStream(stream, video, result => { if (result && !stopped && !signal.aborted) onCode(result.getText()); });
        if (signal.aborted) { controls.stop(); stop(); throw new DOMException('Camera cancelled.', 'AbortError'); }
        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
        return { stop, torchAvailable: Boolean(capabilities?.torch), setTorch: async on => { if (!stopped && track && capabilities?.torch) await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] }); } };
    } catch (error: unknown) { stop(); throw error; }
}
