'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // The saved preference is only available in the browser after hydration.
    useEffect(() => setMounted(true), []);

    const isDark = mounted && resolvedTheme === 'dark';
    const label = mounted ? `Switch to ${isDark ? 'light' : 'dark'} theme` : 'Change color theme';

    return (
        <button type="button" className="theme-toggle" disabled={!mounted}
            aria-label={label} title={label}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}>
            {isDark ? <Sun size={18} strokeWidth={1.5} aria-hidden="true" /> : <Moon size={18} strokeWidth={1.5} aria-hidden="true" />}
        </button>
    );
}
