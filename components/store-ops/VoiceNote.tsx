'use client';
import { useState } from 'react';
import { uploadIncidentVoice } from '@/app/actions/store-ops/incidents';
import { mediaUrl } from '@/lib/store-ops/media';

export default function VoiceNote({ value, onChange }: { value: string; onChange: (url: string) => void }) {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return <div className="space-y-2"><label className="block text-sm font-medium">Voice note<input type="file" accept="audio/webm,audio/ogg,audio/mp4,audio/mpeg,audio/wav" capture="user" disabled={pending} className="mt-2 block w-full text-sm" onChange={async event => {
        const file = event.target.files?.[0]; if (!file) return;
        setPending(true); setError(null);
        try { const form = new FormData(); form.append('file', file); const result = await uploadIncidentVoice(form); if (result.error || !result.url) setError(result.error || 'Voice note could not be uploaded.'); else onChange(result.url); }
        catch { setError('Voice note upload failed. Please retry.'); } finally { setPending(false); }
    }} /></label><p className="text-xs text-slate-500">Attach a recording from your phone. Up to 5 MB.</p>{pending && <p role="status">Uploading voice note…</p>}{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}{value && <div><audio controls src={mediaUrl(value)} className="max-w-full" /><button type="button" onClick={() => onChange('')} className="mt-2 rounded border px-3 py-2 text-sm">Remove recording from draft</button></div>}</div>;
}
