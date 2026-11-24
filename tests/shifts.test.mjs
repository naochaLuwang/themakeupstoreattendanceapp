import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

class StoreDate extends Date {
    constructor(value) { super(value === undefined ? '2026-11-24T06:00:00Z' : value); }
    static now() { return Date.parse('2026-11-24T06:00:00Z'); }
}

function load(entry, stubs = {}) {
    const cache = new Map();
    const context = vm.createContext({ Date: StoreDate, Intl, Error });
    function moduleAt(file) {
        if (cache.has(file)) return cache.get(file);
        const mod = { exports: {} };
        cache.set(file, mod.exports);
        const js = ts.transpileModule(readFileSync(file, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
        }).outputText;
        vm.runInContext(`(function(require,module,exports){${js}\n})`, context)(name => {
            if (name in stubs) return stubs[name];
            const path = name.startsWith('@/') ? resolve(name.slice(2)) : resolve(dirname(file), name);
            return moduleAt(`${path}.ts`);
        }, mod, mod.exports);
        return mod.exports;
    }
    return moduleAt(resolve(entry));
}

const EMP = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const source = { id: '00000000-0000-4000-8000-000000000010', employee_id: EMP, start_time: '2026-11-24T10:00:00Z', end_time: '2026-11-24T18:00:00Z', shift_label: 'Day', status: 'scheduled', attendance_started_at: null };
const target = { ...source, id: '00000000-0000-4000-8000-000000000011', start_time: '2026-11-25T12:00:00Z', end_time: '2026-11-25T20:00:00Z', shift_label: 'Late' };
const request = { id: '00000000-0000-4000-8000-000000000020', shift_id: source.id, requestor_id: EMP, receiver_id: EMP, status: 'pending', message: 'Shift Change: Move from Day to Late for 2026-11-24' };
const rules = load('lib/shifts/rules.ts');

function client(extra = {}, fail = () => null) {
    const data = { shifts: [source, target], attendance: [], swap_requests: [request], shift_presets: [{ id: OTHER, label: 'Late', start_time: '12:00:00', end_time: '20:00:00' }], ...structuredClone(extra) };
    const calls = [];
    const db = {
        calls, data,
        async rpc(name, payload) { calls.push({ table: name, operation: 'rpc', payload }); return { data: null, error: fail({ table: name, operation: 'rpc' }) }; },
        from(table) {
            const query = { table, operation: 'select', filters: [], payload: null, one: false };
            const chain = new Proxy({}, { get(_unused, method) {
                if (method === 'then') return (resolveResult, reject) => Promise.resolve().then(() => {
                    calls.push(query);
                    const error = fail(query);
                    if (error) return { data: null, error };
                    let rows = (data[table] || []).filter(row => query.filters.every(([op, key, value]) => {
                        if (op === 'eq') return row[key] === value;
                        if (op === 'neq') return row[key] !== value;
                        if (op === 'in') return value.includes(row[key]);
                        if (op === 'gte') return Date.parse(row[key]) >= Date.parse(value);
                        if (op === 'lt') return Date.parse(row[key]) < Date.parse(value);
                        return true;
                    }));
                    if (query.operation === 'insert') {
                        rows = [structuredClone(query.payload)];
                        data[table].push(...rows);
                    }
                    return { data: structuredClone(query.one ? rows[0] || null : rows), error: null };
                }).then(resolveResult, reject);
                return (...args) => {
                    if (['eq', 'neq', 'in', 'gte', 'lt'].includes(method)) query.filters.push([method, ...args]);
                    if (method === 'single') query.one = true;
                    if (method === 'insert') { query.operation = method; query.payload = args[0]; }
                    return chain;
                };
            } });
            return chain;
        },
    };
    return db;
}

