import Link from 'next/link';
import { publicInformationLinks } from '@/lib/public-information-routes';
import styles from './AppInformationLinks.module.css';

export default function AppInformationLinks() {
    return <nav aria-label="Privacy and support" className={styles.links}>
        {publicInformationLinks.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}
    </nav>;
}
