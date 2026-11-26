import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { runOperationsWorker } from '@/lib/store-ops/worker';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
    const secret = process.env.STORE_OPERATIONS_WORKER_SECRET;
    const headers = { 'Cache-Control': 'no-store, private' };
    if (!secret || secret.length < 32) return NextResponse.json({ error: 'Operations worker is not configured.' }, { status: 503, headers });
    const hash = (value: string) => createHash('sha256').update(value).digest();
    if (!timingSafeEqual(hash(request.headers.get('authorization') || ''), hash(`Bearer ${secret}`))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
    try { return NextResponse.json({ success: true, data: await runOperationsWorker() }, { headers }); }
    catch { return NextResponse.json({ error: 'Operations worker processing could not be confirmed.' }, { status: 503, headers }); }
}
