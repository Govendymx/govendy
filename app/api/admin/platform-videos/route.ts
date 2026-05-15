import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

async function checkAdmin(req: NextRequest) {
    const auth = await requireAuth(req);
    const admin = supabaseAdmin();
    const { data } = await admin
        .from('admin_users')
        .select('user_id')
        .eq('user_id', auth.userId)
        .maybeSingle();
    if (!data) throw new Error('No autorizado');
    return { auth, admin };
}

// GET: List all platform videos
export async function GET() {
    try {
        const admin = supabaseAdmin();
        const { data, error } = await admin
            .from('platform_videos')
            .select('*')
            .order('sort_order', { ascending: true });

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ videos: data || [] });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST: Add a new video
export async function POST(req: NextRequest) {
    try {
        const { admin } = await checkAdmin(req);
        const body = await req.json();
        const { title, video_url, thumbnail_url, duration_seconds } = body;

        if (!title || !video_url) {
            return NextResponse.json({ error: 'title y video_url requeridos' }, { status: 400 });
        }

        const { data, error } = await admin
            .from('platform_videos')
            .insert({
                title: title.trim(),
                video_url,
                thumbnail_url: thumbnail_url || null,
                duration_seconds: duration_seconds || 0,
                sort_order: 0,
                is_active: true,
            })
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, video: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.message === 'No autorizado' ? 403 : 500 });
    }
}

// DELETE: Remove a video
export async function DELETE(req: NextRequest) {
    try {
        const { admin } = await checkAdmin(req);
        const url = new URL(req.url);
        const videoId = url.searchParams.get('id');

        if (!videoId) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

        const { error } = await admin
            .from('platform_videos')
            .delete()
            .eq('id', videoId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.message === 'No autorizado' ? 403 : 500 });
    }
}

// PATCH: Toggle active or update sort order
export async function PATCH(req: NextRequest) {
    try {
        const { admin } = await checkAdmin(req);
        const body = await req.json();
        const { id, is_active, sort_order, title } = body;

        if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 });

        const update: any = {};
        if (typeof is_active === 'boolean') update.is_active = is_active;
        if (typeof sort_order === 'number') update.sort_order = sort_order;
        if (title) update.title = title.trim();
        update.updated_at = new Date().toISOString();

        const { data, error } = await admin
            .from('platform_videos')
            .update(update)
            .eq('id', id)
            .select()
            .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, video: data });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: e.message === 'No autorizado' ? 403 : 500 });
    }
}
