import Image from 'next/image';
import { WORKSPACE_LOGO, WORKSPACE_NAME } from '@/lib/branding';
import styles from './AppBrand.module.css';

export default function AppBrand({ subtitle }: { subtitle?: string }) {
    return (
        <span className={styles.brand}>
            <Image src={WORKSPACE_LOGO} alt="" width={44} height={44} className={styles.logo} />
            <span className={styles.copy}>
                <span className={styles.name}>{WORKSPACE_NAME}</span>
                {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
            </span>
        </span>
    );
}
