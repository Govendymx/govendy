import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { clearT1ConfigCache, clearT1TokenCache } from '@/lib/shipping/t1-auth';
import { testT1Connection } from '@/lib/shipping/t1-api';

/**
 * GET: Retrieve T1 config
 * POST: Save T1 config
 * PUT: Test connection
 */
export async function GET() {
    try {
        const { data } = await supabaseAdmin()
            .from('app_settings')
            .select('t1_envios_config')
            .eq('id', 1)
            .maybeSingle();

        const config = (data as any)?.t1_envios_config || {};
        // Mask password for security
        const masked = { ...config, password: config.password ? '••••••••' : '' };

        return NextResponse.json({ success: true, config: masked });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Retrieve existing config to merge/preserve fields like carriers_config or api_secret
        const { data: existingRow } = await supabaseAdmin()
            .from('app_settings')
            .select('t1_envios_config')
            .eq('id', 1)
            .maybeSingle();

        const existing = (existingRow as any)?.t1_envios_config || {};

        // Build the config object by merging
        const configUpdate: Record<string, any> = {
            ...existing,
            enabled: Boolean(body.enabled),
            api_url: String(body.api_url || 'https://apiv2.t1envios.com'),
            auth_url: String(body.auth_url || 'https://id.t1.com/auth/realms/T1/protocol/openid-connect/token'),
            shop_id: String(body.shop_id || ''),
            username: String(body.username || ''),
            test_mode: Boolean(body.test_mode),
            markup_basic: Number(body.markup_basic ?? 60),
            markup_pro: Number(body.markup_pro ?? 50),
            markup_platinum: Number(body.markup_platinum ?? 40),
            access_basic: Boolean(body.access_basic),
            access_pro: body.access_pro === undefined ? true : Boolean(body.access_pro),
            access_platinum: body.access_platinum === undefined ? true : Boolean(body.access_platinum),
        };

        // Only update password if provided (not masked)
        if (body.password && body.password !== '••••••••') {
            configUpdate.password = String(body.password);
        }

        // If carriers_config is explicitly sent, update it
        if (body.carriers_config) {
            configUpdate.carriers_config = body.carriers_config;
        }

        const { error } = await supabaseAdmin()
            .from('app_settings')
            .update({ t1_envios_config: configUpdate })
            .eq('id', 1);

        if (error) throw error;

        // Clear caches so next request uses new config
        clearT1ConfigCache();
        clearT1TokenCache();

        return NextResponse.json({ success: true, message: 'Configuración guardada' });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Error' }, { status: 500 });
    }
}

export async function PUT() {
    try {
        // Clear caches first to force fresh config load
        clearT1ConfigCache();
        clearT1TokenCache();

        const result = await testT1Connection();
        return NextResponse.json(result);
    } catch (err: any) {
        return NextResponse.json({ success: false, message: err?.message || 'Error de conexión' }, { status: 500 });
    }
}
