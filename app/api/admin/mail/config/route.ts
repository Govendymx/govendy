import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, getMailboxes } from '@/lib/admin/mail/guard';

export const dynamic = 'force-dynamic';

/** GET: listar cuentas configuradas (label, email, index) para UI. Sin contraseñas. */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });
    const { admin } = guard;

    const mailboxes = await getMailboxes(admin);
    const list = mailboxes.map((m, i) => ({
      index: i,
      label: m.label,
      email: m.email,
    }));

    const r = NextResponse.json({ ok: true, mailboxes: list });
    r.headers.set('Cache-Control', 'no-store, max-age=0');
    return r;
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 500 });
  }
}
