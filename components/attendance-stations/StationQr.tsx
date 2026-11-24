'use client';
import { memo, useMemo } from 'react';
import QRCode from 'qrcode';

/** Four-module quiet zone, square black modules; no tokens leave this device. */
export default memo(function StationQr({ value }: { value: string }) {
    const code = useMemo(() => {
        const matrix = QRCode.create(value, { errorCorrectionLevel: 'M' }).modules;
        const segments: string[] = [];
        for (let y = 0; y < matrix.size; y++) for (let x = 0; x < matrix.size; x++) if (matrix.get(y, x)) segments.push(`M${x + 4},${y + 4}h1v1h-1z`);
        return { size: matrix.size + 8, path: segments.join('') };
    }, [value]);
    return <svg className="station-qr" viewBox={`0 0 ${code.size} ${code.size}`} role="img" aria-label="Rotating attendance QR code" shapeRendering="crispEdges">
        <rect width={code.size} height={code.size} fill="#fff" /><path d={code.path} fill="#000" />
    </svg>;
});
