import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const employee = '00000000-0000-4000-8000-000000000001';
const confirmationId = '10000000-0000-4000-8000-000000000001';
const operationId = '20000000-0000-4000-8000-000000000001';
const token = `hrm.attendance.v1.${confirmationId}.${'A'.repeat(43)}`;
const location = { lat: 0, lng: 0, accuracy: 10, capturedAt: '2026-11-24T10:00:00Z' };
const saved = { id: confirmationId, check_in: '2026-11-24T04:30:00Z', check_out: null, attendance_method: 'smart_qr' };
function loader(overrides = {}, globals = {}) {
    const cache = new Map();
    function load(file) {
        if (cache.has(file)) return cache.get(file);
        const compiledModule = { exports: {} }; cache.set(file, compiledModule.exports);
        const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
        const factory = vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { Date, Number, Error, URL, DOMException, AbortController, ...globals });
        factory(name => overrides[name] || load(name.startsWith('@/') ? resolve(name.slice(2) + '.ts') : resolve(dirname(file), name + '.ts')), compiledModule, compiledModule.exports);
        return compiledModule.exports;
    }
    return load;
}
const validation = loader()(resolve('lib/attendance/smart-scan/validation.ts'));
test('scanner accepts only versioned opaque attendance tokens, never camera URLs or unrelated QR values', () => {
    assert.equal(validation.isAttendanceQr(token), true);
    for (const value of [null, '', 'https://evil.test/' + token, token.replace('v1', 'v2'), token + '/extra', token.replace('attendance', 'payment')]) assert.equal(validation.isAttendanceQr(value), false);
});
test('scan inputs require strict GPS metadata and ignore client identity, timestamps and attendance action injection', () => {
    const parsed = validation.parseSmartRequest({ action: 'scan', token, operationId, location, employeeId: 'foreign', check_in: '1900', attendance_method: 'manual' });
    assert.equal(parsed.command.location.lat, 0); assert.equal(parsed.command.employeeId, undefined); assert.equal(parsed.command.check_in, undefined);
    assert.equal(parsed.operationId, operationId);
    const confirm = validation.parseSmartRequest({ action: 'confirm', confirmationId, operationId, location }); assert.equal(confirm.command.confirmationId, confirmationId);
    for (const patch of [{ token: 'url' }, { action: 'clock_out' }, { operationId: null }, { location: { ...location, accuracy: undefined } }, { location: { ...location, lat: NaN } }, { location: { ...location, capturedAt: 'bad' } }]) assert.throws(() => validation.parseSmartRequest({ action: 'scan', token, operationId, location, ...patch }));
});
function http(result = { success: true, state: 'clocked_in', data: saved }, throws = false) {
    const calls = []; const load = loader({ 'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } }, './server': { performSmartScan: async (...args) => { calls.push(args); if (throws) throw new Error('internal transport detail'); return result; } } });
    return { ...load(resolve('lib/attendance/smart-scan/http.ts')), calls };
}
function request({ method = 'POST', origin = 'https://attendance.test', type = 'application/json', body = { action: 'scan', token, operationId, location }, raw } = {}) {
    return { method, url: 'https://attendance.test/api/attendance/smart-scan', headers: new Headers({ origin, 'content-type': type }), text: async () => raw ?? JSON.stringify(body) };
}
test('HTTP rejects cross-origin, non-JSON and oversized scans before any database call', async () => {
    const app = http();
    for (const [options, status] of [[{ origin: 'https://evil.test' }, 403], [{ type: 'text/plain' }, 415], [{ raw: 'a'.repeat(4097) }, 413], [{ raw: '{' }, 400]]) assert.equal((await app.smartScanRequest(request(options))).status, status);
    assert.equal(app.calls.length, 0);
});
test('GET reads only configuration; POST carries its exact UUID and never retries a mutation automatically', async () => {
    const app = http(); const read = await app.smartScanRequest(request({ method: 'GET' }));
    assert.equal(app.calls[0][0].action, 'config'); assert.equal(read.headers['Cache-Control'], 'no-store, private');
    const write = await app.smartScanRequest(request()); assert.equal(write.status, 200); assert.equal(app.calls[1][1], operationId); assert.equal(app.calls.length, 2);
    const down = http(undefined, true); const failed = await down.smartScanRequest(request()); assert.equal(failed.status, 503); assert.equal(failed.body.success, false); assert.ok(!failed.body.error.includes('internal transport')); assert.equal(down.calls.length, 1);
});
function service(result, { user = employee, error = null } = {}) {
    const calls = []; const notifications = [];
    const load = loader({ '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) }, rpc: async (...args) => { calls.push(args); return { data: result, error }; } }) }, '../server': { queueAttendanceNotification: (...args) => notifications.push(args) } });
    return { ...load(resolve('lib/attendance/smart-scan/server.ts')), calls, notifications };
}
test('verified identity gates the scan RPC, forwarding the exact command once without a service key', async () => {
    const missing = service(null, { user: null }); assert.equal((await missing.performSmartScan({ action: 'config' })).status, 401); assert.equal(missing.calls.length, 0);
    const app = service({ success: true, state: 'clocked_in', changed: true, data: saved, branchName: 'Test' });
    const command = { action: 'scan', token, location }; assert.equal((await app.performSmartScan(command, operationId)).success, true);
    assert.equal(app.calls[0][0], 'attendance_smart_scan'); assert.equal(app.calls[0][1].p_operation_id, operationId); assert.deepEqual(app.notifications, [[employee, 'clock_in']]);
});
test('confirmations and replays do not send completed-attendance notifications', async () => {
    for (const result of [{ success: true, state: 'clocked_in', changed: false, replayed: true, data: saved }, { success: true, state: 'confirmation_required', changed: false, data: saved, confirmationId, expiresAt: '2026-11-24T10:02:00Z', serverNow: '2026-11-24T10:00:00Z' }]) {
        const app = service(result); assert.equal((await app.performSmartScan({ action: 'scan', token, location }, operationId)).success, true); assert.equal(app.notifications.length, 0);
    }
});
test('missing migration and malformed successes fail closed without exposing transport details', async () => {
    const missing = service(null, { error: { code: 'PGRST202', message: 'missing RPC' } }); assert.equal((await missing.performSmartScan({ action: 'config' })).code, 'NOT_INSTALLED');
    for (const data of [null, {}, { success: true, state: 'other' }, { success: true, state: 'clocked_in', data: {} }, { success: true, state: 'confirmation_required', data: saved, confirmationId }]) assert.equal((await service(data).performSmartScan({ action: 'scan', token, location }, operationId)).success, false);
});
function camera({ getUserMedia, decoderFails = false } = {}) {
    const calls = []; const stream = { getTracks: () => [{ stop: () => calls.push('track stopped') }], getVideoTracks: () => [{ getCapabilities: () => ({ torch: true }), applyConstraints: async () => calls.push('torch') }] };
    const timers = new Map(); let serial = 0;
    const window = { isSecureContext: true, setTimeout: callback => { timers.set(++serial, callback); return serial; }, clearTimeout: id => timers.delete(id) };
    const video = { srcObject: null, pause: () => calls.push('paused') };
    const load = loader({ '@zxing/browser': { BrowserQRCodeReader: class { async decodeFromStream(source, element) { if (decoderFails) throw new Error('decode setup failure'); element.srcObject = source; return { stop: () => calls.push('decoder stopped') }; } } } }, { window, navigator: { mediaDevices: { getUserMedia: getUserMedia || (async () => stream) } } });
    return { ...load(resolve('lib/attendance/smart-scan/camera.ts')), stream, video, calls, timers };
}
test('camera stop releases tracks, decoder and video; torch only operates while active', async () => {
    const app = camera(); const controller = new AbortController(); const session = await app.startAttendanceCamera(app.video, () => {}, controller.signal);
    assert.equal(session.torchAvailable, true); await session.setTorch(true); controller.abort(); await session.setTorch(false);
    assert.equal(app.video.srcObject, null); assert.deepEqual(app.calls, ['torch', 'decoder stopped', 'track stopped', 'paused']); assert.equal(app.timers.size, 0);
});
test('cancelling a pending camera permission releases a stream that arrives later', async () => {
    let finish; const app = camera({ getUserMedia: () => new Promise(resolve => { finish = resolve; }) }); const controller = new AbortController();
    const pending = app.startAttendanceCamera(app.video, () => {}, controller.signal); await new Promise(resolve => setImmediate(resolve)); controller.abort(); await assert.rejects(pending, { name: 'AbortError' });
    finish(app.stream); await new Promise(resolve => setImmediate(resolve)); assert.deepEqual(app.calls, ['track stopped']); assert.equal(app.timers.size, 0);
});
test('decoder setup failure releases the camera and permission errors explain the fallback', async () => {
    const app = camera({ decoderFails: true }); await assert.rejects(app.startAttendanceCamera(app.video, () => {}, new AbortController().signal)); assert.ok(app.calls.includes('track stopped'));
    const denied = new Error(); denied.name = 'NotAllowedError'; assert.match(app.cameraError(denied), /Allow camera access/); assert.match(app.cameraError(denied), /Manual attendance/);
});
test('a synchronous camera refusal clears its deadline and abort listener', async () => {
    const app = camera({ getUserMedia: () => { throw new DOMException('Denied', 'NotAllowedError'); } });
    await assert.rejects(app.startAttendanceCamera(app.video, () => {}, new AbortController().signal), { name: 'NotAllowedError' });
    assert.equal(app.timers.size, 0);
});
