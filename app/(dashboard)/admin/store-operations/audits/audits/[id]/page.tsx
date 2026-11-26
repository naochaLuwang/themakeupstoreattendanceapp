import { redirect } from 'next/navigation';
export default async function LegacyAudit({params}:{params:Promise<{id:string}>}){const{id}=await params;redirect(`/admin/store-operations/audits/${id}`);}