test('attendance permanently locks its exact shift, regardless of checkout state', () => {
    for (const check_out of [null, '2026-11-24T08:00:00Z']) {
        assert.equal(rules.isShiftLocked(source, [{ shift_id: source.id, employee_id: EMP, check_in: '2026-11-24T04:30:00Z', check_out }]), true);
    }
    assert.equal(rules.isShiftLocked({ ...source, attendance_started_at: '2026-11-24T04:30Z' }, []), true);
    assert.equal(rules.isShiftLocked(target, [{ shift_id: source.id, employee_id: EMP, check_in: '2026-11-24T04:30Z' }]), false);
});

test('unlinked attendance uses the IST business date, including before UTC midnight', () => {
    assert.equal(rules.isShiftLocked(source, [{ shift_id: null, employee_id: EMP, check_in: '2026-11-23T20:00:00Z' }]), true);
    assert.equal(rules.isShiftLocked(source, [{ shift_id: null, employee_id: OTHER, check_in: '2026-11-23T20:00:00Z' }]), false);
});

test('date exchanges identify the actual working shift from either direction', () => {
    const message = 'Request to work on my off day 2026-11-25 and take 2026-11-24 off instead.';
    assert.equal(rules.parseShiftRequest(message, '2026-11-24', false).targetDate, '2026-11-25');
    assert.throws(() => rules.parseShiftRequest(message, '2026-11-26', false), /valid shift exchange/);
    assert.throws(() => rules.parseShiftRequest('OVERRIDE REQUEST: 2026-11-24', '2026-11-24', false), /re-entry/);
});

test('moving a schedule preserves its duration and overnight end offset', () => {
    const moved = rules.moveShift({ ...source, start_time: '2026-11-24T22:00:00Z', end_time: '2026-11-25T06:00:00Z' }, '2026-11-26');
    assert.equal(moved.start_time, '2026-11-26T22:00:00.000Z');
    assert.equal(moved.end_time, '2026-11-27T06:00:00.000Z');
});

test('submission rejects linked completed attendance and never writes a request', async () => {
    const db = client({ attendance: [{ shift_id: source.id, employee_id: EMP, check_in: '2026-11-24T04:30Z', check_out: '2026-11-24T05:30Z' }] });
    await assert.rejects(load('lib/shifts/service.ts').submitShiftRequest(db, EMP, source.id, request.message, null), /Attendance has already started/);
    assert.equal(db.calls.some(call => call.operation === 'insert'), false);
});

test('active attendance on today’s shift does not block a future unworked request', async () => {
    const db = client({ attendance: [{ shift_id: source.id, employee_id: EMP, check_in: '2026-11-24T04:30Z' }] });
    await load('lib/shifts/service.ts').submitShiftRequest(db, EMP, target.id, 'Shift Change: Move from Late to Day for 2026-11-25', 'Please change tomorrow.');
    assert.equal(db.calls.filter(call => call.operation === 'insert').length, 1);
});

test('either side of a date exchange is checked for attendance', async () => {
    const db = client({ shifts: [source, { ...target, attendance_started_at: '2026-11-25T04:30Z' }] });
    await assert.rejects(load('lib/shifts/service.ts').submitShiftRequest(db, EMP, source.id, 'Swap my shift on 2026-11-24 with shift on 2026-11-25.', null), /Attendance has already started/);
});

test('failed attendance reads stop a request instead of treating it as unworked', async () => {
    const db = client({}, query => query.table === 'attendance' ? { message: 'Injected read failure' } : null);
    await assert.rejects(load('lib/shifts/service.ts').submitShiftRequest(db, EMP, source.id, request.message, null), /Could not verify attendance/);
    assert.equal(db.calls.some(call => call.operation === 'insert'), false);
});

test('foreign and past shifts are rejected before submission', async () => {
    const service = load('lib/shifts/service.ts');
    await assert.rejects(service.submitShiftRequest(client({ shifts: [{ ...source, employee_id: OTHER }] }), EMP, source.id, request.message, null), /no longer belongs/);
    await assert.rejects(service.submitShiftRequest(client({ shifts: [{ ...source, start_time: '2026-11-23T10:00Z' }] }), EMP, source.id, 'Shift Change: Move from Day to Late for 2026-11-23', null), /Past shifts/);
});

