import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const origin = 'https://attendance.test';
function fixture({ unsubscribeFails = false, storageFails = false } = {}) {
    const calls = [];
    const registration = (path, scope = origin + '/') => ({
        scope, active: { scriptURL: origin + path },
        pushManager: { getSubscription: async () => ({ unsubscribe: async () => { calls.push('unsubscribe:' + path); if (unsubscribeFails) throw new Error('Permission denied'); } }) },
        unregister: async () => { calls.push('unregister:' + path); return true; },
    });
    const caches = {
        keys: async () => { if (storageFails) throw new Error('Storage denied'); return ['navigation-cache', 'start-url', `workbox-precache-v2-${origin}/`, 'other-app-cache', `workbox-precache-v2-${origin}/another/`]; },
        delete: async name => { calls.push('delete:' + name); return true; },
    };
    const window = { location: { origin }, caches };
    const navigator = { serviceWorker: { getRegistrations: async () => [registration('/MUS-SW.js'), registration('/sw.js'), registration('/other-worker.js'), registration('/sw.js', origin + '/another/')] } };
    const compiledModule = { exports: {} };
    const code = ts.transpileModule(readFileSync('lib/browser/retire-pwa.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    vm.runInNewContext(`(function(module,exports){${code}\n})(compiledModule,compiledModule.exports)`, { compiledModule, window, navigator, URL, Promise });
    return { ...compiledModule.exports, calls };
}
test('retirement unsubscribes/unregisters only the former app workers and clears only their caches', async () => {
    const app = fixture(); await app.retirePwa();
    assert.deepEqual(app.calls.filter(value => value.startsWith('unregister:')).sort(), ['unregister:/MUS-SW.js', 'unregister:/sw.js']);
    assert.deepEqual(app.calls.filter(value => value.startsWith('delete:')).sort(), ['delete:navigation-cache', 'delete:start-url', `delete:workbox-precache-v2-${origin}/`].sort());
    assert.ok(app.calls.includes('unsubscribe:/MUS-SW.js'));
});
test('subscription failure still unregisters the old worker and denied cache storage does not interrupt startup', async () => {
    const app = fixture({ unsubscribeFails: true, storageFails: true });
    await app.retirePwa();
    assert.equal(app.calls.filter(value => value.startsWith('unregister:')).length, 2);
});
test('the old worker URL activates its replacement and removes itself without page navigation', async () => {
    const handlers = new Map(); const calls = [];
    const self = { location: { origin }, addEventListener: (name, handler) => handlers.set(name, handler), skipWaiting: async () => calls.push('activate-now'), registration: { unregister: async () => calls.push('unregister') } };
    const caches = { keys: async () => ['navigation-cache', 'unrelated'], delete: async name => calls.push(name) };
    vm.runInNewContext(readFileSync('public/MUS-SW.js', 'utf8'), { self, caches, Promise });
    let wait;
    handlers.get('install')({ waitUntil: value => { wait = value; } }); await wait;
    handlers.get('activate')({ waitUntil: value => { wait = value; } }); await wait;
    assert.deepEqual(calls, ['activate-now', 'navigation-cache', 'unregister']);
    assert.equal(handlers.has('fetch'), false); assert.equal(handlers.has('push'), false);
});
test('the retirement worker unregisters even when Cache Storage is unavailable', async () => {
    let unregistered = false; let activation;
    const self = { location: { origin }, addEventListener: (name, handler) => { if (name === 'activate') activation = handler; }, registration: { unregister: async () => { unregistered = true; } } };
    vm.runInNewContext(readFileSync('public/MUS-SW.js', 'utf8'), { self, caches: { keys: async () => { throw new Error('Storage denied'); } }, Promise });
    let work; activation({ waitUntil: value => { work = value; } });
    await work; assert.equal(unregistered, true);
});
