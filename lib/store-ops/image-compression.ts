import { MAX_IMAGE_BYTES } from './media';

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('This photo could not be processed.')), 'image/jpeg', quality));
}

export async function prepareImage(file: File): Promise<{ file: File; thumbnail: File }> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG, or WebP photo.');
    if (file.size > 25 * 1024 * 1024) throw new Error('Choose a photo smaller than 25 MB.');
    const bitmap = await createImageBitmap(file);
    try {
        if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 60_000_000) throw new Error('This photo is too large to process.');
        const canvas = document.createElement('canvas');
        const draw = (max: number) => {
            const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Photo processing is unavailable.');
            context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        };
        draw(1600);
        const compressed = await encode(canvas, 0.82);
        if (compressed.size > MAX_IMAGE_BYTES) throw new Error('Photo is too large. Choose a smaller photo.');
        draw(400);
        const thumbnail = await encode(canvas, 0.7);
        return { file: new File([compressed], 'photo.jpg', { type: 'image/jpeg' }), thumbnail: new File([thumbnail], 'thumbnail.jpg', { type: 'image/jpeg' }) };
    } finally { bitmap.close(); }
}
