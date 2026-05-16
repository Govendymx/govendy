import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

type Body = {
  id: string;
  status: 'approved' | 'rejected' | 'pending';
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const id = String(body?.id || '').trim();
    const status = String(body?.status || '').trim() as Body['status'];

    if (!id) {
      return NextResponse.json({ ok: false, error: 'id requerido' }, { status: 400 });
    }
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return NextResponse.json({ ok: false, error: 'status inválido' }, { status: 400 });
    }

    const { data, error } = await auth.admin
      .from('category_requests')
      .update({ status })
      .eq('id', id)
      .select('id, status')
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, request: data });
  } catch (e) {
    return handleApiError(e);
  }
}
