import { NextRequest, NextResponse } from 'next/server';
import { operationsContext } from '@/lib/store-ops/context';
import { mediaPath } from '@/lib/store-ops/media';

export async function GET(request: NextRequest) {
    try {
        const path = mediaPath(request.url);
        if (!path) return new NextResponse('Invalid photo path', { status: 400 });
        const { supabase } = await operationsContext();
        let target = path;
        if (request.nextUrl.searchParams.has('thumbnail') && path.endsWith('.jpg')) target = path.replace(/\.jpg$/, '.thumb.jpg');
        let result = await supabase.storage.from('store-images').createSignedUrl(target, 60);
        if (result.error && target !== path) result = await supabase.storage.from('store-images').createSignedUrl(path, 60);
        if (result.error || !result.data) return new NextResponse('Photo unavailable', { status: 404 });
        return NextResponse.redirect(result.data.signedUrl, { headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
    } catch { return new NextResponse('Sign in to view photos', { status: 401 }); }
}
