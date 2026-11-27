import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const userId = '00000000-0000-4000-8000-000000000001';
const otherId = '00000000-0000-4000-8000-000000000002';
const deviceId = '10000000-0000-4000-8000-000000000001';
const cookie = 'a'.repeat(64);
function loader(overrides = {}, env = {}, globals = {}) {
    const cache = new Map();
    function load(file) {
        if (cache.has(file)) return cache.get(file);
        const compiledModule = { exports: {} }; cache.set(file, compiledModule.exports);
        const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
        const factory = vm.runInNewContext(`(function(require,module,exports){${source}\n})`, { Date, Number, Error, URL, Buffer, AbortSignal, setTimeout, clearTimeout, process: { env }, ...globals });
        factory(name => overrides[name] || (name.startsWith('node:') || !name.startsWith('.') && !name.startsWith('@/') ? require(name) : load(name.startsWith('@/') ? resolve(name.slice(2) + '.ts') : resolve(dirname(file), name + '.ts'))), compiledModule, compiledModule.exports);
        return compiledModule.exports;
    }
    return load;
}
const load = loader(); const validation = load(resolve('lib/notifications/validation.ts')); const types = load(resolve('lib/notifications/types.ts'));
test('preference and timing validation preserve defaults and reject ambiguous quiet hours and escalation order', () => {
    assert.equal(validation.reminderPreferences(types.defaultPreferences).quiet_start, null);
    assert.equal(validation.reminderTiming(types.defaultReminderTiming).upcoming_minutes, 15);
    for (const patch of [{ quiet_start: 5 }, { quiet_start: 0, quiet_end: 0 }, { quiet_start: -1, quiet_end: 60 }, { enabled: 'true' }]) assert.throws(() => validation.reminderPreferences({ ...types.defaultPreferences, ...patch }));
    for (const patch of [{ late_minutes: 1 }, { cooldown_minutes: 999 }, { upcoming_minutes: 2.5 }, { delivery_window_minutes: 0 }]) assert.throws(() => validation.reminderTiming({ ...types.defaultReminderTiming, ...patch }));
});
test('browser push registrations are rejected while native enrollment remains available', () => {
    assert.throws(() => validation.notificationCommand({ action: 'register', provider: 'webpush', name: 'Old browser', credential: {} }), /Android app/);
    assert.equal(validation.notificationCommand({ action: 'register', provider: 'fcm', name: 'Android', credential: { token: 'A'.repeat(100) } }).provider, 'fcm');
});
test('notification taps preserve app routes and deny external, API and traversal destinations', () => {
    const { notificationPath } = load(resolve('lib/notifications/links.ts'));
    assert.equal(notificationPath('/admin/weekoff-request'), '/admin/weekoff-request'); assert.equal(notificationPath('/employee/smart-scan'), '/employee/smart-scan');
    for (const path of ['https://evil.invalid', '//evil.invalid', '/api/attendance/clock-out', '/employee/../api', '/employee/%2f%2fevil', '/signout', '/employee\\evil']) assert.equal(notificationPath(path), '/employee/notifications');
});
function http() {
    const calls = []; const result = { success: true, data: { userId, devices: [], preferences: {} } };
    const imports = { 'next/server': { NextResponse: { json: (body, options) => ({ body, ...options, cookies: { values: [], set(...args) { this.values.push(args); } } }) } }, './server': { INSTALLATION_COOKIE: 'hrm_notification_installation', notificationUser: async (...args) => { calls.push(args); return result; }, notificationAdmin: async command => { calls.push(command); return result; } } };
    return { ...loader(imports, { NODE_ENV: 'production' })(resolve('lib/notifications/http.ts')), calls };
}
function request({ body = {}, method = 'POST', origin = 'https://attendance.test', secret = cookie, raw, type = 'application/json' } = {}) {
    return { method, url: 'https://attendance.test/api/notifications', headers: new Headers({ origin, 'content-type': type }), cookies: { get: () => secret ? { value: secret } : undefined }, text: async () => raw ?? JSON.stringify(body) };
}
test('notification HTTP rejects foreign origins, non-JSON and oversized input before accessing a user', async () => {
    const app = http();
    for (const [options, status] of [[{ origin: 'https://evil.invalid' }, 403], [{ type: 'text/plain' }, 415], [{ raw: 'x'.repeat(16385) }, 413]]) assert.equal((await app.notificationRequest(request(options))).status, status);
    assert.equal(app.calls.length, 0);
});
test('registration uses only the HttpOnly installation cookie and binds mutations to the intended account', async () => {
    const app = http(); const response = await app.notificationRequest(request({ secret: null, body: { action: 'register', provider: 'fcm', name: 'Test phone', credential: { token: 'A'.repeat(100) }, installationSecret: cookie, expectedUserId: userId } }));
    assert.equal(response.status, 200); const [name, value, options] = response.cookies.values[0];
    assert.equal(name, 'hrm_notification_installation'); assert.notEqual(value, cookie); assert.match(value, /^[a-f0-9]{64}$/); assert.equal(options.httpOnly, true); assert.equal(options.secure, true); assert.equal(options.sameSite, 'strict'); assert.equal(options.path, '/');
    assert.equal(app.calls[0][1], value); assert.equal(app.calls[0][2], userId); assert.ok(!JSON.stringify(response.body).includes(value));
});
test('GET is read-only and a missing installation still goes through authenticated configuration', async () => {
    const app = http(); const read = await app.notificationRequest(request({ method: 'GET' })); assert.equal(app.calls[0][0].action, 'config'); assert.equal(read.headers['Cache-Control'], 'no-store, private');
    await app.notificationRequest(request({ secret: null, body: { action: 'sync', expectedUserId: userId } })); assert.equal(app.calls[1][0].action, 'config');
});
test('server identity verification rejects account-switch races before invoking the registration RPC', async () => {
    const calls = []; const db = { auth: { getUser: async () => ({ data: { user: { id: otherId } }, error: null }) }, rpc: async (...args) => { calls.push(args); return {}; } };
    const server = loader({ '@/lib/supabase/server': { createClient: async () => db } })(resolve('lib/notifications/server.ts'));
    const result = await server.notificationUser({ action: 'sync' }, cookie, userId); assert.equal(result.success, false); assert.equal(result.status, 403); assert.equal(calls.length, 0);
});
const payload = { allowed: true, provider: 'fcm', credential: { token: 'A'.repeat(100) }, expiresAt: new Date(Date.now() + 600000).toISOString(), notificationId: deviceId, url: '/employee/smart-scan' };
test('FCM has a real unconfigured outcome and never attempts delivery without project setup', async () => {
    const provider = loader()(resolve('lib/notifications/providers.ts')); let fetched = false;
    const result = await provider.sendFcm(payload, { fetcher: async () => { fetched = true; throw new Error('Unexpected network'); } }); assert.equal(result.outcome, 'blocked_configuration'); assert.equal(fetched, false);
});
test('FCM v1 sends a generic lock-screen message, bounded TTL and a safe app destination', async () => {
    const provider = loader()(resolve('lib/notifications/providers.ts')); let sent;
    const result = await provider.sendFcm({ ...payload, url: 'https://evil.invalid' }, { projectId: 'fictional-project', getToken: async () => 'fictional-access-token', fetcher: async (url, options) => { sent = { url, ...options }; return new Response('{}', { status: 200 }); } });
    assert.equal(result.outcome, 'sent'); assert.match(sent.url, /^https:\/\/fcm.googleapis.com\/v1\/projects\/fictional-project\/messages:send$/);
    const body = JSON.parse(sent.body); assert.equal(body.message.data.url, '/employee/notifications'); assert.equal(body.message.android.notification.channel_id, 'hrm-attendance'); assert.equal(body.message.notification.title, 'Attendance reminder'); assert.ok(!sent.body.includes('employee_id')); assert.ok(!sent.body.includes('latitude'));
});
test('provider errors distinguish expired tokens, authorization problems, rate limits and transient outages', async () => {
    const provider = loader()(resolve('lib/notifications/providers.ts'));
    for (const [status, body, expected] of [[404, { error: { details: [{ errorCode: 'UNREGISTERED' }] } }, 'invalid_device'], [403, { error: { details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } }, 'blocked_configuration'], [404, {}, 'blocked_configuration'], [429, {}, 'retry'], [503, {}, 'retry'], [400, {}, 'permanent']]) {
        const result = await provider.sendFcm(payload, { projectId: 'fictional', getToken: async () => 'token', fetcher: async () => new Response(JSON.stringify(body), { status, headers: { 'retry-after': '120' } }) }); assert.equal(result.outcome, expected); if (status === 429) assert.equal(result.retryAfter, 120);
    }
    const interrupted = await provider.sendFcm(payload, { projectId: 'fictional', getToken: async () => 'token', fetcher: async () => { throw new Error('Private network detail'); } }); assert.equal(interrupted.outcome, 'retry'); assert.ok(!JSON.stringify(interrupted).includes('Private'));
});
test('old browser deliveries are retired without contacting a push provider', async () => {
    const provider = loader({}, { NEXT_PUBLIC_VAPID_PUBLIC_KEY: 'old', VAPID_PRIVATE_KEY: 'old' })(resolve('lib/notifications/providers.ts'));
    const result = await provider.createNotificationDispatcher()({ ...payload, provider: 'webpush', credential: { endpoint: 'https://old.example/subscription' } });
    assert.equal(result.outcome, 'permanent'); assert.equal(result.errorCode, 'BROWSER_PUSH_REMOVED');
});
test('worker reauthorizes every device, bounds provider concurrency and returns counts without credentials', async () => {
    const calls = []; const leases = Array.from({ length: 7 }, (_, index) => ({ id: String(index), leaseToken: 'lease' + index })); let active = 0; let maximum = 0; let sent = 0;
    const client = { rpc: async (_name, { p_command: command }) => { calls.push(command); return { error: null, data: { success: true, data: command.action === 'plan' ? { planned: 7 } : command.action === 'claim' ? { items: leases } : command.action === 'authorize' ? command.deliveryId === '0' ? { allowed: false } : payload : { recorded: true } } }; } };
    const worker = loader({ '@/lib/admin-client': { createServiceClient: () => { throw new Error('No service credentials in test'); } } })(resolve('lib/notifications/worker.ts'));
    const result = await worker.runAttendanceReminders({ client, deliver: async () => { active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; sent++; return { outcome: 'sent' }; } });
    assert.equal(sent, 6); assert.equal(maximum, 3); assert.equal(result.suppressed, 1); assert.equal(result.sent, 6); assert.equal(calls.filter(call => call.action === 'finish').length, 6); assert.ok(!JSON.stringify(result).includes('credential'));
});
test('the internal endpoint authenticates its own secret before creating a privileged worker', async () => {
    let runs = 0; const route = loader({ 'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } }, '@/lib/notifications/worker': { runAttendanceReminders: async () => { runs++; return { sent: 0 }; } }, '@/lib/store-ops/worker': { runOperationsWorker: async () => ({ sent: 0 }) } }, { ATTENDANCE_REMINDER_WORKER_SECRET: 'x'.repeat(48) })(resolve('app/api/internal/attendance-reminders/run/route.ts'));
    assert.equal((await route.POST({ headers: new Headers() })).status, 401); assert.equal(runs, 0);
    const accepted = await route.POST({ headers: new Headers({ authorization: 'Bearer ' + 'x'.repeat(48) }) }); assert.equal(accepted.body.success, true); assert.equal(runs, 1);
});
test('an unconfigured Android build never calls the native permission or registration API', async () => {
    let requests = 0;
    const client = loader({ '@/lib/native/experience': { nativePushConfiguration: async () => ({ configured: false, notificationsEnabled: false }), openNativeNotificationSettings: async () => {} }, '@capacitor/push-notifications': { PushNotifications: { requestPermissions: async () => { requests++; return { receive: 'granted' }; }, register: async () => { requests++; } } } })(resolve('lib/notifications/client.ts'));
    await assert.rejects(client.enableNativeNotifications(), /not configured/); assert.equal(requests, 0);
});

test('employee push opt-in enrolls the phone and enables task delivery for the same verified account', async () => {
    const calls = []; const events = [];
    const client = loader({
        './client': {
            enableNativeNotifications: async () => { calls.push('permission'); return 'fictional-token'; },
            postNotification: async (command, account) => { calls.push({ command, account }); return { success: true, data: { userId: account, devices: [] } }; },
        },
        '@/app/actions/store-ops/notifications': { saveOperationsNotificationPreference: async (...args) => { calls.push(args); return { success: true }; } },
    }, {}, { window: { dispatchEvent: event => events.push(event.type) }, Event })(resolve('lib/notifications/employee-push.ts'));
    const result = await client.enableEmployeePush(userId);
    assert.equal(result.operationsEnabled, true);
    assert.equal(calls[0], 'permission');
    assert.equal(calls[1].command.action, 'register'); assert.equal(calls[1].account, userId);
    assert.deepEqual(Array.from(calls[2]), [true, true, userId]);
    assert.equal(events[0], 'hrm:operations-notification-preferences-updated');
});
test('denied push permission never registers or changes store notification consent', async () => {
    let writes = 0;
    const client = loader({
        './client': { enableNativeNotifications: async () => { throw new Error('Permission denied'); }, postNotification: async () => { writes++; } },
        '@/app/actions/store-ops/notifications': { saveOperationsNotificationPreference: async () => { writes++; } },
    })(resolve('lib/notifications/employee-push.ts'));
    await assert.rejects(client.enableEmployeePush(userId), /Permission denied/);
    assert.equal(writes, 0);
});
test('partial push enrollment preserves the device result and reports task consent failure honestly', async () => {
    const client = loader({
        './client': { enableNativeNotifications: async () => 'fictional-token', postNotification: async () => ({ success: true, data: { userId, devices: [{ id: deviceId }] } }) },
        '@/app/actions/store-ops/notifications': { saveOperationsNotificationPreference: async () => ({ success: false, error: 'unavailable' }) },
    })(resolve('lib/notifications/employee-push.ts'));
    const result = await client.enableEmployeePush(userId);
    assert.equal(result.operationsEnabled, false); assert.equal(result.data.devices[0].id, deviceId);
});
test('a changed account cannot inherit store push consent from an old registration screen', async () => {
    let writes = 0;
    const client = loader({
        './client': { enableNativeNotifications: async () => 'fictional-token', postNotification: async () => ({ success: true, data: { userId: otherId } }) },
        '@/app/actions/store-ops/notifications': { saveOperationsNotificationPreference: async () => { writes++; } },
    })(resolve('lib/notifications/employee-push.ts'));
    await assert.rejects(client.enableEmployeePush(userId), /account changed/); assert.equal(writes, 0);
});


test('the authenticated notification schedule drains both queues even if one worker fails', async () => {
    for (const failed of ['attendance','operations',null]) {
        const calls=[];
        const route=loader({
            'next/server': {NextResponse:{json:(body,options)=>({body,...options})}},
            '@/lib/notifications/worker': {runAttendanceReminders:async()=>{calls.push('attendance');if(failed==='attendance')throw new Error('private details');return {sent:1};}},
            '@/lib/store-ops/worker': {runOperationsWorker:async()=>{calls.push('operations');if(failed==='operations')throw new Error('private details');return {sent:2};}},
        },{ATTENDANCE_REMINDER_WORKER_SECRET:'x'.repeat(48)})(resolve('app/api/internal/attendance-reminders/run/route.ts'));
        const response=await route.POST({headers:new Headers({authorization:'Bearer '+'x'.repeat(48)})});
        assert.equal(calls.length,2);assert.equal(response.status,failed?503:200);
        assert.equal(response.body.success,!failed);assert.ok(!JSON.stringify(response.body).includes('private details'));
        if(failed!=='attendance')assert.equal(response.body.data.sent,1);
        if(failed!=='operations')assert.equal(response.body.operations.sent,2);
    }
});
