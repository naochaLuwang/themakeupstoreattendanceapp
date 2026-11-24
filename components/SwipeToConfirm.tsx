'use client';

import { useId, useRef, useState, type PointerEvent } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import styles from './SwipeToConfirm.module.css';
import { nativeFeedback } from '@/lib/native/experience';

type SwipeToConfirmProps = {
    label: string;
    busyLabel?: string;
    disabled?: boolean;
    busy?: boolean;
    variant?: 'start' | 'end';
    onConfirm: () => Promise<void>;
};

export default function SwipeToConfirm({ label, busyLabel = 'Saving attendance…', disabled = false, busy = false, variant = 'start', onConfirm }: SwipeToConfirmProps) {
    const helpId = useId();
    const trackRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{ pointerId: number; startX: number; distance: number; max: number; armed: boolean } | null>(null);
    const confirmingRef = useRef(false);
    const [offset, setOffset] = useState(0);
    const [confirming, setConfirming] = useState(false);
    const blocked = disabled || busy || confirming;

    async function confirm() {
        if (disabled || busy || confirmingRef.current) return;
        confirmingRef.current = true;
        setConfirming(true);
        nativeFeedback('impact');
        try {
            await onConfirm();
        } finally {
            confirmingRef.current = false;
            setConfirming(false);
            setOffset(0);
        }
    }

    function cancelDrag() {
        dragRef.current = null;
        setOffset(0);
    }

    function startDrag(event: PointerEvent<HTMLButtonElement>) {
        if (blocked || !event.isPrimary || event.button !== 0 || !trackRef.current) return;
        const max = trackRef.current.clientWidth - event.currentTarget.offsetWidth - 12;
        if (max <= 0) return;
        dragRef.current = { pointerId: event.pointerId, startX: event.clientX, distance: 0, max, armed: false };
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function moveDrag(event: PointerEvent<HTMLButtonElement>) {
        const drag = dragRef.current;
        if (!drag || event.pointerId !== drag.pointerId) return;
        drag.distance = Math.max(0, Math.min(drag.max, event.clientX - drag.startX));
        const armed = drag.distance >= drag.max * 0.9;
        if (armed && !drag.armed) nativeFeedback('selection');
        drag.armed = armed;
        setOffset(drag.distance);
    }

    function finishDrag(event: PointerEvent<HTMLButtonElement>) {
        const drag = dragRef.current;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const complete = drag.distance >= drag.max * 0.9;
        dragRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        if (complete) void confirm();
        else setOffset(0);
    }

    return (
        <div className={styles.control} data-native-feedback="explicit">
            <div ref={trackRef} className={styles.track} data-variant={variant} data-busy={busy || confirming} aria-busy={busy || confirming}>
                <span className={styles.label} style={{ opacity: offset > 0 ? 0.35 : 1 }} aria-hidden="true">
                    {busy || confirming ? busyLabel : label}
                </span>
                <button type="button" className={styles.handle} disabled={blocked}
                    aria-label={label} aria-describedby={helpId}
                    style={{ transform: `translateX(${offset}px)` }}
                    onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}
                    onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
                    onClick={event => { if (event.detail === 0) void confirm(); }}>
                    {busy || confirming ? <Loader2 size={22} className={styles.spinner} aria-hidden="true" /> : <ArrowRight size={24} aria-hidden="true" />}
                </button>
            </div>
            <p id={helpId} className={styles.help}>
                Drag the arrow all the way right and release.
                <span className="sr-only"> With a keyboard or screen reader, activate the arrow to confirm.</span>
            </p>
            <span className="sr-only" role="status">{busy || confirming ? busyLabel : ''}</span>
        </div>
    );
}
