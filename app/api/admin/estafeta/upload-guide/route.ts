import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnon) {
      return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin
    const admin = supabaseAdmin();
    const { data: adminRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (!adminRow) {
      return NextResponse.json({ error: 'No tienes permisos de administrador.' }, { status: 403 });
    }

    // Parse FormData — file + quote_id
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const quoteId = String(formData.get('quote_id') || '').trim();

    if (!quoteId) {
      return NextResponse.json({ error: 'quote_id es requerido.' }, { status: 400 });
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Archivo no recibido.' }, { status: 400 });
    }

    // Verify quote exists and is paid
    const { data: quote, error: quoteErr } = await admin
      .from('estafeta_quotes')
      .select('id, status')
      .eq('id', quoteId)
      .maybeSingle();

    if (quoteErr || !quote) {
      return NextResponse.json({ error: 'Cotización no encontrada.' }, { status: 404 });
    }

    if (quote.status !== 'paid' && quote.status !== 'processing') {
      return NextResponse.json({ error: `Solo se pueden subir guías para cotizaciones pagadas. Status actual: ${quote.status}` }, { status: 400 });
    }

    // Upload file to Supabase Storage using admin client (bypasses RLS)
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `estafeta-guide-${quoteId}-${Date.now()}.${fileExt}`;
    const filePath = `estafeta-guides/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadErr } = await admin.storage
      .from('upload')
      .upload(filePath, buffer, {
        upsert: true,
        contentType: file.type || 'application/pdf',
      });

    if (uploadErr) {
      console.error('[ADMIN ESTAFETA UPLOAD] Storage error:', uploadErr);
      return NextResponse.json({ error: `Error al subir archivo: ${uploadErr.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = admin.storage.from('upload').getPublicUrl(filePath);
    const guideFileUrl = urlData.publicUrl;

    // Update quote record
    const { error: updateErr } = await admin
      .from('estafeta_quotes')
      .update({
        guide_file_url: guideFileUrl,
        guide_uploaded_at: new Date().toISOString(),
        guide_uploaded_by: userData.user.id,
        status: quote.status === 'paid' ? 'processing' : quote.status,
      })
      .eq('id', quoteId);

    if (updateErr) {
      console.error('[ADMIN ESTAFETA UPLOAD] DB update error:', updateErr);
      return NextResponse.json({ error: 'No se pudo actualizar la cotización.' }, { status: 500 });
    }

    // Notify user
    const { data: quoteForUser } = await admin
      .from('estafeta_quotes')
      .select('user_id, calculated_cost')
      .eq('id', quoteId)
      .maybeSingle();

    if (quoteForUser?.user_id) {
      try {
        const { insertNotificationBestEffort } = await import('@/lib/notifications/insertBestEffort');
        await insertNotificationBestEffort(admin, {
          user_id: quoteForUser.user_id,
          type: 'estafeta_guide_ready',
          title: 'Tu guía Estafeta está lista',
          body: 'Tu guía de envío Estafeta está disponible para descargar en "Mis Guías Estafeta".',
          data: { quote_id: quoteId, guide_file_url: guideFileUrl, type: 'estafeta_guide' },
          is_read: false,
        });
      } catch (notifErr) {
        console.warn('[ADMIN ESTAFETA UPLOAD] Notification warning:', notifErr);
      }
    }

    return NextResponse.json({ ok: true, message: 'Guía subida correctamente.' });
  } catch (e: unknown) {
    console.error('[ADMIN ESTAFETA UPLOAD] Exception:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 });
  }
}
