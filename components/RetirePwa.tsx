'use client';
import { useEffect } from 'react';
import { retirePwa } from '@/lib/browser/retire-pwa';

/** Temporary compatibility cleanup for previously installed versions. */
export default function RetirePwa() {
    useEffect(() => { void retirePwa(); }, []);
    return null;
}
