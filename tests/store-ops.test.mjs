import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function compile(file, imports = {}, globals = {}) {
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
    const context = vm.createContext({ Date, Number, Error, URL, Uint8Array, File, FormData, Blob, Response, Headers, AbortSignal, setTimeout, clearTimeout, crypto: { randomUUID }, ...globals });
    const compiledModule = { exports: {} };
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context)(name => name in imports ? imports[name] : require(name), compiledModule, compiledModule.exports);
    return compiledModule.exports;
}
const media = compile('lib/store-ops/media.ts');
const reports = compile('lib/store-ops/report-model.ts');
const exportsModule = compile('lib/store-ops/export.ts');

test('weekly reports cross month and year boundaries with exactly seven local dates', () => {
    const normalize = value => JSON.parse(JSON.stringify(value));
    assert.deepEqual(normalize(reports.reportRange('week', '2026-03-01')), { from: '2026-02-23', to: '2026-03-01' });
    assert.deepEqual(normalize(reports.reportRange('week', '2027-01-01')), { from: '2026-12-28', to: '2027-01-03' });
    assert.deepEqual(normalize(reports.reportRange('month', '2028-02-29')), { from: '2028-02-01', to: '2028-02-29' });
    assert.throws(() => reports.reportRange('month', '2026-02-30'));
});

test('CSV exports escape quotes, commas and formulas rather than executing spreadsheet input', () => {
    const csv = exportsModule.csvText(['Name', 'Value'], [['A, "quoted" name', '=1+1'], ['Safe', null]]);
    assert.ok(csv.includes('"A, ""quoted"" name"'));
    assert.ok(csv.includes('"\'=1+1"'));
    assert.ok(csv.includes('"Safe",""'));
});

test('legacy and private media references resolve through authentication and reject traversal', () => {
    const id = randomUUID();
    assert.equal(media.mediaPath(`https://example.supabase.co/storage/v1/object/public/store-images/tasks/${id}/a.jpg`), `tasks/${id}/a.jpg`);
    assert.ok(media.mediaUrl(`/api/store-ops/media?path=tasks/${id}/a.jpg`, true).endsWith('&thumbnail=1'));
    assert.equal(media.mediaPath('/api/store-ops/media?path=../secret'), null);
    assert.equal(media.mediaPath('https://external.invalid/photo.jpg'), null);
});

test('server form validation rejects negative quantities, invalid states and unsafe photo URLs', () => {
    const constants = compile('lib/store-ops/constants.ts');
    const validation = compile('lib/store-ops/validation.ts', { './constants': constants, './media': media });
    const damage = { barcode: '12345', product_name: 'Lipstick', damage_type: 'Broken', quantity: 1 };
    assert.equal(validation.damageSchema.safeParse(damage).success, true);
    assert.equal(validation.damageSchema.safeParse({ ...damage, quantity: -1 }).success, false);
    assert.equal(validation.damageSchema.safeParse({ ...damage, image_urls: ['https://untrusted.invalid/file'] }).success, false);
    assert.equal(validation.shelfSchema.safeParse({ section_id: randomUUID(), status: 'approved' }).success, false);
    assert.equal(validation.taskSchema.safeParse({ title: 'Clean', priority: 'high', is_recurring: true }).success, false);
});

test('uploads validate file signatures and size before any Storage request', async () => {
    const uploads = [];
    const id = randomUUID();
    const service = compile('lib/store-ops/uploads.ts', {
        'server-only': {}, './media': media,
        './context': { operationsContext: async () => ({ user: { id }, supabase: { storage: { from: () => ({ upload: async (path, file) => { uploads.push({ path, size: file.size }); return { error: null }; }, remove: async () => ({ error: null }) }) } } }), operationError: cause => ({ error: cause.message }) },
    });
    for (const file of [new File(['not a jpeg'], 'bad.jpg', { type: 'image/jpeg' }), new File([new Uint8Array(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })]) {
        const form = new FormData(); form.append('file', file);
        assert.ok((await service.uploadOperationsImage(form, 'tasks')).error);
    }
    assert.equal(uploads.length, 0);
    const valid = new FormData(); valid.append('file', new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'valid.jpg', { type: 'image/jpeg' }));
    const saved = await service.uploadOperationsImage(valid, 'tasks');
    assert.equal(saved.success, true);
    assert.equal(uploads.length, 1);
    assert.ok(saved.url.startsWith(`/api/store-ops/media?path=tasks/${id}/`));
});

test('operations worker HTTP authenticates before constructing any service client', async () => {
    const secret = randomUUID() + randomUUID();
    let calls = 0;
    const http = compile('app/api/internal/store-operations/run/route.ts', {
        'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } },
        '@/lib/store-ops/worker': { runOperationsWorker: async () => { calls++; return { claimed: 0 }; } },
    }, { process: { env: { STORE_OPERATIONS_WORKER_SECRET: secret } } });
    assert.equal((await http.POST({ headers: new Headers() })).status, 401);
    assert.equal(calls, 0);
    const response = await http.POST({ headers: new Headers({ authorization: `Bearer ${secret}` }) });
    assert.equal(response.body.success, true);
    assert.equal(calls, 1);
});

test('operations push uses a generic lock-screen message and preserves the safe destination', async () => {
    let message;
    const providers = compile('lib/notifications/providers.ts', {
        './config': { notificationProviders: () => ({ fcm: true }) },
        './validation': { notificationObject: input => input },
        './links': { notificationPath: input => input },
    }, { process: { env: {} } });
    const result = await providers.sendFcm({ allowed: true, provider: 'fcm', category: 'operations', credential: { token: 'fictional-registration-token' }, expiresAt: new Date(Date.now() + 600000).toISOString(), notificationId: randomUUID(), url: '/employee/store-operations/tasks' }, {
        projectId: 'fictional-project', getToken: async () => 'fictional-access-token', fetcher: async (_url, options) => { message = JSON.parse(options.body).message; return new Response('{}', { status: 200 }); },
    });
    assert.equal(result.outcome, 'sent');
    assert.equal(message.notification.title, 'Store operations update');
    assert.equal(message.data.url, '/employee/store-operations/tasks');
    assert.equal(message.android.collapse_key, 'hrm_operations');
});
