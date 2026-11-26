export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 5;

export function mediaPath(url: string): string | null {
    try {
        const parsed = new URL(url, 'https://workspace.invalid');
        const path = parsed.pathname === '/api/store-ops/media' ? parsed.searchParams.get('path') :
            parsed.pathname.split('/store-images/')[1];
        if (!path || path.includes('..') || path.startsWith('/') || !/^[a-zA-Z0-9_./-]+$/.test(path)) return null;
        return path;
    } catch { return null; }
}

export function mediaUrl(url: string, thumbnail = false): string {
    const path = mediaPath(url);
    if (!path) return url.startsWith('data:image/') || url.startsWith('blob:') ? url : '';
    return `/api/store-ops/media?path=${encodeURIComponent(path)}${thumbnail ? '&thumbnail=1' : ''}`;
}
