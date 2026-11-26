import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { can, type Permission } from './permissions';
import { ZodError } from 'zod';

export async function operationsContext(permission?: Permission) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Sign in to continue.');
    const { data: profile, error: profileError } = await supabase.from('profiles').select('role, store_id').eq('id', user.id).single();
    if (profileError || !profile) throw new Error('Your staff profile could not be verified.');
    if (permission && !can(profile.role, permission)) throw new Error('You do not have permission for this action.');
    return { supabase, user, profile };
}

export function operationError(error: unknown) {
    let message = error instanceof ZodError ? error.issues[0]?.message || 'Check the form and try again.' : error instanceof Error ? error.message : 'The request could not be completed. Please retry.';
    if (/row-level security|permission denied/i.test(message)) message = 'This record is unavailable or outside your permissions.';
    else if (/schema cache|function .*does not exist|relation .*does not exist|column .*does not exist/i.test(message)) message = 'Store Operations needs a database update. Ask your administrator.';
    else if (/violates .*constraint|invalid input syntax/i.test(message)) message = 'Check the form values and try again.';
    return { success: false as const, data: undefined, error: message };
}
