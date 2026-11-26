'use client';

/** Transport failures must release the caller's busy state like action errors. */
export async function runOperation<T>(action: () => Promise<T>): Promise<T | { error:string; success?:false; data?:undefined; completed?:undefined; url?:undefined }> {
    try { return await action(); }
    catch { return {error:'The request could not be confirmed. Check your connection, refresh the record, and retry.'}; }
}
