import Link from 'next/link';
import localFont from 'next/font/local';
import AppBrand from '@/components/AppBrand';
import AppInformationLinks from '@/components/AppInformationLinks';
import styles from './information.module.css';

const displayFont = localFont({
    src: '../../public/fonts/barlow-condensed/BarlowCondensed-SemiBold.ttf',
    variable: '--font-information-display',
    weight: '600',
    display: 'swap',
});

export default function InformationLayout({ children }: { children: React.ReactNode }) {
    return <div className={`${styles.page} ${displayFont.variable}`}>
        <a className={styles.skip} href="#app-information">Skip to information</a>
        <header className={styles.header}>
            <Link href="/login" aria-label="THE MAKEUP STORE HRM sign in"><AppBrand subtitle="Wangkhei · Employee workspace" /></Link>
            <Link className={styles.signIn} href="/login">Staff sign in</Link>
        </header>
        <div id="app-information" className={styles.content} tabIndex={-1}>{children}</div>
        <footer className={styles.footer}>
            <AppInformationLinks />
            <p>THE MAKEUP STORE · Wangkhei</p>
        </footer>
    </div>;
}
