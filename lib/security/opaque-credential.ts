import { createHash, randomBytes } from 'node:crypto';
export function newDeviceCredential(): string { return randomBytes(32).toString('hex'); }
export function validDeviceCredential(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
export function credentialDigest(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }
