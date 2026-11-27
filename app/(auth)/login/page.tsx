import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';
import ThemeToggle from '@/components/ThemeToggle';
import AppBrand from '@/components/AppBrand';
import AppInformationLinks from '@/components/AppInformationLinks';
import { WORKSPACE_NAME } from '@/lib/branding';
import styles from '@/components/auth/login.module.css';

const displayFont = localFont({
    src: '../../../public/fonts/barlow-condensed/BarlowCondensed-SemiBold.ttf',
    variable: '--font-login-display',
    display: 'swap',
    weight: '600',
});

export const metadata: Metadata = {
    title: 'Sign in',
    description: `Sign in to ${WORKSPACE_NAME} for attendance, shifts, and store operations.`,
};

export default function LoginPage() {
    return (
        <div className={styles.page + ' ' + displayFont.variable}>
            <header className={styles.header}>
                <AppBrand />
                <p>Staff workspace</p>
                <ThemeToggle />
            </header>

            <div className={styles.poster}>
                <p className={styles.masthead}>THE MAKEUP</p>
                <p className={styles.store}>STORE<span className={styles.hrm}> HRM</span></p>

                <div className={styles.caption}>
                    <p>Attendance, people<br />and store operations</p>
                    <span>Your team workspace at THE MAKEUP STORE</span>
                </div>

                <section className={styles.signInPanel} aria-labelledby="login-title">
                    <header className={styles.formHeader}>
                        <h1 id="login-title">Staff sign in</h1>
                        <p>Use your staff username and password.</p>
                    </header>

                    <Suspense fallback={
                        <div className={styles.skeleton} role="status" aria-label="Loading sign-in form">
                            <div className={styles.skeletonField} />
                            <div className={styles.skeletonField} />
                            <div className={styles.skeletonButton} />
                        </div>
                    }>
                        <LoginForm />
                    </Suspense>

                    <p className={styles.help}>
                        Need access or a password reset?<br />
                        Your manager can help.
                    </p>
                    <AppInformationLinks />
                </section>
            </div>
        </div>
    );
}
