import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/middleware';
import { handleApiError } from '@/lib/utils/errors';
import {
  buildVerificationProfilePayload,
  type VerificationProfileInput,
} from '@/lib/verification/profilePayload';

export const dynamic = 'force-dynamic';

function isMissingColumnError(err: { code?: string; message?: string } | null): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return code === '42703' || code === 'PGRST204' || msg.includes('column') || msg.includes('does not exist');
}

/** Quita columnas opcionales si la BD aún no las tiene. */
function stripOptionalColumns(payload: Record<string, unknown>, keys: string[]) {
  for (const k of keys) delete payload[k];
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    const body = (await req.json().catch(() => ({}))) as Partial<VerificationProfileInput>;

    const required = [
      'first_name',
      'apellido_paterno',
      'apellido_materno',
      'nickname',
      'rfc',
      'phone',
      'address_street',
      'ext_number',
      'neighborhood',
      'zip_code',
      'state',
      'city',
      'ine_front_url',
      'ine_back_url',
      'selfie_ine_url',
    ] as const;

    const missing = required.filter((k) => !String(body[k] ?? '').trim());
    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, error: `Faltan campos obligatorios: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    const input = {
      first_name: String(body.first_name),
      apellido_paterno: String(body.apellido_paterno),
      apellido_materno: String(body.apellido_materno),
      nickname: String(body.nickname),
      rfc: String(body.rfc),
      curp: String(body.curp ?? ''),
      address_street: String(body.address_street),
      ext_number: String(body.ext_number),
      int_number: String(body.int_number ?? ''),
      neighborhood: String(body.neighborhood),
      zip_code: String(body.zip_code),
      state: String(body.state),
      city: String(body.city),
      references: String(body.references ?? ''),
      cross_streets: String(body.cross_streets ?? ''),
      phone: String(body.phone),
      ine_front_url: String(body.ine_front_url),
      ine_back_url: String(body.ine_back_url),
      selfie_ine_url: String(body.selfie_ine_url),
    };

    let payload = buildVerificationProfilePayload(input);

    let result = await auth.admin.from('profiles').update(payload).eq('id', auth.userId).select('*').maybeSingle();

    if (result.error && isMissingColumnError(result.error)) {
      stripOptionalColumns(payload, [
        'verification_submitted_at',
        'verification_reviewed_at',
        'selfie_ine_url',
        'verification_status',
        'verification_rejection_reason',
      ]);
      result = await auth.admin.from('profiles').update(payload).eq('id', auth.userId).select('*').maybeSingle();
    }

    if (result.error && isMissingColumnError(result.error)) {
      stripOptionalColumns(payload, ['last_name', 'curp', 'nickname', 'apellido_paterno', 'apellido_materno']);
      result = await auth.admin.from('profiles').update(payload).eq('id', auth.userId).select('*').maybeSingle();
    }

    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error.message }, { status: 400 });
    }

    if (!result.data) {
      const insertPayload = { id: auth.userId, ...payload };
      const ins = await auth.admin.from('profiles').upsert(insertPayload).select('*').maybeSingle();
      if (ins.error) {
        return NextResponse.json({ ok: false, error: ins.error.message }, { status: 400 });
      }
      return NextResponse.json({ ok: true, profile: ins.data });
    }

    return NextResponse.json({ ok: true, profile: result.data });
  } catch (e) {
    return handleApiError(e);
  }
}
