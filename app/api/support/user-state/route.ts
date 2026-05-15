import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/support/user-state?userId=<uuid>
 * Returns the admin state (status, suspended_until) for the given user.
 */
export async function GET(request: NextRequest) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const admin = createClient(url, key, { auth: { persistSession: false } });

    const { data, error } = await admin
        .from('user_admin_states')
        .select('status, suspended_until')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        status: data?.status || 'active',
        suspended_until: data?.suspended_until || null,
    });
}
