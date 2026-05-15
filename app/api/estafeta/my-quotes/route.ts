import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
    const auth = req.headers.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    return match?.[1] ?? null;
}

export async function GET(req: NextRequest) {
    try {
        const token = getBearerToken(req);
        if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 401 });

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
        const sb = createClient(supabaseUrl, supabaseAnon, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });

        const { data: userData, error: userErr } = await sb.auth.getUser(token);
        if (userErr || !userData.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = supabaseAdmin();

        const { data: quotes, error: qErr } = await admin
            .from('estafeta_quotes')
            .select('id, status, calculated_cost, sender_name, sender_city, sender_state, sender_postal_code, recipient_name, recipient_city, recipient_state, recipient_postal_code, guide_file_url, guide_uploaded_at, created_at, paid_at, completed_at, weight_kg, length_cm, width_cm, height_cm')
            .eq('user_id', userData.user.id)
            .neq('status', 'quote')
            .order('created_at', { ascending: false })
            .limit(50);

        if (qErr) {
            console.error('[my-quotes] Error:', qErr);
            return NextResponse.json({ error: 'Error al cargar guías' }, { status: 500 });
        }

        return NextResponse.json({ ok: true, quotes: quotes || [] });
    } catch (e: any) {
        console.error('[my-quotes] Exception:', e);
        return NextResponse.json({ error: e.message || 'Error inesperado' }, { status: 500 });
    }
}