test('approval uses one RPC with the exact preset and expected schedule snapshot', async () => {
    const db = client();
    await load('lib/shifts/service.ts').reviewShiftRequest(db, request.id, 'approved');
    const rpc = db.calls.filter(call => call.operation === 'rpc');
    assert.equal(rpc.length, 1);
    assert.equal(rpc[0].payload.p_changes[0].start_time, '2026-11-24T12:00:00Z');
    assert.equal(rpc[0].payload.p_request_id, request.id);
    assert.equal(rpc[0].payload.p_expected[0].start_time, source.start_time);
    assert.equal(db.calls.some(call => call.operation === 'update'), false);
    assert.ok(db.calls.find(call => call.table === 'shift_presets').filters.some(([op,key,value]) => op === 'eq' && key === 'label' && value === 'Late'));
});

test('two-day approval submits both sides together and preserves IDs on their dates', async () => {
    const db = client({ swap_requests: [{ ...request, message: 'Swap my shift on 2026-11-24 with shift on 2026-11-25.' }] });
    await load('lib/shifts/service.ts').reviewShiftRequest(db, request.id, 'approved');
    const payload = db.calls.find(call => call.operation === 'rpc').payload;
    assert.equal(payload.p_changes.length, 2);
    assert.equal(payload.p_changes[0].id, source.id);
    assert.equal(payload.p_changes[0].start_time, '2026-11-24T12:00:00.000Z');
    assert.equal(payload.p_changes[1].id, target.id);
    assert.equal(payload.p_changes[1].start_time, '2026-11-25T10:00:00.000Z');
});

test('an overnight preset keeps its end on the following day', async () => {
    const db = client({ shift_presets: [{ id: OTHER, label: 'Late', start_time: '22:00:00', end_time: '06:00:00' }] });
    await load('lib/shifts/service.ts').reviewShiftRequest(db, request.id, 'approved');
    assert.equal(db.calls.find(call => call.operation === 'rpc').payload.p_changes[0].end_time, '2026-11-25T06:00:00.000Z');
});

test('peer approval sends both employee assignments in the same transaction', async () => {
    const peerShift = { ...target, employee_id: OTHER, start_time: '2026-11-24T12:00:00Z', end_time: '2026-11-24T20:00:00Z' };
    const db = client({ shifts: [source, peerShift], swap_requests: [{ ...request, receiver_id: OTHER, message: 'Peer swap' }] });
    await load('lib/shifts/service.ts').reviewShiftRequest(db, request.id, 'approved');
    const payload = db.calls.find(call => call.operation === 'rpc').payload;
    assert.equal(payload.p_changes.length, 2);
    assert.equal(payload.p_changes[0].employee_id, OTHER);
    assert.equal(payload.p_changes[1].employee_id, EMP);
});

test('cancelled requests cannot be approved and database conflicts are shown clearly', async () => {
    const service = load('lib/shifts/service.ts');
    const cancelled = client({ swap_requests: [{ ...request, status: 'cancelled' }] });
    await assert.rejects(service.reviewShiftRequest(cancelled, request.id, 'approved'), /no longer pending/);
    assert.equal(cancelled.calls.some(call => call.operation === 'rpc'), false);
    const conflict = client({}, query => query.operation === 'rpc' ? { message: 'SHIFT_ATTENDANCE_LOCKED: conflict' } : null);
    await assert.rejects(service.reviewShiftRequest(conflict, request.id, 'approved'), /Attendance has already started/);
});

test('missing migration fails closed with an actionable message', async () => {
    const db = client({}, query => query.operation === 'rpc' ? { message: 'function not found', code: 'PGRST202' } : null);
    await assert.rejects(load('lib/shifts/service.ts').reviewShiftRequest(db, request.id, 'approved'), /Apply database migration 005/);
});
