import { calculateDistance } from '../geofence';

type StoreLocation = { lat: number; lng: number; radius_meters: number | null };

function locationError(error: unknown): Error {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (code === 1) return new Error('Allow location access for this app in your browser settings, then swipe again.');
    if (code === 3) return new Error('Location timed out. Turn on precise location, move near the store entrance, and swipe again.');
    return new Error('Location is unavailable. Check that location services are on, move near the store entrance, and swipe again.');
}

function requestPosition(options: PositionOptions, signal?: AbortSignal): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(new DOMException('Location request cancelled.', 'AbortError')); return; }
        const abort = () => { window.clearTimeout(deadline); reject(new DOMException('Location request cancelled.', 'AbortError')); };
        // An explicit deadline also covers browsers that leave the permission prompt pending.
        const deadline = window.setTimeout(() => { signal?.removeEventListener('abort', abort); reject({ code: 3 }); }, (options.timeout ?? 20000) + 1000);
        signal?.addEventListener('abort', abort, { once: true });
        try {
            navigator.geolocation.getCurrentPosition(
                position => { window.clearTimeout(deadline); signal?.removeEventListener('abort', abort); resolve(position); },
                error => { window.clearTimeout(deadline); signal?.removeEventListener('abort', abort); reject(error); },
                options,
            );
        } catch (error: unknown) {
            window.clearTimeout(deadline);
            signal?.removeEventListener('abort', abort);
            reject(error);
        }
    });
}

function refinePosition(radius: number, signal?: AbortSignal): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) { reject(new DOMException('Location request cancelled.', 'AbortError')); return; }
        const watch: { id?: number } = {};
        let settled = false;
        let imprecise = false;
        let lastError: unknown = { code: 3 };
        const cleanup = () => {
            settled = true;
            window.clearTimeout(deadline);
            if (watch.id !== undefined) navigator.geolocation.clearWatch(watch.id);
            signal?.removeEventListener('abort', abort);
        };
        const abort = () => { cleanup(); reject(new DOMException('Location request cancelled.', 'AbortError')); };
        const deadline = window.setTimeout(() => {
            cleanup();
            reject(imprecise
                ? new Error(`Location is not precise enough to verify the ${radius}m store area. Turn on precise location, move near the entrance, and swipe again.`)
                : locationError(lastError));
        }, 21000);
        signal?.addEventListener('abort', abort, { once: true });
        try {
            watch.id = navigator.geolocation.watchPosition(position => {
                if (settled) return;
                if (!isAccurate(position, radius)) { imprecise = true; return; }
                cleanup();
                resolve(position);
            }, error => {
                if (settled) return;
                lastError = error;
                if (error.code === 1) { cleanup(); reject(locationError(error)); }
            }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
        } catch (error: unknown) {
            cleanup();
            reject(locationError(error));
        }
        if (settled && watch.id !== undefined) navigator.geolocation.clearWatch(watch.id);
    });
}

function isAccurate(position: GeolocationPosition, radius: number): boolean {
    const { latitude, longitude, accuracy } = position.coords;
    return Number.isFinite(latitude) && Number.isFinite(longitude) && Number.isFinite(accuracy)
        && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180
        && accuracy >= 0 && accuracy <= radius && Date.now() - position.timestamp <= 15000;
}

/** Acquire location only for a confirmed clock-in; never widen the store geofence. */
export async function getClockInLocation(store: StoreLocation, onRefining: () => void, signal?: AbortSignal): Promise<GeolocationPosition> {
    if (!window.isSecureContext || !navigator.geolocation) {
        throw new Error('Location is unavailable in this browser. Open the app over HTTPS in Safari or Chrome.');
    }

    const radius = store.radius_meters && store.radius_meters > 0 ? store.radius_meters : 100;
    try {
        const quick = await requestPosition({ enableHighAccuracy: false, timeout: 4000, maximumAge: 15000 }, signal);
        const distance = calculateDistance(quick.coords.latitude, quick.coords.longitude, store.lat, store.lng);
        if (isAccurate(quick, radius) && distance <= radius) return quick;
    } catch (error: unknown) {
        if (signal?.aborted) throw error;
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 1) {
            throw locationError(error);
        }
    }

    onRefining();
    return refinePosition(radius, signal);
}
