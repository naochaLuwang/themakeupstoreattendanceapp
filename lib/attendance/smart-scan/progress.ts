import type { SmartOutcome, SmartScanPhase, SmartScanStage } from './types';

export type ScanStepState = 'waiting' | 'current' | 'complete' | 'error' | 'confirm';
export type ScanStep = { id: SmartScanPhase; label: string; state: ScanStepState };

/** Reflect real client/server milestones. QR capture alone never means attendance is saved. */
export function scanProgress(stage: SmartScanStage, phase: SmartScanPhase, outcome: SmartOutcome | null, expired = false): ScanStep[] {
    const saved = stage === 'success' && outcome !== null && outcome.state !== 'confirmation_required';
    const current = saved ? 3 : stage === 'scanning' ? 0 : stage === 'locating' ? 1 : stage === 'confirming' || stage === 'submitting' ? 2 : ['scan', 'location', 'attendance'].indexOf(phase);
    const ids: SmartScanPhase[] = ['scan', 'location', 'attendance'];
    return ids.map((id, index) => {
        let state: ScanStepState = index < current ? 'complete' : index === current ? 'current' : 'waiting';
        if (index === current && stage === 'error') state = 'error';
        if (index === 2 && stage === 'confirming') state = expired ? 'error' : 'confirm';
        const label = id === 'scan' ? state === 'complete' ? 'QR captured' : 'Scan code'
            : id === 'location' ? state === 'complete' ? 'Location checked' : state === 'error' ? 'Check your location' : state === 'current' ? 'Checking location' : 'Check location'
            : state === 'complete' ? outcome?.replayed ? 'Attendance on record' : 'Attendance saved'
            : stage === 'confirming' ? expired ? 'Confirmation expired' : 'Confirm clock out'
            : state === 'error' ? 'Attendance not confirmed' : state === 'current' ? 'Verifying attendance' : 'Save attendance';
        return { id, state, label };
    });
}
