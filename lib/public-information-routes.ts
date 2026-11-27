export const publicInformationLinks = [
    { href: '/privacy', label: 'Privacy policy' },
    { href: '/support', label: 'Support' },
    { href: '/account-deletion', label: 'Account & data requests' },
    { href: '/terms', label: 'Terms of use' },
] as const;

/** Exact public routes only; staff pages and lookalike paths remain protected. */
export function isPublicInformationPath(pathname: string): boolean {
    return publicInformationLinks.some(link => link.href === pathname);
}
