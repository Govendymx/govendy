import { NextRequest, NextResponse } from 'next/server';
import { getT1Quotes } from '@/lib/shipping/t1-api';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { origin_zip, dest_zip, weight_kg, length_cm, width_cm, height_cm, package_value, seller_plan } = body;

        if (!origin_zip || !dest_zip) {
            return NextResponse.json({ error: 'Se requieren los códigos postales de origen y destino' }, { status: 400 });
        }

        // ── Plan access check ──────────────────────────────────────────────
        // Fetch global plan-level access settings from app_settings
        const { data: settingsRow } = await supabaseAdmin()
            .from('app_settings')
            .select('t1_envios_config')
            .eq('id', 1)
            .maybeSingle();

        const t1Config = (settingsRow as any)?.t1_envios_config || {};
        const plan = (seller_plan || 'basic').toLowerCase();

        // Determine access: Pro and Platinum default to true if not explicitly set
        let hasAccess = false;
        if (plan === 'platinum') {
            hasAccess = t1Config.access_platinum !== undefined ? Boolean(t1Config.access_platinum) : true;
        } else if (plan === 'pro') {
            hasAccess = t1Config.access_pro !== undefined ? Boolean(t1Config.access_pro) : true;
        } else {
            // basic / free / anything else
            hasAccess = Boolean(t1Config.access_basic);
        }

        if (!hasAccess) {
            // Plan does not have T1 access — return empty quotes silently
            return NextResponse.json({ success: true, quotes: [], reason: 'plan_no_access' });
        }
        // ──────────────────────────────────────────────────────────────────

        const quotes = await getT1Quotes({
            origin_zip,
            dest_zip,
            weight_kg: weight_kg || 1,
            length_cm: length_cm || 10,
            width_cm: width_cm || 10,
            height_cm: height_cm || 10,
            package_value: package_value || 0,
            seller_plan: seller_plan || 'basic',
        });

        return NextResponse.json({ success: true, quotes });
    } catch (err: any) {
        console.error('[API /shipping/t1/quote]', err);
        return NextResponse.json({ error: err?.message || 'Error al cotizar' }, { status: 500 });
    }
}
