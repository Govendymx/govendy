import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/utils/errors';

export const dynamic = 'force-dynamic';

/** GET /api/admin/settings?fields=tax_withholding_enabled,payment_methods */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    const fieldsParam = String(req.nextUrl.searchParams.get('fields') || '').trim();
    const fields = fieldsParam
      ? fieldsParam.split(',').map((f) => f.trim()).filter(Boolean)
      : ['*'];

    const select = fields.includes('*') ? '*' : fields.join(',');

    const { data, error } = await auth.admin
      .from('app_settings')
      .select(select)
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: data ?? {} });
  } catch (e) {
    return handleApiError(e);
  }
}
