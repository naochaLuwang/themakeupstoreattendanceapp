import { createHmac } from 'node:crypto';
export { newDeviceCredential as newStationCredential, validDeviceCredential as validStationCredential, credentialDigest as stationDigest } from '@/lib/security/opaque-credential';
export const STATION_COOKIE = 'hrm_station_device';
export const STATION_COOKIE_PATH = '/api/attendance/station';
export function devicePairingCode(credential: string) {
    const bytes = createHmac('sha256', credential).update('hrm-station-pair-v1').digest().subarray(0, 5);
    let bits = 0; for (const byte of bytes) bits = bits * 256 + byte;
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; let value = '';
    for (let i = 0; i < 8; i++) { value = alphabet[bits % 32] + value; bits = Math.floor(bits / 32); }
    return value;
}
export function stationTokenMac(credential: string, requestId: string) { return createHmac('sha256', credential).update(`hrm-attendance-v1:${requestId}`).digest('base64url'); }
export function stationQrValue(tokenId: string, mac: string) { return `hrm.attendance.v1.${tokenId}.${mac}`; }
