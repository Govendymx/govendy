import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * One-time migration: adds missing values to wallet_reference_type enum.
 * POST /api/migrations/fix-wallet-enum
 */
export async function POST(req: NextRequest) {
    try {
        const admin = supabaseAdmin();

        // Add missing enum values one at a time
        const valuesToAdd = ['gift_card', 'payout', 'topup', 'deposit'];
        const results: { value: string; status: string; error?: string }[] = [];

        for (const val of valuesToAdd) {
            const { error } = await admin.rpc('exec_sql', {
                query: `ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS '${val}'`,
            });

            if (error) {
                // Try raw SQL if RPC doesn't exist
                try {
                    // Use a direct approach via supabase-js
                    const response = await fetch(
                        `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
                                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`,
                            },
                            body: JSON.stringify({
                                query: `ALTER TYPE wallet_reference_type ADD VALUE IF NOT EXISTS '${val}'`,
                            }),
                        },
                    );
                    if (!response.ok) {
                        results.push({ value: val, status: 'failed', error: `HTTP ${response.status}: ${await response.text()}` });
                    } else {
                        results.push({ value: val, status: 'added_via_rpc' });
                    }
                } catch (e: any) {
                    results.push({ value: val, status: 'failed', error: error.message || e.message });
                }
            } else {
                results.push({ value: val, status: 'added' });
            }
        }

        return NextResponse.json({ ok: true, results });
    } catch (e: any) {
        console.error('[FIX-WALLET-ENUM] Error:', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
