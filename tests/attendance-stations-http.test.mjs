import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const station = '10000000-0000-4000-8000-000000000001';
const requestId = '20000000-0000-4000-8000-000000000001';
const credential = 'a'.repeat(64);
const ok = { success: true, data: { state: 'authorized', station: { credential_days: 90 } } };
function modules(overrides = {}) {
    const cache = new Map();
    function load(file) {
        if (cache.has(file)) return cache.get(file);
        const compiledModule = { exports: {} };
        cache.set(file, compiledModule.exports);
        const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
        const factory = vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { Date, Number, Error, Buffer, URL, process: { env: { NODE_ENV: 'production' } } });
        factory(name => overrides[name] || (name.startsWith('node:') ? require(name) : load(name.startsWith('@/') ? resolve(name.slice(2) + '.ts') : resolve(dirname(file), name + '.ts'))), compiledModule, compiledModule.exports);
        return compiledModule.exports;
    }
    return load;
}
function handler(respond = () => ok) {
    const calls = [];
    const load = modules({
        'next/server': { NextResponse: { json: (body, options) => ({ body, ...options, cookies: { values: [], set(...args) { this.values.push(args); } } }) } },
        './server': { stationDeviceCommand: async (...args) => { calls.push(args); return respond(...args); } },
    });
    return { ...load(resolve('lib/attendance/stations/http.ts')), calls };
}
function request(body = { stationId: station }, { cookie = credential, origin = 'https://attendance.test', type = 'application/json', raw } = {}) {
    return { url: 'https://attendance.test/api/attendance/station/status', headers: new Headers({ 'content-type': type, origin }), cookies: { get: () => cookie ? { value: cookie } : undefined }, text: async () => raw ?? JSON.stringify(body) };
}
test('station HTTP rejects cross-origin, mixed-scheme, form and oversized requests before RPC', async () => {
    const http = handler();
    for (const [options, status] of [[{ origin: 'https://attacker.test' }, 403], [{ origin: 'http://attendance.test' }, 403], [{ type: 'text/plain' }, 415], [{ raw: 'a'.repeat(1025) }, 413], [{ raw: '{' }, 400]]) {
        assert.equal((await http.stationDevicePost(request(undefined, options), 'status')).status, status);
    }
    assert.equal((await http.stationDevicePost(request({ stationId: 'bad' }), 'status')).status, 400);
    assert.equal(http.calls.length, 0);
});
test('same-origin checks use the public Host and proxy scheme instead of Next internal URL reconstruction', async () => {
    const http = handler(); const proxied = request();
    proxied.url = 'http://localhost:3041/api/attendance/station/status';
    proxied.headers.set('host', 'attendance.test'); proxied.headers.set('x-forwarded-proto', 'https');
    assert.equal((await http.stationDevicePost(proxied, 'status')).status, 200);
    proxied.headers.set('origin', 'https://attacker.test');
    assert.equal((await http.stationDevicePost(proxied, 'status')).status, 403);
    assert.equal(http.calls.length, 1);
});
test('pairing puts a fresh credential only in an HttpOnly Secure scoped cookie', async () => {
    const http = handler();
    const result = await http.stationDevicePost(request(undefined, { cookie: null }), 'start');
    assert.equal(result.status, 200);
    const [name, value, options] = result.cookies.values[0];
    assert.equal(name, 'hrm_station_device'); assert.match(value, /^[a-f0-9]{64}$/);
    assert.equal(options.httpOnly, true); assert.equal(options.secure, true); assert.equal(options.sameSite, 'strict');
    assert.equal(options.path, '/api/attendance/station'); assert.equal(options.maxAge, 90 * 86400);
    assert.ok(!JSON.stringify(result.body).includes(value));
    assert.equal(result.headers['Cache-Control'], 'no-store, private'); assert.equal(result.headers['Referrer-Policy'], 'no-referrer');
    assert.equal(http.calls[0][1], value); assert.equal(http.calls[1][1], value);
});
test('an existing browser keeps its credential and a wrong-station cookie cannot enroll elsewhere', async () => {
    const http = handler(); const result = await http.stationDevicePost(request(), 'start');
    assert.equal(result.cookies.values[0][1], credential);
    const foreign = handler(() => ({ success: false, code: '42501', error: 'This display belongs to another station.' }));
    const denied = await foreign.stationDevicePost(request(), 'start');
    assert.equal(denied.status, 409); assert.equal(foreign.calls.length, 1); assert.equal(denied.cookies.values.length, 0);
});
test('issue preserves its request UUID, rejects invalid nonces and maps rate limits', async () => {
    const http = handler(() => ({ success: false, code: 'RATE_LIMITED', error: 'Wait for rotation.', retryAfter: 8 }));
    const result = await http.stationDevicePost(request({ stationId: station, requestId }), 'issue');
    assert.equal(result.status, 429); assert.equal(result.body.retryAfter, 8); assert.equal(http.calls[0][3], requestId);
    assert.equal((await http.stationDevicePost(request({ stationId: station, requestId: 'bad' }), 'issue')).status, 400);
    assert.equal((await http.stationDevicePost(request(undefined, { cookie: null }), 'issue')).status, 401);
    assert.equal(http.calls.length, 1);
});
test('unpairing derives the real station from the cookie, and already-unpaired browsers can reset', async () => {
    const http = handler(); const response = await http.stationDevicePost(request(), 'forget');
    assert.equal(http.calls[0][2], null); assert.equal(response.cookies.values[0][2].maxAge, 0);
    const empty = handler(); const reset = await empty.stationDevicePost(request(undefined, { cookie: null }), 'forget');
    assert.equal(reset.status, 200); assert.equal(reset.cookies.values[0][2].maxAge, 0); assert.equal(empty.calls.length, 0);
});
test('failed revocation keeps the credential and never reports a successful unpair', async () => {
    const http = handler(() => ({ success: false, code: 'NOT_INSTALLED', error: 'Migration needed.' }));
    const response = await http.stationDevicePost(request(), 'forget');
    assert.equal(response.status, 503); assert.equal(response.body.success, false); assert.equal(response.cookies.values.length, 0);
    const down = handler(() => { throw new Error('private transport detail'); });
    const failure = await down.stationDevicePost(request(), 'heartbeat');
    assert.equal(failure.status, 503); assert.ok(!failure.body.error.includes('private transport'));
});
test('server stores only token digests and reconstructs the same recoverable QR after status reload', async () => {
    const calls = [];
    const load = modules({ '@/lib/supabase/server': { createClient: async () => ({ rpc: async (...args) => { calls.push(args); return { error: null, data: { success: true, data: { state: 'authorized', tokenId: station, requestId, expiresAt: '2026-11-24T10:00:45Z' } } }; } }) } });
    const server = load(resolve('lib/attendance/stations/server.ts'));
    const crypto = load(resolve('lib/attendance/stations/crypto.ts'));
    const issued = await server.stationDeviceCommand('issue', credential, station, requestId);
    const recovered = await server.stationDeviceCommand('status', credential, station);
    assert.equal(issued.success, true); assert.equal(recovered.data.qrValue, issued.data.qrValue);
    assert.equal(calls[0][1].p_token_hash, crypto.stationDigest(crypto.stationTokenMac(credential, requestId)));
    assert.ok(!JSON.stringify(issued).includes(credential)); assert.ok(!('p_token_hash' in calls[1][1]));
});
test('a pending display receives its derived code while incomplete issuance fails closed', async () => {
    let pending = true;
    const load = modules({ '@/lib/supabase/server': { createClient: async () => ({ rpc: async () => ({ error: null, data: { success: true, data: { state: pending ? 'pending' : 'authorized' } } }) }) } });
    const server = load(resolve('lib/attendance/stations/server.ts'));
    const result = await server.stationDeviceCommand('start', credential, station);
    assert.match(result.data.pairingCode, /^[0-9A-HJKMNP-TV-Z]{8}$/);
    pending = false;
    assert.equal((await server.stationDeviceCommand('issue', credential, station, requestId)).success, false);
});
test('only the exact public station page bypasses session login in the application proxy', async () => {
    let authChecks = 0;
    const load = modules({
        '@supabase/ssr': { createServerClient: () => ({ auth: { getUser: async () => { authChecks++; return { data: { user: null } }; } } }) },
        'next/server': { NextResponse: { next: () => ({ status: 200 }), redirect: url => ({ status: 307, location: url.pathname }) } },
    });
    const { proxy } = load(resolve('proxy.ts'));
    const route = path => ({ nextUrl: { pathname: path }, url: `https://attendance.test${path}`, headers: new Headers() });
    assert.equal((await proxy(route('/attendance-station'))).status, 200); assert.equal(authChecks, 0);
    for (const path of ['/admin/attendance-stations', '/employee', '/attendance-station/other']) {
        const response = await proxy(route(path)); assert.equal(response.status, 307); assert.equal(response.location, '/login');
    }
    assert.equal(authChecks, 3);
});
