import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_PUBLIC_ORIGIN, APP_SUPPORT_EMAIL, POLICY_UPDATED_DATE, supportEmailHref } from '@/lib/app-information';

export const metadata: Metadata = {
    title: 'Privacy policy',
    description: 'How THE MAKEUP STORE HRM handles employee attendance, location, payroll and store operations data.',
    alternates: { canonical: `${APP_PUBLIC_ORIGIN}/privacy` },
};

export default function PrivacyPage() {
    return <article>
        <h1>Privacy policy</h1>
        <time dateTime={POLICY_UPDATED_DATE}>Effective 27 November 2026</time>
        <p>THE MAKEUP STORE HRM is the employee workspace for THE MAKEUP STORE, Wangkhei. This policy covers the Android app and its hosted website. Access to staff records requires a store-issued account.</p>

        <h2>Who handles your information</h2>
        <p>THE MAKEUP STORE, Wangkhei uses this app to administer its workforce and daily store operations. For privacy questions, corrections or deletion requests, email <a href={supportEmailHref('HRM privacy enquiry')}>{APP_SUPPORT_EMAIL}</a>. You can also contact your store administrator.</p>

        <h2>Information the app handles</h2>
        <ul>
            <li><strong>Account and employment information:</strong> your name, account email or staff username, account identifier, authentication details, role, assigned store, shifts and employment settings.</li>
            <li><strong>Attendance and location:</strong> check-in and check-out times, attendance method, approval and correction history, and location coordinates, accuracy and capture time used to verify attendance. Location checks run when you use a feature that requests them; the app does not track your location continuously in the background.</li>
            <li><strong>Pay and leave records:</strong> worked hours, pay rates, payroll calculations, advances, payslips, leave requests and related administrative records.</li>
            <li><strong>Store work you submit:</strong> tasks, checklists, inspections, incident and damage reports, audit answers, restock requests, comments and attachments. Selected photos and incident voice-note files are uploaded when you attach them.</li>
            <li><strong>Notifications and technical information:</strong> notification history and preferences, registered device details, push tokens and installation identifiers. Our hosting, authentication and messaging providers also process technical connection information, such as IP addresses, app versions and delivery or security logs.</li>
        </ul>

        <h2>Camera, files and permissions</h2>
        <p>Smart Scan uses the camera to read the store attendance QR code. Its QR decoding happens on your device; camera frames are not uploaded as an attendance video. Photos explicitly attached to store reports are uploaded separately. You can select an existing audio file for an incident; the app does not request microphone permission to record you.</p>
        <p>The app requests foreground location for attendance verification, camera access for scanning or photos, and notification permission if you enable Android push. It does not request access to contacts, SMS, call logs or background location. Refusing a permission can limit the related feature; contact your manager when an attendance verification cannot be completed.</p>

        <h2>Why information is used</h2>
        <p>We use these records to verify attendance, organize shifts and leave, calculate and review pay, assign and complete store work, investigate incidents, deliver work notifications, support staff and protect the integrity of store records. The app does not contain advertising or use your employee records for advertising personalization.</p>

        <h2>Who can receive information</h2>
        <p>Authorized store administrators and managers can access records needed for their responsibilities. Other employees receive only the information their account permissions allow, such as assigned work. Records can be disclosed where required by law or necessary to address a legitimate security or legal matter.</p>
        <p>Service providers process information to operate the app: <strong>Supabase</strong> for authentication, database and file storage; <strong>Hostinger</strong> for the hosted application; and <strong>Google Firebase Cloud Messaging and Firebase Installations</strong> for enabled Android push services. Push providers process device identifiers and delivery information. These are operational services, not advertising recipients. Processing locations depend on the providers and deployment configuration and may be outside your home jurisdiction.</p>

        <h2>Storage and security</h2>
        <p>The app connects to its workspace over HTTPS. Staff access is authenticated and records are restricted by account roles and database permissions. Uploaded reports are stored in the application storage service. Push transport credentials are held on the server rather than displayed in the app. These measures reduce risk; no system can promise complete security.</p>
        <p>Your device may hold authentication cookies, local theme settings and unfinished report drafts. Keep personal phones protected and sign out before sharing a device. Uninstalling the app or clearing its local data does not delete server-side employment records.</p>

        <h2>Retention, correction and deletion</h2>
        <p>Account and work records are retained while needed for employment administration, payroll and accounting, security, resolving disputes and applicable legal obligations. Optional notification registrations can be revoked. Removing a device registration stops its eligibility for future notifications; it does not necessarily erase historical delivery or audit records.</p>
        <p>You may request access, correction, account deletion or deletion of optional data through our <Link href="/account-deletion">account and data request page</Link>. We verify the request, delete data that no longer needs to be kept and explain any employment, payroll, audit, security or legal records that must be retained. Account deactivation and deletion are different actions. Some records or backups may remain for those necessary purposes until their retention requirements end.</p>

        <h2>Your choices and policy updates</h2>
        <p>You can manage Android permissions in system settings and notification preferences in the app. This is a staff service, not a public consumer registration service. Accounts are provisioned by the store administrator. If our practices change, we will update this page and its effective date.</p>
        <p>Contact <a href={supportEmailHref('HRM privacy enquiry')}>{APP_SUPPORT_EMAIL}</a> for questions about this policy.</p>
    </article>;
}
