'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface WorkspaceDialogProps {
    open: boolean;
    onClose: () => void;
    labelledBy: string;
    children: ReactNode;
}

export default function WorkspaceDialog({ open, onClose, labelledBy, children }: WorkspaceDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
        if (!open) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, [open]);

    return (
        <dialog ref={dialogRef} aria-labelledby={labelledBy} className="workspace-dialog"
            onCancel={onClose} onClose={onClose}
            onClick={event => { if (event.target === event.currentTarget) onClose(); }}
            onKeyDown={event => {
                if (event.key !== 'Tab') return;
                const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]'));
                const first = controls[0];
                const last = controls[controls.length - 1];
                if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
            }}>
            <div className="workspace-dialog-panel">{children}</div>
        </dialog>
    );
}
