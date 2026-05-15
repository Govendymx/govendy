
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1] ?? null;

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: { user }, error } = await admin.auth.getUser(token);
    
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin (optional, assuming protected route but good to double check)
    // For now we trust the token and app structure if this is an admin route

    const body = await req.json().catch(() => ({}));
    const { listingIds } = body;

    if (!Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ error: 'listingIds array required' }, { status: 400 });
    }

    const results = [];

    // Importante: llamamos a la API interna de settle-one para reutilizar la lógica completa
    // Usamos fetch a la URL local
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    
    for (const id of listingIds) {
      try {
        const res = await fetch(`${baseUrl}/api/auctions/settle-one`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listing_id: id })
        });
        const json = await res.json();
        results.push({ id, status: res.status, result: json });
      } catch (err: any) {
        results.push({ id, status: 500, error: err.message });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
