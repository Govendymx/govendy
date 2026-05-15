import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const results: any = {};
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

    // 1. Validate Access Token (GET /users/me)
    try {
        const t0 = performance.now();
        const res = await fetch('https://api.mercadopago.com/users/me', { 
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await res.json().catch(() => 'Invalid JSON');
        results.token_validation = {
            success: res.ok,
            status: res.status,
            duration: performance.now() - t0,
            is_policy_agent: JSON.stringify(data).includes('PolicyAgent'),
            data_preview: typeof data === 'object' ? data : String(data).substring(0, 200)
        };
    } catch (e: any) {
        results.token_validation = { success: false, error: e.message };
    }

    // 2. Try Create Preference (Simulate Production Failure)
    try {
        const t0 = performance.now();
        const res = await fetch('https://api.mercadopago.com/checkout/preferences', { 
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                items: [{
                    title: 'Test Item',
                    quantity: 1,
                    currency_id: 'MXN',
                    unit_price: 10
                }],
                back_urls: {
                    success: 'https://www.google.com',
                    failure: 'https://www.google.com',
                    pending: 'https://www.google.com'
                },
                auto_return: 'approved'
            })
        });
        const data = await res.json().catch(() => 'Invalid JSON');
        results.create_preference = {
            success: res.ok,
            status: res.status,
            duration: performance.now() - t0,
            is_policy_agent: JSON.stringify(data).includes('PolicyAgent'),
            data_preview: typeof data === 'object' ? data : String(data).substring(0, 200)
        };
    } catch (e: any) {
        results.create_preference = { success: false, error: e.message };
    }

    // 3. Env Vars Check
    results.env_check = {
        has_token: !!accessToken,
        token_prefix: accessToken ? accessToken.substring(0, 10) + '...' : 'MISSING'
    };

    return NextResponse.json(results);
}
