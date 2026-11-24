import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('mobile/native-experience.js', 'utf8');

function setup() {
    const calls = [];
    const listeners = new Map();
    const windowListeners = new Map();
    const attributes = new Set();
    const classes = new Set();
    let modal = null;
    let reloads = 0;
    class Element {}
    const root = {
        classList: { add: name => classes.add(name), contains: name => classes.has(name) },
        toggleAttribute: (name, on) => on ? attributes.add(name) : attributes.delete(name),
        hasAttribute: name => attributes.has(name),
    };
    const document = {
        documentElement: root, body: {}, activeElement: null,
        querySelector: selector => selector === 'dialog[open]' ? modal : null,
        querySelectorAll: () => [],
        addEventListener: (name, handler) => { const items = listeners.get(name) || []; items.push(handler); listeners.set(name, items); },
    };
    const dispatched = [];
    const window = {
        Capacitor: { nativePromise: async (plugin, method, options) => calls.push({ plugin, method, options }) },
        selfHeal: async () => { reloads++; },
        addEventListener(name, handler, options) {
            const items = windowListeners.get(name) || [];
            items.push({ handler, capture: Boolean(options?.capture) });
            windowListeners.set(name, items);
        },
        dispatchEvent: event => dispatched.push(event),
        setTimeout: () => 1, clearTimeout() {},
        location: { reload: () => { reloads++; } },
    };
    const context = vm.createContext({ window, document, navigator: { onLine: true }, Date, Promise, Element,
        Node: { ELEMENT_NODE: 1 }, Event, CustomEvent,
        MutationObserver: class { observe() {} }, requestAnimationFrame: callback => callback(),
    });
    vm.runInContext(source, context);
    return {
        window, calls, attributes, dispatched, root, Element, classes,
        again: () => vm.runInContext(source, context),
        fire: (name, event) => (listeners.get(name) || []).forEach(handler => handler(event)),
        fireWindow: (name, event) => {
            for (const item of [...(windowListeners.get(name) || [])].sort((a, b) => Number(b.capture) - Number(a.capture))) {
                item.handler(event);
                if (event.stopped) break;
            }
        },
        setModal: value => { modal = value; }, reloads: () => reloads,
    };
}

test('native bootstrap is idempotent and reports readiness once', () => {
    const app = setup();
    app.again();
    assert.ok(app.classes.has('hrm-native'));
    assert.equal(app.calls.filter(call => call.method === 'ready').length, 1);
});

test('offline/reconnect and legacy generic recovery never reload or replay a form', async () => {
    const app = setup();
    app.window.__hrmNative.connection(false);
    assert.ok(app.attributes.has('data-native-offline'));
    app.window.__hrmNative.connection(true);
    await app.window.selfHeal();
    assert.equal(app.attributes.has('data-native-offline'), false);
    assert.equal(app.reloads(), 0);
    assert.equal(app.calls.some(call => call.method === 'save' || call.method === 'submit'), false);
});

test('native reconnect suppresses the legacy PWA online-reload callback', () => {
    const app = setup();
    let legacyReloads = 0;
    app.window.addEventListener('online', () => { legacyReloads++; });
    app.window.__hrmNative.connection(false);
    const event = { stopped: false, stopImmediatePropagation() { this.stopped = true; } };
    app.fireWindow('online', event);
    assert.equal(legacyReloads, 0);
    assert.equal(app.attributes.has('data-native-offline'), false);
    assert.equal(app.reloads(), 0);
});

test('Android back closes the open dialog and respects a prevented cancellation', () => {
    const app = setup();
    let closed = 0;
    app.setModal({ dispatchEvent: () => true, close: () => { closed++; } });
    assert.equal(app.window.__hrmNative.back(), 'handled');
    assert.equal(closed, 1);
    app.setModal({ dispatchEvent: () => false, close: () => { closed++; } });
    assert.equal(app.window.__hrmNative.back(), 'handled');
    assert.equal(closed, 1);
    app.setModal(null);
    assert.equal(app.window.__hrmNative.back(), 'unhandled');
});

test('keyboard and resume emit app state without triggering navigation', () => {
    const app = setup();
    app.window.__hrmNative.keyboard(true);
    assert.ok(app.attributes.has('data-native-keyboard'));
    app.window.__hrmNative.keyboard(false);
    assert.equal(app.attributes.has('data-native-keyboard'), false);
    app.window.__hrmNative.resume();
    assert.ok(app.dispatched.some(event => event.type === 'hrm:resume'));
    assert.equal(app.reloads(), 0);
});

test('only actual enabled user interactions receive generic tap feedback', () => {
    const app = setup();
    const control = new app.Element();
    control.closest = () => null;
    control.matches = () => false;
    const target = new app.Element();
    target.closest = () => control;
    app.fire('click', { isTrusted: false, target });
    assert.equal(app.calls.filter(call => call.method === 'feedback').length, 0);
    app.fire('click', { isTrusted: true, target });
    assert.equal(app.calls.filter(call => call.method === 'feedback').length, 1);
    control.matches = () => true;
    app.fire('click', { isTrusted: true, target });
    assert.equal(app.calls.filter(call => call.method === 'feedback').length, 1);
});

test('legacy attendance swipes buzz at the threshold and release without submitting', () => {
    const app = setup();
    const button = new app.Element();
    button.parentElement = { clientWidth: 350 };
    button.offsetWidth = 56;
    button.closest = () => null;
    const target = new app.Element();
    target.closest = () => button;
    app.fire('pointerdown', { isTrusted: true, target, pointerId: 1, clientX: 10 });
    app.fire('pointermove', { pointerId: 1, clientX: 100 });
    assert.equal(app.calls.filter(call => call.method === 'feedback').length, 0);
    app.fire('pointermove', { pointerId: 1, clientX: 270 });
    app.fire('pointermove', { pointerId: 1, clientX: 280 });
    app.fire('pointerup', { pointerId: 1 });
    const kinds = app.calls.filter(call => call.method === 'feedback').map(call => call.options.kind);
    assert.deepEqual(kinds, ['selection', 'impact']);
    assert.equal(app.reloads(), 0);
});

function recovery(native) {
    const file = ts.createSourceFile('layout.tsx', readFileSync('app/layout.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let literal;
    function visit(node) {
        if (ts.isPropertyAssignment(node) && node.name.getText(file) === '__html') literal = node.initializer.getText(file);
        ts.forEachChild(node, visit);
    }
    visit(file);
    const script = vm.runInNewContext(`(${literal})`);
    const listeners = new Map();
    const storage = new Map();
    let reloads = 0;
    const window = {
        Capacitor: { isNativePlatform: () => native },
        location: { reload: () => { reloads++; } },
        addEventListener: (name, fn) => listeners.set(name, fn),
    };
    vm.runInNewContext(script, { window, navigator: {}, Date, console: { log() {} }, sessionStorage: {
        getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value),
    } });
    return { window, listeners, reloads: () => reloads };
}

test('the actual recovery script ignores native recovery and generic AbortError failures', async () => {
    const app = recovery(true);
    await app.window.selfHeal();
    app.listeners.get('unhandledrejection')({ reason: new Error('AbortError') });
    app.listeners.get('error')({ message: 'NetworkError' });
    assert.equal(app.reloads(), 0);
});

test('browser chunk recovery can reload only once per minute', async () => {
    const app = recovery(false);
    await app.window.selfHeal();
    await app.window.selfHeal();
    assert.equal(app.reloads(), 1);
});
