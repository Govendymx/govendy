import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

        // Get token from query or header
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
            req.nextUrl.searchParams.get('token') || '';

        if (!token) {
            return NextResponse.json({ error: 'Pass ?token=YOUR_JWT or Authorization header' }, { status: 401 });
        }

        // Validate user
        const supabase = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) {
            return NextResponse.json({ error: 'Invalid token', detail: userErr?.message }, { status: 401 });
        }

        const uid = userData.user.id;

        // Use admin client
        let db: any;
        let isAdmin = false;
        try {
            db = supabaseAdmin();
            isAdmin = true;
        } catch (e: any) {
            db = createClient(supabaseUrl, supabaseAnon, {
                auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
                global: { headers: { Authorization: `Bearer ${token}` } },
            });
        }

        // Query raw notifications
        const { data: notifs, error: notifErr } = await db
            .from('notifications')
            .select('id, user_id, type, title, is_read, created_at')
            .eq('user_id', uid)
            .order('created_at', { ascending: false })
            .limit(10);

        // Get table info
        const { data: cols, error: colsErr } = await db
            .rpc('', {}).catch(() => null) || { data: null, error: null };

        // Try a test update on the first notification
        let testUpdate = null;
        if (notifs && notifs.length > 0) {
            const testId = notifs[0].id;
            const testResult = await db
                .from('notifications')
                .update({ is_read: true })
                .eq('id', testId)
                .eq('user_id', uid)
                .select('id, is_read');
            testUpdate = {
                targetId: testId,
                result: testResult.data,
                error: testResult.error ? { code: testResult.error.code, message: testResult.error.message } : null,
                count: Array.isArray(testResult.data) ? testResult.data.length : 0,
            };

            // Re-read to confirm
            const recheck = await db
                .from('notifications')
                .select('id, is_read')
                .eq('id', testId)
                .single();
            testUpdate.recheck = recheck.data;
            testUpdate.recheckError = recheck.error ? { code: recheck.error.code, message: recheck.error.message } : null;
        }

        const resp = NextResponse.json({
            ok: true,
            uid,
            isAdmin,
            hasServiceKey,
            supabaseUrl: supabaseUrl.substring(0, 30) + '...',
            notificationCount: notifs?.length ?? 0,
            notifications: notifs?.map((n: any) => ({
                id: n.id,
                type: n.type,
                title: n.title?.substring(0, 30),
                is_read: n.is_read,
                is_read_type: typeof n.is_read,
                created_at: n.created_at,
            })),
            notifError: notifErr ? { code: notifErr.code, message: notifErr.message } : null,
            testUpdate,
        });
        resp.headers.set('Cache-Control', 'no-store, max-age=0');
        return resp;
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
