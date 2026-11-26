import 'server-only';
import { operationsContext, operationError } from './context';
import { MAX_IMAGE_BYTES, mediaPath } from './media';

async function validImage(value: FormDataEntryValue | null): Promise<File> {
    if (!(value instanceof File) || !value.size || value.size > MAX_IMAGE_BYTES) throw new Error('Choose a photo smaller than 5 MB.');
    const bytes = new Uint8Array(await value.slice(0, 12).arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
    if (!(jpeg && value.type === 'image/jpeg') && !(png && value.type === 'image/png') && !(webp && value.type === 'image/webp')) throw new Error('Choose a valid JPEG, PNG, or WebP photo.');
    return value;
}

export async function uploadOperationsImage(form: FormData, module: string) {
    try {
        const { supabase, user } = await operationsContext();
        const file = await validImage(form.get('file'));
        const thumbnailValue = form.get('thumbnail');
        const thumbnail = thumbnailValue ? await validImage(thumbnailValue) : null;
        const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
        const path = `${module}/${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('store-images').upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error('Photo upload failed. Please retry.');
        if (thumbnail) {
            const thumbPath = path.replace(/\.[^.]+$/, '.thumb.jpg');
            const { error: thumbError } = await supabase.storage.from('store-images').upload(thumbPath, thumbnail, { contentType: thumbnail.type, upsert: false });
            if (thumbError) { await supabase.storage.from('store-images').remove([path]); throw new Error('Photo preview upload failed. Please retry.'); }
        }
        return { error: undefined, success: true, url: `/api/store-ops/media?path=${path}` };
    } catch (error) { return operationError(error); }
}

export async function removeOperationsImages(urls: string[]) {
    const { supabase } = await operationsContext();
    const paths = urls.flatMap(url => {
        const path = mediaPath(url);
        return path ? [path, path.replace(/\.[^.]+$/, '.thumb.jpg')] : [];
    });
    if (!paths.length) return;
    const { error } = await supabase.storage.from('store-images').remove([...new Set(paths)]);
    if (error) throw new Error('Photo cleanup could not finish. Retry removing the photo.');
}
