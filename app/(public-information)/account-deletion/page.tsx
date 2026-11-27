import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_PUBLIC_ORIGIN, APP_SUPPORT_EMAIL, supportEmailHref } from '@/lib/app-information';

export const metadata: Metadata = {
    title: 'Account and data requests',
    description: 'Request account deletion, data deletion or corrections for THE MAKEUP STORE HRM without signing in.',
    alternates: { canonical: `${APP_PUBLIC_ORIGIN}/account-deletion` },
};

export default function AccountRequestsPage() {
    const deletionEmail = supportEmailHref('THE MAKEUP STORE HRM — account/data deletion request',
        'I am requesting deletion of my THE MAKEUP STORE HRM account or data.\n\nName:\nStaff username or registered email (if known):\nRequest: account deletion / specific data deletion / correction\nDetails:\n\nPlease confirm what can be deleted and explain any records that must be retained.\n');
    return <article>
        <h1>Account and data requests</h1>
        <p>You can request account deletion, removal of optional data, access to your information or a correction for THE MAKEUP STORE HRM. You do not need to sign in or reinstall the app to make a request.</p>
        <a className="information-action" href={deletionEmail}>Request account or data deletion</a>
        <p>You can also email <a href={deletionEmail}>{APP_SUPPORT_EMAIL}</a> directly with the subject “THE MAKEUP STORE HRM — account/data deletion request”. The button opens your email app; this page does not submit a request automatically.</p>
        <h2>How to request</h2>
        <ol>
            <li>Tell us your name and staff username or registered email, if known.</li>
            <li>Say whether you want your account deleted, specific optional data deleted, a copy of your information or a correction.</li>
            <li>Send the email. We will verify your identity through your existing staff contact details and reply about the action taken or any necessary next steps.</li>
        </ol>
        <p>Do not send your password, one-time codes or identity documents. If you cannot use email, ask your store administrator at THE MAKEUP STORE, Wangkhei to help submit the request.</p>
        <h2>What deletion covers</h2>
        <p>A verified account-deletion request covers the app sign-in account, profile information and associated data that no longer needs to be retained. You may also request removal of optional push registrations or unnecessary uploads without closing your account. Disabling sign-in alone is not account deletion.</p>
        <h2>Records that may need to be kept</h2>
        <p>Employment, attendance, payroll, accounting, incident and audit records may need to remain for applicable legal obligations, security, resolving disputes or necessary employment administration. We will explain which requested records must be retained, why and the applicable retention period when handling your request. Copies held in backups remain subject to their retention requirements.</p>
        <p>Deleting the app from your phone or signing out does not delete these server records. For the full explanation, read the <Link href="/privacy">privacy policy</Link>.</p>
    </article>;
}
