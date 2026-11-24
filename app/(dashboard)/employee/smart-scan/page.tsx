import type { Metadata } from 'next';
import EmployeeSmartScan from '@/components/employee/EmployeeSmartScan';
import { performSmartScan } from '@/lib/attendance/smart-scan/server';
import './smart-scan.css';
export const metadata: Metadata = { title: 'Smart Scan', robots: { index: false } };
export default async function SmartScanPage() {
    const initial = await performSmartScan({ action: 'config' });
    return <EmployeeSmartScan initial={initial.success && initial.state !== 'ready' ? { success: false, error: 'Could not load scan settings.', code: 'INVALID', status: 503 } : initial} />;
}
