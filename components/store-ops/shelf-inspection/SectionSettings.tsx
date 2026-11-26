'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createStoreSection, updateStoreSection, deleteStoreSection } from '@/app/actions/store-ops/shelf-inspection';

export default function SectionSettings({ stores, sections, canDelete = false }: { stores: { id: string; name: string }[]; sections: { id: string; name: string; description: string | null; store_id: string | null }[]; canDelete?:boolean }) {
    const router = useRouter();
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return <div className="space-y-6"><div><h1 className="text-2xl font-medium">Store Operations settings</h1><p className="mt-2 text-sm text-slate-500">Configure the sections employees inspect.</p></div>
        <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2" onSubmit={async event => {
            event.preventDefault(); if (pending) return;
            const element = event.currentTarget; const form = new FormData(element);
            setPending(true); setError(null);
            try { const result = await createStoreSection(String(form.get('name') || ''), String(form.get('description') || ''), String(form.get('store_id') || '')); if (result.error) setError(result.error); else { element.reset(); router.refresh(); } }
            catch { setError('Section could not be saved.'); } finally { setPending(false); }
        }}>
            <label className="text-sm">Store<select name="store_id" required className="mt-1 w-full rounded border bg-transparent p-3"><option value="">Choose a store</option>{stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
            <label className="text-sm">Section name<input name="name" required maxLength={120} className="mt-1 w-full rounded border bg-transparent p-3" /></label>
            <label className="text-sm sm:col-span-2">Description<input name="description" maxLength={500} className="mt-1 w-full rounded border bg-transparent p-3" /></label>
            {error && <p role="alert" className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
            <button disabled={pending} className="rounded-lg border px-4 py-3 text-sm sm:col-span-2">{pending ? 'Saving…' : 'Add section'}</button>
        </form>
        <ul className="divide-y rounded-xl border">{sections.length ? sections.map(section => <li key={section.id} className="p-4"><strong className="font-medium">{section.name}</strong><p className="mt-1 text-sm text-slate-500">{stores.find(store => store.id === section.store_id)?.name || 'Unassigned legacy store'}{section.description ? ` · ${section.description}` : ''}</p><details className="mt-3"><summary className="cursor-pointer text-sm">Edit section</summary><form className="mt-3 space-y-3" onSubmit={async event=>{
            event.preventDefault();setPending(true);setError(null);const data=new FormData(event.currentTarget);
            try{const result=await updateStoreSection(section.id,String(data.get('name')||''),String(data.get('description')||''));if(result.error)setError(result.error);else router.refresh();}catch{setError('Section could not be updated.');}finally{setPending(false);}
        }}><label className="block text-sm">Name<input name="name" defaultValue={section.name} required maxLength={120} className="mt-1 w-full rounded border bg-transparent p-2"/></label><label className="block text-sm">Description<input name="description" defaultValue={section.description||''} maxLength={500} className="mt-1 w-full rounded border bg-transparent p-2"/></label><div className="flex gap-3"><button disabled={pending} className="rounded border px-3 py-2 text-sm">Save changes</button>{canDelete&&<button type="button" disabled={pending} className="rounded border px-3 py-2 text-sm" onClick={async()=>{
            if(!confirm('Delete this unused section? Sections with inspection history are retained.'))return;setPending(true);setError(null);
            try{const result=await deleteStoreSection(section.id);if(result.error)setError(result.error);else router.refresh();}catch{setError('Section could not be deleted.');}finally{setPending(false);}
        }}>Delete section</button>}</div></form></details></li>) : <li className="p-4 text-sm">No sections yet.</li>}</ul>
    </div>;
}
