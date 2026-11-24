/* Packaged with Android and injected only into the configured workspace origin.
   No form submission, attendance replay or automatic page reload happens here. */
(() => {
    function install() {
        if (window.__hrmNative || !window.Capacitor?.nativePromise) return;
        const root = document.documentElement;
        root.classList.add('hrm-native');
        let lastInteraction = 0;
        let lastNotice = '';
        let lastConnected;
        let focusTimer;
        const bridge = (method, options = {}) => window.Capacitor.nativePromise('AppExperience', method, options).catch(() => {});
        const feedback = kind => bridge('feedback', { kind });
        // Older hosted pages reload on generic network/AbortError failures.
        // Android owns connection recovery, so those errors must not erase a form.
        window.selfHeal = async () => {};

        function appearance() { void bridge('appearance', { dark: root.classList.contains('dark') }); }
        function connection(connected) {
            if (connected === lastConnected) return;
            lastConnected = connected;
            root.toggleAttribute('data-native-offline', !connected);
            window.dispatchEvent(new CustomEvent('hrm:connection', { detail: { connected } }));
            // Reconnection never reloads the page or resubmits a pending operation.
        }
        function keyboard(open) {
            root.toggleAttribute('data-native-keyboard', open);
            if (open) {
                window.clearTimeout(focusTimer);
                focusTimer = window.setTimeout(() => {
                    const input = document.activeElement;
                    if (input?.matches('input,textarea,select,[contenteditable="true"]')) input.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                }, 150);
            }
        }
        function back() {
            const dialog = document.querySelector('dialog[open]');
            if (dialog) {
                if (typeof dialog.requestClose === 'function') dialog.requestClose();
                else if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
                return 'handled';
            }
            const menu = Array.from(document.querySelectorAll('button[aria-expanded="true"]'))
                .find(button => button.getClientRects().length && button.matches('[aria-haspopup], [aria-controls]'));
            if (menu) { menu.click(); return 'handled'; }
            return 'unhandled';
        }
        function resume() {
            appearance();
            window.dispatchEvent(new Event('hrm:resume'));
        }
        window.__hrmNative = { feedback, connection, keyboard, back, resume };
        new MutationObserver(appearance).observe(root, { attributes: true, attributeFilter: ['class'] });
        document.addEventListener('click', event => {
            if (!event.isTrusted || !(event.target instanceof Element)) return;
            lastInteraction = Date.now();
            const control = event.target.closest('button,a,[role="button"],input[type="checkbox"],input[type="radio"]');
            if (!control || control.closest('[data-native-feedback="explicit"]') || control.matches(':disabled,[aria-disabled="true"]')) return;
            void feedback('selection');
        }, { capture: true, passive: true });
        let legacySwipe;
        document.addEventListener('pointerdown', event => {
            if (!event.isTrusted) return;
            lastInteraction = Date.now();
            lastNotice = '';
            const button = event.target instanceof Element ? event.target.closest('button[aria-label^="Swipe to clock"]') : null;
            if (button && !button.closest('[data-native-feedback="explicit"]')) {
                legacySwipe = { id: event.pointerId, start: event.clientX, max: button.parentElement.clientWidth - button.offsetWidth - 12, armed: false };
            }
        }, { capture: true, passive: true });
        document.addEventListener('pointermove', event => {
            if (!legacySwipe || legacySwipe.id !== event.pointerId || legacySwipe.max <= 0) return;
            const armed = event.clientX - legacySwipe.start >= legacySwipe.max * .9;
            if (armed && !legacySwipe.armed) void feedback('selection');
            legacySwipe.armed = armed;
        }, { capture: true, passive: true });
        document.addEventListener('pointerup', event => {
            if (!legacySwipe || legacySwipe.id !== event.pointerId) return;
            if (legacySwipe.armed) void feedback('impact');
            legacySwipe = undefined;
        }, { capture: true, passive: true });
        document.addEventListener('pointercancel', () => { legacySwipe = undefined; }, { passive: true });
        document.addEventListener('focusin', () => { if (root.hasAttribute('data-native-keyboard')) keyboard(true); });
        // Older hosted pages get outcome feedback too. New code calls the plugin
        // explicitly; native coalescing avoids a duplicate from the same toast.
        new MutationObserver(records => {
            if (!lastInteraction || Date.now() - lastInteraction > 60000) return;
            for (const record of records) {
                const parent = record.target.nodeType === Node.ELEMENT_NODE ? record.target : record.target.parentElement;
                const candidates = new Set();
                if (parent?.matches('.employee-toast,[data-sonner-toast],[role="alert"]')) candidates.add(parent);
                if (parent?.closest('.employee-toast,[data-sonner-toast],[role="alert"]')) candidates.add(parent.closest('.employee-toast,[data-sonner-toast],[role="alert"]'));
                for (const node of record.addedNodes) {
                    if (!(node instanceof Element)) continue;
                    if (node.matches('.employee-toast,[data-sonner-toast],[role="alert"]')) candidates.add(node);
                    node.querySelectorAll('.employee-toast,[data-sonner-toast],[role="alert"]').forEach(item => candidates.add(item));
                }
                for (const notice of candidates) {
                    const text = (notice.textContent || '').trim();
                    if (!text || text === lastNotice || !notice.getClientRects().length) continue;
                    const success = notice.dataset.type === 'success' || /clocked in|clocked out|successfully|\bsaved\b|\bapproved\b/i.test(text);
                    const error = notice.dataset.type === 'error' || notice.getAttribute('role') === 'alert' || /failed|could not|couldn’t|unable|timed out/i.test(text);
                    if (success || error) { lastNotice = text; void feedback(error ? 'error' : 'success'); }
                }
            }
        }).observe(document.body, { childList: true, subtree: true, characterData: true });
        window.addEventListener('offline', () => connection(false));
        window.addEventListener('online', event => {
            // The older next-pwa bundle registers an automatic reload here.
            // Android owns reconnects; its read-only hrm:connection signal keeps
            // forms intact instead of dispatching legacy reload callbacks.
            event.stopImmediatePropagation();
            connection(window.__hrmConnected !== false);
        }, { capture: true });
        appearance();
        connection(window.__hrmConnected !== false && navigator.onLine !== false);
        requestAnimationFrame(() => requestAnimationFrame(() => { void bridge('ready'); }));
    }
    if (document.body) install();
    else document.addEventListener('DOMContentLoaded', install, { once: true });
})();
