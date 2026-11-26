'use client';
import { useState } from 'react';
import { getDamageReturnList } from '@/app/actions/store-ops/damage-reports';
import { downloadCsv } from '@/lib/store-ops/export';

export default function ReturnList() {
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return <div><button disabled={pending} className="rounded-lg border px-4 py-2 text-sm" onClick={async () => {
        setPending(true); setError(null);
        try { const rows = await getDamageReturnList(); downloadCsv('approved-damage-return-list.csv', ['Barcode','Product','Brand','Shade','Batch','MRP','Quantity','Damage type','Value'], rows.map(row => [row.barcode,row.product_name,row.brand,row.shade,row.batch,row.mrp,row.quantity,row.damage_type,(row.mrp || 0) * row.quantity])); }
        catch { setError('The return list could not be generated.'); } finally { setPending(false); }
    }}>{pending ? 'Preparing…' : 'Export approved return list'}</button>{error && <p role="alert" className="text-sm text-rose-600">{error}</p>}</div>;
}
