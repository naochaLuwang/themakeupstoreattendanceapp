import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(file) {
    const compiledModule = { exports: {} };
    const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const factory = vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { Date, Number, Error, Buffer, crypto: globalThis.crypto });
    factory(name => name.startsWith('node:') ? require(name) : load(name.startsWith('@/') ? resolve(name.slice(2) + '.ts') : resolve(dirname(file), name + '.ts')), compiledModule, compiledModule.exports);
    return compiledModule.exports;
}
const crypto = load(resolve('lib/attendance/stations/crypto.ts'));
const clock = load(resolve('lib/attendance/stations/clock.ts'));
const validation = load(resolve('lib/attendance/stations/validation.ts'));
const station = '10000000-0000-4000-8000-000000000001';
const request = '20000000-0000-4000-8000-000000000001';
const settings = { store_id: station, name: 'Billing counter', refresh_seconds: 30, validity_seconds: 45, heartbeat_seconds: 15, offline_seconds: 60, credential_days: 90 };

test('display credentials are unpredictable 256-bit values and have strict input validation', () => {
    const one = crypto.newStationCredential(), two = crypto.newStationCredential();
    assert.notEqual(one, two); assert.match(one, /^[a-f0-9]{64}$/); assert.equal(crypto.validStationCredential(one), true);
    for (const bad of ['', 'x'.repeat(64), null, 123]) assert.equal(crypto.validStationCredential(bad), false);
});
test('pairing codes are stable per credential, use the human-readable alphabet and have a separate purpose', () => {
    const secret = crypto.newStationCredential(); const code = crypto.devicePairingCode(secret);
    assert.equal(code, crypto.devicePairingCode(secret)); assert.match(code, /^[0-9A-HJKMNP-TV-Z]{8}$/);
    assert.notEqual(code, crypto.devicePairingCode(crypto.newStationCredential()));
    assert.equal(validation.pairingCode('abcd 1234'), 'ABCD1234'); assert.throws(() => validation.pairingCode('IIII0000'));
});
test('QR secrets are purpose-bound and recoverable without storing the device credential in the QR', () => {
    const secret = crypto.newStationCredential(); const mac = crypto.stationTokenMac(secret, request); const value = crypto.stationQrValue(station, mac);
    assert.match(mac, /^[A-Za-z0-9_-]{43}$/); assert.equal(mac, crypto.stationTokenMac(secret, request));
    assert.notEqual(mac, crypto.stationTokenMac(secret, station)); assert.notEqual(mac, crypto.stationTokenMac(crypto.newStationCredential(), request));
    assert.ok(!value.includes(secret)); assert.ok(!value.includes(crypto.devicePairingCode(secret)));
    assert.equal(value, `hrm.attendance.v1.${station}.${mac}`);
});
test('QR settings prevent validity gaps and premature offline status', () => {
    const parsed = validation.stationSettings(settings); assert.equal(parsed.validity_seconds, 45);
    for (const changes of [{ refresh_seconds: 1 }, { validity_seconds: 30 }, { heartbeat_seconds: 30, offline_seconds: 30 }, { credential_days: 1000 }, { name: '' }, { store_id: 'x' }]) assert.throws(() => validation.stationSettings({ ...settings, ...changes }));
});
test('a slow response and a wrong local wall clock cannot extend QR expiry', () => {
    const deadline = clock.stationDeadline('2026-11-24T10:00:00Z', '2026-11-24T10:00:45Z', 1000, 4000);
    assert.equal(deadline, 46000); assert.equal(clock.stationSeconds(deadline, 45000), 1);
    assert.equal(clock.stationSeconds(deadline, 46000), 0); assert.equal(clock.stationSeconds(deadline, 99000), 0);
    assert.equal(clock.stationDeadline('2026-11-24T10:00:00Z', '2026-11-24T10:00:01Z', 0, 5000), 5000);
    assert.equal(clock.stationDeadline('bad', 'bad', 0, 100), 100);
});
