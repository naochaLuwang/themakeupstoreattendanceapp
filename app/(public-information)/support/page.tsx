import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_PUBLIC_ORIGIN, APP_SUPPORT_EMAIL, supportEmailHref } from '@/lib/app-information';

export const metadata: Metadata = {
    title: 'Support',
    description: 'Employee support for THE MAKEUP STORE HRM, Wangkhei.',
    alternates: { canonical: `${APP_PUBLIC_ORIGIN}/support` },
};

export default function SupportPage() {
    return <article>
        <h1>Employee support</h1>
        <p>Help with THE MAKEUP STORE HRM for staff at THE MAKEUP STORE, Wangkhei.</p>
        <address>Email: <a href={supportEmailHref('THE MAKEUP STORE HRM support')}>{APP_SUPPORT_EMAIL}</a></address>
        <a className="information-action" href={supportEmailHref('THE MAKEUP STORE HRM support', 'I need help with THE MAKEUP STORE HRM.\n\nStaff username (if known):\nApp or Android version:\nWhat happened:\n')}>Email support</a>
        <h2>Sign-in and account access</h2>
        <p>Only authorized staff can use this app. Your store administrator creates your account and can help with access, password resets and employment details. There is no public employee sign-up.</p>
        <h2>Attendance, pay or leave</h2>
        <p>Report missing attendance, incorrect shifts or pay, and leave questions to your store manager. Include the date and a short explanation. Attendance corrections require authorized review; do not create extra check-ins to fix a record.</p>
        <h2>Camera, location or notifications</h2>
        <p>Check the app permissions in Android Settings. Location verification is used while submitting attendance, not for continuous background tracking. Push notifications require your permission and registration in the app. If a permission or connection problem prevents attendance, tell your manager promptly.</p>
        <h2>What to include</h2>
        <p>Describe the issue and, if useful, include your staff username, app version and a screenshot with other people’s details hidden. Do not email passwords, one-time codes, identity documents or full payroll files. Opening an email link prepares a message in your email app; you choose whether to send it.</p>
        <h2>Privacy and account requests</h2>
        <p>Read our <Link href="/privacy">privacy policy</Link> or <Link href="/account-deletion">request account or data deletion</Link>. Both are available without signing in.</p>
        <p>This support channel is not monitored as an emergency service. For an urgent store incident, contact the responsible manager directly.</p>
    </article>;
}
