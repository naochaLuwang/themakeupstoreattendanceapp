import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function compile(file, imports) {
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, esModuleInterop: true },
    }).outputText;
    const compiled = { exports: {} };
    vm.runInNewContext(`(function(require,module,exports){${source}\n})`, {
        URL, URLSearchParams, process: { env: {} },
    })(name => {
        assert.ok(name in imports, `Unexpected dependency: ${name}`);
        return imports[name];
    }, compiled, compiled.exports);
    return compiled.exports;
}
const information = compile('lib/app-information.ts', {
    '@/mobile/app.json': JSON.parse(readFileSync('mobile/app.json', 'utf8')),
});
const routes = compile('lib/public-information-routes.ts', {});

test('only the exact policy and support URLs bypass the staff sign-in gate', async () => {
    let authReads = 0;
    const { proxy } = compile('proxy.ts', {
        '@/lib/public-information-routes': routes,
        'next/server': { NextResponse: { next: () => ({ kind: 'next' }), redirect: url => ({ kind: 'redirect', path: url.pathname }) } },
        '@supabase/ssr': { createServerClient: () => {
            authReads++;
            return { auth: { getUser: async () => ({ data: { user: null } }) } };
        } },
    });
    for (const { href } of routes.publicInformationLinks) {
        const result = await proxy({ nextUrl: { pathname: href } });
        assert.equal(result.kind, 'next');
    }
    assert.equal(authReads, 0);
    for (const path of ['/employee', '/employee/profile', '/admin', '/privacy-extra', '/privacy/private', '/support/admin', '/account-deletion-extra']) {
        const result = await proxy({ nextUrl: { pathname: path }, url: 'https://fixture.test' + path });
        assert.equal(result.kind, 'redirect');
        assert.equal(result.path, '/login');
    }
    assert.equal(authReads, 7);
});

test('support and deletion links address the approved inbox and encode message content for mail clients', () => {
    const href = information.supportEmailHref('Account & data request', 'Name:\nRequest: deletion');
    const url = new URL(href);
    assert.equal(url.pathname, 'luwangtech0@gmail.com');
    assert.equal(url.searchParams.get('subject'), 'Account & data request');
    assert.equal(url.searchParams.get('body'), 'Name:\nRequest: deletion');
    assert.ok(!href.includes('+'));
    assert.ok(href.includes('%0A'));
});
