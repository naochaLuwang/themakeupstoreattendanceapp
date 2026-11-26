'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/lib/supabase/database.types';
import { saveOperationsSettings } from '@/app/actions/store-ops/settings';

export default function OperationsTimingSettings({stores,settings}:{stores:{id:string;name:string|null}[];settings:Database['public']['Tables']['store_operations_settings']['Row'][]}) {
    const router=useRouter();const [store,setStore]=useState(stores[0]?.id||'');const [error,setError]=useState<string|null>(null);const [pending,setPending]=useState(false);const current=settings.find(item=>item.store_id===store);
    return <section className="space-y-4"><h2 className="text-lg font-medium">Scheduled operations alerts</h2><p className="text-sm text-slate-500">Set deadlines in Asia/Kolkata. Scheduled alerts require the operations worker.</p><label className="block text-sm">Store<select value={store} onChange={event=>setStore(event.target.value)} className="mt-1 w-full rounded border bg-transparent p-3">{stores.map(item=><option key={item.id} value={item.id}>{item.name||'Store'}</option>)}</select></label>
        <form key={`${store}:${current?.updated_at||'new'}`} className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2" onSubmit={async event=>{
            event.preventDefault();setPending(true);setError(null);const form=new FormData(event.currentTarget);
            try{const result=await saveOperationsSettings({store_id:store,enabled:form.get('enabled')==='on',opening_due:String(form.get('opening_due')),closing_due:String(form.get('closing_due')),audit_due_days:Number(form.get('audit_due_days')),tester_notice_days:Number(form.get('tester_notice_days')),expected_updated_at:current?.updated_at||null});if(result.error)setError(result.error);else router.refresh();}catch{setError('Alert settings could not be saved.');}finally{setPending(false);}
        }}><label className="flex gap-2 text-sm sm:col-span-2"><input name="enabled" type="checkbox" defaultChecked={current?.enabled??true}/>Enable scheduled alerts</label>
            <label className="text-sm">Opening deadline<input required name="opening_due" type="time" defaultValue={current?.opening_due.slice(0,5)||'10:00'} className="mt-1 w-full rounded border bg-transparent p-3"/></label><label className="text-sm">Closing deadline<input required name="closing_due" type="time" defaultValue={current?.closing_due.slice(0,5)||'21:00'} className="mt-1 w-full rounded border bg-transparent p-3"/></label><label className="text-sm">Days between audits<input required name="audit_due_days" type="number" min={1} max={365} defaultValue={current?.audit_due_days||7} className="mt-1 w-full rounded border bg-transparent p-3"/></label><label className="text-sm">Tester expiry warning (days)<input required name="tester_notice_days" type="number" min={1} max={90} defaultValue={current?.tester_notice_days||7} className="mt-1 w-full rounded border bg-transparent p-3"/></label>{error&&<p role="alert" className="text-sm text-rose-600 sm:col-span-2">{error}</p>}<button disabled={pending||!store} className="rounded-lg border px-4 py-2 text-sm sm:col-span-2">{pending?'Saving…':'Save alert settings'}</button>
        </form>
    </section>;
}
