// Read-only source audit: execute actual handlers with fictional in-memory data.
// These characterize defects, not intended behavior. No network or real database is used.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const employee = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const shift = '00000000-0000-4000-8000-000000000003';
const store = '00000000-0000-4000-8000-000000000004';
const requestId = '00000000-0000-4000-8000-000000000005';
const day = '2026-11-24';

function database(extra = {}, options = {}) {
    const state = { profiles: [{ id: employee, role: 'employee', full_name: 'Fictional Employee', store_id: store }], stores: [{ id: store, lat: 24.804, lng: 93.943, radius_meters: 100 }], shifts: [{ id: shift, employee_id: employee, start_time: `${day}T10:00:00Z`, end_time: `${day}T18:00:00Z`, shift_label: 'Day' }], attendance: [], swap_requests: [], ...structuredClone(extra) };
    const queries = [];
    let serial = 10;
    const client = {
        auth: { getUser: async () => ({ data: { user: { id: employee } }, error: null }) },
        from(table) {
            const q = { table, op: 'select', filters: [], one: false, payload: null };
            const builder = new Proxy({}, { get(_target, method) {
                if (method === 'then') return (resolveResult, reject) => Promise.resolve().then(() => {
                    queries.push(q);
                    const forced = options.error?.(q);
                    if (forced) return { data: null, error: { message: forced } };
                    const rows = state[table] ||= [];
                    let selected = rows.filter(row => q.filters.every(([kind, key, val]) => kind === 'eq' ? row[key] === val : kind === 'is' ? (row[key] ?? null) === val : kind === 'gte' ? row[key] >= val : kind === 'lte' ? row[key] <= val : kind === 'lt' ? row[key] < val : true));
                    if (q.op === 'insert') {
                        selected = (Array.isArray(q.payload) ? q.payload : [q.payload]).map(row => ({ id: `00000000-0000-4000-8000-${String(serial++).padStart(12, '0')}`, ...structuredClone(row) }));
                        rows.push(...selected);
                    } else if (q.op === 'update') selected.forEach(row => Object.assign(row, structuredClone(q.payload)));
                    else if (q.op === 'delete') state[table] = rows.filter(row => !selected.includes(row));
                    if (q.limit) selected = selected.slice(0, q.limit);
                    return { data: structuredClone(q.one ? selected[0] ?? null : selected), error: null };
                }).then(resolveResult, reject);
                return (...args) => {
                    if (['insert', 'update', 'delete'].includes(method)) { q.op = method; q.payload = args[0]; }
                    else if (['eq', 'is', 'gte', 'lte', 'lt'].includes(method)) q.filters.push([method, ...args]);
                    else if (method === 'single' || method === 'maybeSingle') q.one = true;
                    else if (method === 'limit') q.limit = args[0];
                    return builder;
                };
            } });
            return builder;
        },
    };
    return { client, state, queries };
}

function load(file, db, { notify = async () => {}, extract, globals = {} } = {}) {
    let source = readFileSync(resolve(file), 'utf8');
    if (extract) {
        const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        let initializer;
        function visit(node) {
            if (ts.isVariableDeclaration(node) && node.name.getText(ast) === extract) initializer = node.initializer.getText(ast);
            ts.forEachChild(node, visit);
        }
        visit(ast);
        assert.ok(initializer, `Missing handler ${extract}`);
        source = `export const run = ${initializer};`;
    }
    const module = { exports: {} };
    const stubs = {
        '@/lib/supabase/server': { createClient: async () => db.client },
        '@/lib/admin-client': { getAdminClient: async () => db.client },
        '@/lib/push': { sendPushNotification: notify },
        '@/lib/geofence': { calculateDistance: (...args) => geofence.calculateDistance(...args) },
        '@/lib/store-ops/permissions': { can: (role, permission) => role === 'admin' || role === 'manager' || ['tasks.complete', 'restock.create'].includes(permission), canDelete: role => role === 'admin' },
        'next/cache': { revalidatePath() {} },
        'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    };
    const context = vm.createContext({ Response, Date, FormData, console: { log() {}, error() {} }, supabase: db.client, setProcessingId() {}, fetchRequests: async () => {}, approveOverrideRequest: async () => ({ success: true }), alert() {}, ...globals });
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context)(name => {
        if (!stubs[name]) throw new Error(`Unexpected dependency: ${name}`);
        return stubs[name];
    }, module, module.exports);
    return module.exports;
}
const geofence = load('lib/geofence.ts', database());
const post = value => ({ json: async () => value });
const clockIn = 'app/api/attendance/clock-in/route.ts';
const swap = 'app/api/requests/swap/route.ts';
const approval = 'app/(dashboard)/admin/weekoff-request/page.tsx';
const current = { id: requestId, requestor_id: employee, receiver_id: employee, shift_id: shift, message: `Shift Change: Move from Day to Late for ${day}`, status: 'pending', shifts: { id: shift, start_time: `${day}T10:00:00Z`, end_time: `${day}T18:00:00Z` } };
const active = { id: requestId, employee_id: employee, shift_id: shift, check_in: `${day}T04:30:00Z`, check_out: null };
const clockBody = { userId: employee, storeId: store, shiftId: shift, lat: 24.804, lng: 93.943 };

