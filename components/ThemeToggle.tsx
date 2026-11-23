'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // The saved preference is only available in the browser after hydration.
    useEffect(() => setMounted(true), []);

    return (
        <div className="theme-toggle" role="group" aria-label="Color theme">
            <button type="button" onClick={() => setTheme('light')}
                aria-pressed={mounted && resolvedTheme === 'light'} disabled={!mounted}>
                <Sun size={16} aria-hidden="true" /> Light
            </button>
            <button type="button" onClick={() => setTheme('dark')}
                aria-pressed={mounted && resolvedTheme === 'dark'} disabled={!mounted}>
                <Moon size={16} aria-hidden="true" /> Dark
            </button>
        </div>
    );
}
