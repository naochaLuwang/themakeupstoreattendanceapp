'use client';

import Image from 'next/image';
import type { MouseEventHandler } from 'react';
import { mediaUrl } from '@/lib/store-ops/media';

export default function StoreImage({ src, alt, className, thumbnail = false, onClick }: { src: string; alt: string; className?: string; thumbnail?: boolean; onClick?: MouseEventHandler<HTMLImageElement> }) {
    const url=mediaUrl(src,thumbnail);
    if(!url)return <span role="img" aria-label={alt||'Photo unavailable'} className={className}>Photo unavailable</span>;
    return <Image src={url} alt={alt} width={1600} height={1200} unoptimized className={className} onClick={onClick} />;
}
