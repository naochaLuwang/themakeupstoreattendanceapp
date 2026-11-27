import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_PUBLIC_ORIGIN, APP_SUPPORT_EMAIL, POLICY_UPDATED_DATE, supportEmailHref } from '@/lib/app-information';

export const metadata: Metadata = {
    title: 'Terms of use',
    description: 'Use of THE MAKEUP STORE HRM by authorized staff at Wangkhei.',
    alternates: { canonical: `${APP_PUBLIC_ORIGIN}/terms` },
};

export default function TermsPage() {
    return <article>
        <h1>Terms of use</h1>
        <time dateTime={POLICY_UPDATED_DATE}>Effective 27 November 2026</time>
        <p>THE MAKEUP STORE HRM is provided for authorized employees, managers and administrators of THE MAKEUP STORE, Wangkhei, to manage attendance, shifts and daily store work.</p>
        <h2>Staff accounts</h2>
        <p>Use only the account issued to you. Keep your password private, do not share access, and tell the store administrator if your phone or credentials may have been compromised. Access may be changed when your duties or employment change.</p>
        <h2>Accurate records</h2>
        <p>Submit truthful attendance and work reports. Do not check in for another person, reuse unauthorized QR codes, spoof location or attempt to bypass permissions. Report mistakes to a manager for an authorized correction.</p>
        <h2>Photos and reports</h2>
        <p>Only upload material needed for store work. Avoid capturing customers, coworkers, identification documents or unrelated personal details unless necessary and authorized. Do not upload content you have no right to share.</p>
        <h2>Availability and employment decisions</h2>
        <p>An internet connection is required to save server records. An interrupted request or delayed notification is not proof that attendance was saved or missed. Check the confirmed record and contact your manager about errors. The app does not replace your employment agreement, applicable law or required managerial review.</p>
        <h2>Privacy and help</h2>
        <p>Our <Link href="/privacy">privacy policy</Link> explains how work information is handled. Contact <a href={supportEmailHref('HRM terms or access enquiry')}>{APP_SUPPORT_EMAIL}</a> for app support, or use the <Link href="/account-deletion">account and data request page</Link>.</p>
    </article>;
}
