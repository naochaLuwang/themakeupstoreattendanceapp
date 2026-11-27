import { Check, CircleAlert, Loader2, MapPin, ScanLine, ShieldCheck } from 'lucide-react';
import type { ScanStep } from '@/lib/attendance/smart-scan/progress';

const icons = { scan: ScanLine, location: MapPin, attendance: ShieldCheck };
export default function SmartScanProgress({ steps, compact = false }: { steps: ScanStep[]; compact?: boolean }) {
    return <ol className={`smart-progress${compact ? ' smart-progress-compact' : ''}`} aria-label="Attendance progress">
        {steps.map(step => {
            const Icon = step.state === 'complete' ? Check : step.state === 'error' ? CircleAlert : step.state === 'current' && step.id !== 'scan' ? Loader2 : icons[step.id];
            const status = step.state === 'complete' ? 'Complete' : step.state === 'error' ? 'Needs attention' : step.state === 'confirm' ? 'Your confirmation needed' : step.state === 'current' ? 'In progress' : 'Waiting';
            return <li key={step.id} data-state={step.state} aria-current={step.state === 'current' || step.state === 'confirm' || step.state === 'error' ? 'step' : undefined}>
                <span className="smart-progress-marker"><Icon size={18} strokeWidth={1.8} className={Icon === Loader2 ? 'smart-progress-spinner' : undefined} aria-hidden="true" /></span>
                <span className="smart-progress-label">{compact ? step.id === 'scan' ? 'Scan' : step.id === 'location' ? 'Location' : step.state === 'confirm' ? 'Confirm' : 'Attendance' : step.label}<span className="sr-only"> · {status}</span></span>
            </li>;
        })}
    </ol>;
}