test('swap submission accepts a shift that already has active attendance', async () => {
    const db = database({ attendance: [active] });
    const response = await load(swap, db).POST(post({ userId: employee, shiftId: shift, message: current.message }));
    assert.equal(response.status, 200);
    assert.equal(db.state.swap_requests.length, 1);
    assert.equal(db.queries.some(q => q.table === 'attendance'), false);
});
test('swap submission accepts a past shift owned by another employee and duplicates', async () => {
    const db = database({ shifts: [{ id: shift, employee_id: other, start_time: '2020-01-01T10:00:00Z' }] });
    const handler = load(swap, db).POST;
    for (let i = 0; i < 2; i++) assert.equal((await handler(post({ userId: employee, shiftId: shift, message: current.message }))).status, 200);
    assert.equal(db.state.swap_requests.length, 2);
});
test('normal approval edits an actively worked shift', async () => {
    const db = database({ attendance: [active], swap_requests: [current], shift_presets: [{ label: 'Late', start_time: '12:00:00', end_time: '20:00:00' }] });
    await load(approval, db, { extract: 'handleAction' }).run(current, 'approved');
    assert.equal(db.state.shifts[0].start_time, `${day}T12:00:00Z`);
    assert.equal(db.state.swap_requests[0].status, 'approved');
});
test('stale cancelled request can still be approved; malformed message can be approved without changing a shift', async () => {
    const req = { ...current, status: 'cancelled', message: 'Shift Change: malformed' };
    const db = database({ swap_requests: [req] });
    await load(approval, db, { extract: 'handleAction' }).run(req, 'approved');
    assert.equal(db.state.swap_requests[0].status, 'approved');
    assert.equal(db.state.shifts[0].shift_label, 'Day');
});
test('two-shift approval ignores second update failure and still approves', async () => {
    const target = { id: other, employee_id: employee, start_time: '2026-11-25T12:00:00Z', end_time: '2026-11-25T20:00:00Z', shift_label: 'Late' };
    const req = { ...current, message: 'Swap my shift on 2026-11-24 with shift on 2026-11-25.' };
    const db = database({ shifts: [database().state.shifts[0], target], swap_requests: [req] }, { error: q => q.table === 'shifts' && q.op === 'update' && q.filters.some(([, key, val]) => key === 'id' && val === other) ? 'injected second write failure' : null });
    await load(approval, db, { extract: 'handleAction' }).run(req, 'approved');
    assert.equal(db.state.shifts[0].shift_label, 'Late');
    assert.equal(db.state.shifts[1].shift_label, 'Late');
    assert.equal(db.state.swap_requests[0].status, 'approved');
});
test('clock-in accepts completed same-day attendance without override approval', async () => {
    const db = database({ attendance: [{ ...active, check_out: `${day}T05:00:00Z` }] });
    assert.equal((await load(clockIn, db).POST(post(clockBody))).status, 200);
    assert.equal(db.state.attendance.length, 2);
});
test('clock-in accepts no shift and a mismatched shift/store without consulting schedule or store assignment', async () => {
    for (const suppliedShift of [null, other]) {
        const db = database({ profiles: [{ id: employee, store_id: other }], shifts: [{ id: other, employee_id: other, start_time: '2020-01-01T10:00:00Z' }] });
        assert.equal((await load(clockIn, db).POST(post({ ...clockBody, shiftId: suppliedShift }))).status, 200);
        assert.equal(db.queries.some(q => q.table === 'shifts'), false);
    }
});
test('malformed coordinates reach the database write instead of being rejected by geofence', async () => {
    const db = database();
    await load(clockIn, db).POST(post({ ...clockBody, lat: 'invalid' }));
    assert.equal(db.queries.some(q => q.table === 'attendance' && q.op === 'insert'), true);
    // A production column constraint might reject this write; the application guard does not.
});
test('missing store coordinates skip geofence but mark attendance within geofence', async () => {
    const db = database({ stores: [{ id: store, lat: null, lng: null }] });
    assert.equal((await load(clockIn, db).POST(post({ ...clockBody, lat: 0, lng: 0 }))).status, 200);
    assert.equal(db.state.attendance[0].is_within_geofence, true);
});
test('active-attendance query failure is ignored and followed by insert', async () => {
    const db = database({}, { error: q => q.table === 'attendance' && q.op === 'select' ? 'injected read failure' : null });
    assert.equal((await load(clockIn, db).POST(post(clockBody))).status, 200);
    assert.equal(db.state.attendance.length, 1);
});
test('concurrent clock-in requests can both insert without a database uniqueness guard', async () => {
    const db = database();
    const handler = load(clockIn, db).POST;
    await Promise.all([handler(post(clockBody)), handler(post(clockBody))]);
    assert.equal(db.state.attendance.length, 2);
});
test('clock-out closes every open record rather than a specified attendance session', async () => {
    const db = database({ attendance: [active, { ...active, id: other, check_in: '2026-11-23T04:30:00Z' }] });
    const response = await load('app/api/attendance/clock-out/route.ts', db).POST(post({ userId: employee, attendanceId: other }));
    assert.equal((await response.json()).count, 2);
});
test('clock-in persists before its awaited push delivery has completed', async () => {
    let release;
    const notification = new Promise(resolveDone => { release = resolveDone; });
    const db = database();
    let responded = false;
    const response = load(clockIn, db, { notify: () => notification }).POST(post(clockBody)).then(value => { responded = true; return value; });
    await new Promise(resolveDone => setTimeout(resolveDone, 10));
    assert.equal(db.state.attendance.length, 1);
    assert.equal(responded, false);
    release();
    await response;
});
test('override accepts an already approved request and reopens it again after a later checkout', async () => {
    const req = { ...current, status: 'approved', message: `OVERRIDE REQUEST ${day}` };
    const db = database({ attendance: [{ ...active, check_out: `${day}T05:00:00Z` }], swap_requests: [req] });
    const handler = load('app/actions/attendance-override.ts', db).approveOverrideRequest;
    assert.equal((await handler(requestId)).success, true);
    db.state.attendance[0].check_out = `${day}T06:00:00Z`;
    assert.equal((await handler(requestId)).success, true);
    assert.equal(db.state.attendance[0].check_out, null);
});
test('manual edit validates only supplied endpoints and accepts checkout before saved check-in', async () => {
    const db = database({ attendance: [active] });
    const response = await load('app/actions/manual-attendance.ts', db).updateManualAttendance(requestId, { check_out: '2020-01-01T00:00:00Z' });
    assert.equal(response.success, true);
    assert.ok(db.state.attendance[0].check_out < db.state.attendance[0].check_in);
});
test('leave request accepts inverted dates and a day already worked', async () => {
    const db = database({ attendance: [active] });
    const result = await load('app/actions/requests.ts', db).createLeaveRequestAction(employee, '2026-11-25', '2026-11-24', 'fictional');
    assert.equal(result.success, true);
});
test('payroll action trusts caller totals and does not check auth or prevent duplicate submission', async () => {
    const db = database();
    db.client.auth.getUser = async () => { throw new Error('Auth unexpectedly invoked'); };
    const handler = load('app/(dashboard)/admin/payroll/actions.ts', db).processPayroll;
    const form = new FormData();
    for (const [key, value] of Object.entries({ employeeId: other, netPay: '-500', grossPay: '100', type: 'salary' })) form.set(key, value);
    await handler(form); await handler(form);
    assert.equal(db.state.payroll_records.length, 2);
    assert.equal(db.state.payroll_records[0].net_pay, -500);
});
test('daily checklist completion does not read or require completed items or photo proof', async () => {
    const db = database({ daily_checklists: [{ id: requestId, status: 'in_progress' }], daily_checklist_items: [{ id: other, daily_checklist_id: requestId, is_completed: false }] });
    assert.equal((await load('app/actions/store-ops/daily-checklist.ts', db).completeDailyChecklist(requestId)).success, true);
    assert.equal(db.state.daily_checklists[0].status, 'completed');
    assert.equal(db.state.daily_checklist_items[0].is_completed, false);
});
test('task completion can reopen a cancelled task and is a non-idempotent toggle', async () => {
    const db = database({ tasks: [{ id: requestId, status: 'cancelled', assigned_to: other }] });
    const handler = load('app/actions/store-ops/tasks.ts', db).completeTask;
    assert.equal((await handler(requestId)).success, true);
    assert.equal(db.state.tasks[0].status, 'completed');
    await handler(requestId);
    assert.equal(db.state.tasks[0].status, 'pending');
});
test('authenticated employee can start an audit; answer score has no runtime range check', async () => {
    const db = database({ audit_templates: [{ id: shift }], audit_questions: [{ id: other, template_id: shift, max_score: 5 }] });
    const handlers = load('app/actions/store-ops/audits.ts', db);
    const result = await handlers.startAudit(shift);
    assert.equal(result.success, true);
    await handlers.submitAuditAnswer(result.data.id, other, 999);
    assert.equal(db.state.audit_answers[0].score, 999);
});
test('restocking accepts negative quantity and leaves a parent after item insert failure', async () => {
    const db = database();
    const handlers = load('app/actions/store-ops/restocking.ts', db);
    assert.equal((await handlers.createRestockRequest([{ barcode: 'fictional', product_name: 'Fictional', quantity_needed: -3 }])).success, true);
    assert.equal(db.state.restock_items[0].quantity_needed, -3);
    const failed = database({}, { error: q => q.table === 'restock_items' && q.op === 'insert' ? 'injected insert failure' : null });
    assert.ok((await load('app/actions/store-ops/restocking.ts', failed).createRestockRequest([{ barcode: 'fictional', product_name: 'Fictional', quantity_needed: 1 }])).error);
    assert.equal(failed.state.restock_requests.length, 1);
});
test('notification action accepts a different recipient and forwards to the admin broadcast helper', async () => {
    const db = database();
    const notifications = [];
    const handler = load('app/actions/store-ops/notifications.ts', db, { notify: async (...args) => notifications.push(args) });
    assert.equal((await handler.createNotification(other, 'Fictional', 'Fictional message')).success, true);
    assert.equal(db.state.notification_log[0].user_id, other);
    assert.equal(notifications.length, 1);
});
test('identity guard rejects clock-in and swap for a different user', async () => {
    const db = database();
    assert.equal((await load(clockIn, db).POST(post({ ...clockBody, userId: other }))).status, 401);
    assert.equal((await load(swap, db).POST(post({ userId: other, shiftId: shift, message: current.message }))).status, 401);
    assert.equal(db.state.attendance.length, 0);
    assert.equal(db.state.swap_requests.length, 0);
});
test('multi-image upload repeatedly uses the old image array and discards earlier uploaded URLs', async () => {
    const updates = [];
    let upload = 0;
    const handler = load('components/store-ops/ImageUpload.tsx', database(), {
        extract: 'handleUpload',
        globals: {
            images: [], maxImages: 5, setError() {}, setUploading() {}, inputRef: { current: null },
            uploadAction: async () => ({ success: true, url: `https://fictional.invalid/${++upload}.png` }),
            onChange: images => updates.push(images),
        },
    });
    await handler.run({ target: { files: [new File(['a'], 'a.png'), new File(['b'], 'b.png')] } });
    assert.equal(updates.length, 2);
    assert.equal(updates[1].length, 1);
    assert.equal(updates[1][0], 'https://fictional.invalid/2.png');
});
test('legacy override approval ignores request date and reopens all records since today', async () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const req = { ...current, message: 'OVERRIDE REQUEST: Accidental check-out on 2020-01-01' };
    const db = database({ swap_requests: [req], attendance: [{ ...active, check_in: `${today}T12:00:00Z`, check_out: `${today}T13:00:00Z` }, { ...active, id: other, check_in: `${today}T14:00:00Z`, check_out: `${today}T15:00:00Z` }] });
    await load('components/admin/OverridesList.tsx', db, { extract: 'handleApprove', globals: { fetchOverrides: async () => {} } }).run(req);
    assert.equal(db.state.attendance.filter(row => row.check_out === null).length, 2);
    assert.equal(db.state.swap_requests[0].status, 'approved');
});
