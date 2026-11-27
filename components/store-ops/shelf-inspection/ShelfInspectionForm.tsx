'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { shelfSchema } from '@/lib/store-ops/validation';
import { INSPECTION_STATUSES } from '@/lib/store-ops/constants';
import { useFormDraft } from '@/lib/store-ops/use-form-draft';
import { createShelfInspection, updateShelfInspection, uploadInspectionImage, getStoreSections } from '@/app/actions/store-ops/shelf-inspection';
import ImageUpload from '@/components/store-ops/ImageUpload';

interface Props { initialData?: { id: string; section_id: string; status: string; notes: string | null; inspection_images?: { url: string }[] } }
type Values = z.infer<typeof shelfSchema>;

export default function ShelfInspectionForm({ initialData }: Props) {
    const router = useRouter();
    const [sections, setSections] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const form = useForm<Values>({ resolver: zodResolver(shelfSchema), defaultValues: {
        section_id: initialData?.section_id || '', status: INSPECTION_STATUSES.find(status => status === initialData?.status) || 'good',
        notes: initialData?.notes || '', image_urls: initialData?.inspection_images?.map(image => image.url) || [],
    } });
    const clearDraft = useFormDraft(form, `shelf:${initialData?.id || 'new'}`);
    useEffect(() => {
        let active = true;
        void getStoreSections().then(result => { if (!active) return; if (result.error) setError(result.error); setSections(result.data || []); setLoading(false); }).catch(() => { if (active) { setError('Sections could not be loaded. Refresh to retry.'); setLoading(false); } });
        return () => { active = false; };
    }, []);
    const save = form.handleSubmit(async values => {
        setError(null);
        try {
            const result = initialData ? await updateShelfInspection(initialData.id, values) : await createShelfInspection(values);
            if (result.error) { setError(result.error); return; }
            clearDraft(); toast.success(initialData ? 'Inspection updated' : 'Inspection submitted'); router.back(); router.refresh();
        } catch { setError('Could not save the inspection. Your draft is kept.'); }
    });
    const fieldClass = 'mt-1 w-full rounded-lg border bg-white p-3 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
    return <form onSubmit={save} className="ops-form space-y-6" aria-busy={form.formState.isSubmitting}>
        <div><h1 className="text-2xl font-medium">{initialData ? 'Edit shelf inspection' : 'New shelf inspection'}</h1><p className="mt-1 text-sm text-slate-500">Record the shelf condition. Your draft saves on this device.</p></div>
        {error && <p role="alert" className="rounded-lg border border-rose-300 p-3 text-sm text-rose-700">{error}</p>}
        <div><label htmlFor="shelf-section" className="text-sm font-medium">Section</label><select id="shelf-section" {...form.register('section_id')} disabled={loading} className={fieldClass} aria-invalid={!!form.formState.errors.section_id}>
            <option value="">{loading ? 'Loading sections…' : 'Choose a section'}</option>{sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}
        </select>{form.formState.errors.section_id && <p role="alert" className="text-sm text-rose-600">Choose a section.</p>}
        {!loading && !sections.length && <p className="mt-2 text-sm">No sections are configured for your store. Ask your manager to add them in <Link href="/admin/store-operations/settings" className="underline">Store Operations settings</Link>.</p>}</div>
        <div><label htmlFor="shelf-status" className="text-sm font-medium">Condition</label><select id="shelf-status" {...form.register('status')} className={fieldClass}>{INSPECTION_STATUSES.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></div>
        <div><label htmlFor="shelf-notes" className="text-sm font-medium">Notes</label><textarea id="shelf-notes" {...form.register('notes')} rows={4} maxLength={5000} className={fieldClass} />{form.formState.errors.notes && <p role="alert">{form.formState.errors.notes.message}</p>}</div>
        <ImageUpload images={form.watch('image_urls') || []} onChange={urls => form.setValue('image_urls', urls, { shouldDirty: true, shouldValidate: true })} uploadAction={uploadInspectionImage} />
        <div className="flex gap-3"><button type="submit" disabled={loading || !sections.length || form.formState.isSubmitting} className="rounded-lg bg-slate-900 px-5 py-3 text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">{form.formState.isSubmitting ? 'Saving…' : 'Save inspection'}</button><button type="button" onClick={() => router.back()} className="rounded-lg border px-5 py-3">Cancel</button></div>
    </form>;
}
