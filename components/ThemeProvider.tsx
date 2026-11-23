'use client';

import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { Toaster } from 'sonner';

function ThemeToaster() {
    const { resolvedTheme } = useTheme();

    return <Toaster position="top-center" richColors theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    return (
        <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
            <ThemeToaster />
        </NextThemesProvider>
    );
}
