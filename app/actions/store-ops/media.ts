'use server';
import { operationError } from '@/lib/store-ops/context';
import { removeOperationsImages } from '@/lib/store-ops/uploads';

export async function removeDraftImage(url: string) {
    try { await removeOperationsImages([url]); return { error: undefined, success: true }; }
    catch (error) { return operationError(error); }
}
