import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const storeId = 'ab3415b5-a5af-4987-badb-1d51f5263798';

function load(file, dependencies) {
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const exports = {};
    new Function('exports', 'require', source)(exports, name => dependencies[name] ?? require(name));
    return exports;
}

function form(values = {}) {
    const data = new FormData();
    for (const [name, value] of Object.entries({
        fullName: 'Sample Employee', email: 'Staff@Example.test', username: 'Staff.One',
        password: 'sample-password', storeId, ...values,
    })) data.set(name, value);
    return data;
}

function fixture({ role = 'admin', failProfile = false } = {}) {
    const accounts = new Map();
    const profiles = new Map();
    const client = {
        from(table) {
            return {
                select: () => ({
                    eq: (key, value) => {
                        const rows = [...profiles.values()].filter(profile => profile[key] === value);
                        return {
                            limit: () => ({ data: rows.slice(0, 1) }),
                            single: () => ({ data: rows.length === 1 ? rows[0] : null }),
                            maybeSingle: () => ({ data: table === 'stores' && value === storeId ? { id: storeId } : null }),
                        };
                    },
                }),
                upsert(profile) {
                    if (failProfile) return { error: { code: '23505' } };
                    profiles.set(profile.id, profile);
                    return { error: null };
                },
            };
        },
        auth: {
            admin: {
                createUser(details) {
                    if (accounts.has(details.email)) return { error: { message: 'Email already registered' } };
                    accounts.set(details.email, details);
                    return { data: { user: { id: details.email } } };
                },
                deleteUser(id) {
                    accounts.delete(id);
                    profiles.delete(id);
                    return { error: null };
                },
            },
            signInWithPassword({ email, password }) {
                const account = accounts.get(email);
                return { error: account?.email_confirm && account.password === password ? null : 'Invalid login' };
            },
        },
    };
    const { createNewUser } = load('app/actions/admin.ts', {
        '@/lib/admin-client': {
            getStaffAccess: () => ({ client, profile: { role, store_id: storeId } }),
            createServiceClient: () => client,
        },
    });
    const { POST } = load('app/api/auth/login/route.ts', {
        '@/lib/supabase/server': { createClient: () => client },
        '@/lib/rate-limit': { rateLimit: () => true },
        'next/server': { NextResponse: Response },
    });
    return { createNewUser, POST, accounts, profiles };
}

test('new profile works with the employee sign-in route and always has employee privileges', async () => {
    const { createNewUser, POST, profiles } = fixture();
    const result = await createNewUser(form({ role: 'admin' }));
    assert.deepEqual(result, { success: true, username: 'staff.one' });
    assert.equal(profiles.get('staff@example.test').role, 'employee');
    const response = await POST(new Request('https://example.test/api/auth/login', {
        method: 'POST', body: form({ username: result.username }),
    }));
    assert.deepEqual(await response.json(), { success: true });
});

test('only admins can create accounts, and a branch admin is limited to their store', async () => {
    for (const role of ['manager', 'employee']) {
        const { createNewUser, accounts } = fixture({ role });
        assert.ok((await createNewUser(form())).error);
        assert.equal(accounts.size, 0);
    }
    const { createNewUser, accounts } = fixture();
    assert.ok((await createNewUser(form({ storeId: '7dac5515-59de-4e4b-804f-20cce8914817' }))).error);
    assert.equal(accounts.size, 0);
});

test('invalid input, duplicate credentials and failed profile creation leave existing accounts intact', async () => {
    const { createNewUser, accounts } = fixture();
    assert.ok((await createNewUser(form({ password: 'short' }))).error);
    assert.equal(accounts.size, 0);
    assert.ok((await createNewUser(form())).success);
    assert.ok((await createNewUser(form({ email: 'second@example.test' }))).error);
    assert.ok((await createNewUser(form({ username: 'another' }))).error);
    assert.equal(accounts.size, 1);
    const failed = fixture({ failProfile: true });
    assert.ok((await failed.createNewUser(form())).error);
    assert.equal(failed.accounts.size, 0);
});
