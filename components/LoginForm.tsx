'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { CircleAlert, Eye, EyeOff, Loader2 } from 'lucide-react';
import styles from './auth/login.module.css';

type LoginResponse = {
    success?: unknown;
    error?: unknown;
};

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryError = searchParams.get('error');
    const [isPending, setIsPending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [localError, setLocalError] = useState<string | null>(null);

    const handleLoginSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isPending) return;

        const formData = new FormData(event.currentTarget);
        setIsPending(true);
        setLocalError(null);

        if (typeof window !== 'undefined' && window.navigator.vibrate) {
            window.navigator.vibrate(15);
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                body: formData,
            });
            const body: unknown = await response.json();
            const result: LoginResponse | null = typeof body === 'object' && body !== null ? body : null;

            if (response.ok && result?.success === true) {
                router.push('/');
                router.refresh();
                return;
            }

            setLocalError(typeof result?.error === 'string' ? result.error : 'Unable to sign in. Please try again.');
            setIsPending(false);
        } catch {
            setLocalError('Unable to connect. Check your connection and try again.');
            setIsPending(false);
        }
    };

    const errorMessage = localError || queryError;

    return (
        <form onSubmit={handleLoginSubmit} className={styles.form} aria-busy={isPending}>
            <div className={styles.field}>
                <label htmlFor="login-username">Username</label>
                <div className={styles.inputWrap}>
                    <input
                        id="login-username"
                        name="username"
                        type="text"
                        placeholder="Enter your username"
                        required
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        disabled={isPending}
                        aria-describedby={errorMessage ? 'login-error' : undefined}
                        className={styles.input}
                    />
                </div>
            </div>

            <div className={styles.field}>
                <label htmlFor="login-password">Password</label>
                <div className={styles.inputWrap}>
                    <input
                        id="login-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        required
                        autoComplete="current-password"
                        disabled={isPending}
                        aria-describedby={errorMessage ? 'login-error' : undefined}
                        className={styles.input + ' ' + styles.passwordInput}
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(visible => !visible)}
                        className={styles.passwordToggle}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        aria-pressed={showPassword}
                        aria-controls="login-password"
                        disabled={isPending}
                    >
                        {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
                    </button>
                </div>
            </div>

            {errorMessage && (
                <div className={styles.error} id="login-error" role="alert">
                    <CircleAlert size={18} aria-hidden="true" />
                    <p>{errorMessage}</p>
                </div>
            )}

            <button disabled={isPending} type="submit" className={styles.submit}>
                {isPending && <Loader2 className={styles.spinner} size={18} aria-hidden="true" />}
                <span aria-live="polite">{isPending ? 'Signing in…' : 'Sign in'}</span>
            </button>
        </form>
    );
}
