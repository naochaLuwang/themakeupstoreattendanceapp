import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Run the actual TypeScript service against controlled browser APIs, without GPS or database writes.
function loadService(geolocation, { fastDeadline = false, secure = true } = {}) {
    const cleared = [];
    const context = vm.createContext({
        Date, Error, DOMException,
        navigator: { geolocation: geolocation ? { ...geolocation, clearWatch: id => cleared.push(id) } : undefined },
        window: { isSecureContext: secure, setTimeout: (fn, ms) => setTimeout(fn, fastDeadline ? 10 : ms), clearTimeout },
    });
    function load(file) {
        const compiledModule = { exports: {} };
        const source = ts.transpileModule(readFileSync(file, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
        }).outputText;
        const factory = vm.runInContext(`(function(require, module, exports) { ${source}\n})`, context);
        factory(name => load(resolve(dirname(file), `${name}.ts`)), compiledModule, compiledModule.exports);
        return compiledModule.exports;
    }
    return { ...load(resolve('lib/attendance/location.ts')), cleared };
}
const store = { lat: 24.804, lng: 93.943, radius_meters: 100 };
const position = (overrides = {}, age = 0) => ({ timestamp: Date.now() - age, coords: { latitude: store.lat, longitude: store.lng, accuracy: 20, ...overrides } });

test('a recent, accurate nearby position needs no GPS watch', async () => {
    let watches = 0;
    const service = loadService({
        getCurrentPosition: success => queueMicrotask(() => success(position())),
        watchPosition: () => { watches++; return 7; },
    });
    const result = await service.getClockInLocation(store, () => assert.fail('unnecessary refinement'));
    assert.equal(result.coords.latitude, store.lat);
    assert.equal(watches, 0);
});

test('a quick timeout falls back to fresh GPS and releases the watch', async () => {
    let refining = 0;
    const service = loadService({
        getCurrentPosition: (_success, error) => queueMicrotask(() => error({ code: 3 })),
        watchPosition: (success, _error, options) => {
            assert.equal(options.enableHighAccuracy, true);
            assert.equal(options.maximumAge, 0);
            queueMicrotask(() => success(position()));
            return 7;
        },
    });
    await service.getClockInLocation(store, () => refining++);
    assert.equal(refining, 1);
    assert.deepEqual(service.cleared, [7]);
});

test('imprecise and stale readings are refined until a fresh accurate fix arrives', async () => {
    const service = loadService({
        getCurrentPosition: success => queueMicrotask(() => success(position({}, 60000))),
        watchPosition: success => {
            queueMicrotask(() => { success(position({ accuracy: 1500 })); success(position({ accuracy: 15 })); });
            return 8;
        },
    });
    const result = await service.getClockInLocation(store, () => {});
    assert.equal(result.coords.accuracy, 15);
    assert.deepEqual(service.cleared, [8]);
});

test('an outside quick fix is retried before rejecting someone at the store', async () => {
    const service = loadService({
        getCurrentPosition: success => queueMicrotask(() => success(position({ latitude: 25 }))),
        watchPosition: success => { queueMicrotask(() => success(position())); return 9; },
    });
    const result = await service.getClockInLocation(store, () => {});
    assert.equal(result.coords.latitude, store.lat);
});

test('permission denial gives actionable feedback without repeated prompts', async () => {
    const service = loadService({
        getCurrentPosition: (_success, error) => queueMicrotask(() => error({ code: 1 })),
        watchPosition: () => assert.fail('must not retry a denied permission'),
    });
    await assert.rejects(service.getClockInLocation(store, () => {}), /Allow location access/);
});

test('persistent poor accuracy ends with guidance and stops tracking', async () => {
    const service = loadService({
        getCurrentPosition: success => queueMicrotask(() => success(position({ accuracy: 1000 }))),
        watchPosition: success => { queueMicrotask(() => success(position({ accuracy: 500 }))); return 10; },
    }, { fastDeadline: true });
    await assert.rejects(service.getClockInLocation(store, () => {}), /not precise enough/);
    assert.deepEqual(service.cleared, [10]);
});

test('a stalled location provider has a deadline', async () => {
    const service = loadService({ getCurrentPosition: () => {}, watchPosition: () => 11 }, { fastDeadline: true });
    await assert.rejects(service.getClockInLocation(store, () => {}), /Location timed out/);
    assert.deepEqual(service.cleared, [11]);
});

test('leaving the page cancels GPS refinement and clears the watch', async () => {
    const controller = new AbortController();
    const service = loadService({
        getCurrentPosition: (_success, error) => queueMicrotask(() => error({ code: 2 })),
        watchPosition: () => { queueMicrotask(() => controller.abort()); return 12; },
    });
    await assert.rejects(service.getClockInLocation(store, () => {}, controller.signal), { name: 'AbortError' });
    assert.deepEqual(service.cleared, [12]);
});

test('unsupported location fails clearly', async () => {
    const service = loadService(undefined);
    await assert.rejects(service.getClockInLocation(store, () => {}), /Location is unavailable in this browser/);
});

test('store day is correct before UTC midnight', () => {
    const source = ts.transpileModule(readFileSync('lib/attendance/date.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const compiledModule = { exports: {} };
    vm.runInNewContext(`(function(module,exports) { ${source}\n})`, {})(compiledModule, compiledModule.exports);
    assert.equal(compiledModule.exports.getAttendanceDate(new Date('2026-11-22T19:00:00Z')), '2026-11-23');
});
