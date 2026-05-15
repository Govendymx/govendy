import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const listingId = req.nextUrl.searchParams.get('listingId');
        if (!listingId) {
            return NextResponse.json({ error: 'listingId is required' }, { status: 400 });
        }

        const admin = supabaseAdmin();

        // Fetch bids ordered by amount descending (highest first)
        const { data: bids, error: bidsErr } = await admin
            .from('bids')
            .select('id,bidder_id,amount,created_at')
            .eq('listing_id', listingId)
            .order('amount', { ascending: false })
            .limit(100);

        if (bidsErr) {
            return NextResponse.json({ error: bidsErr.message }, { status: 400 });
        }

        if (!bids || bids.length === 0) {
            return NextResponse.json({ ok: true, bids: [] });
        }

        // Get unique bidder IDs to fetch their names
        const bidderIds = Array.from(new Set(bids.map((b: any) => String(b.bidder_id).trim()).filter(Boolean)));

        let profileMap: Record<string, string> = {};
        if (bidderIds.length > 0) {
            // Remove 'nickname' if it causes errors, use full_name and email as fallbacks
            const { data: profiles } = await admin
                .from('profiles')
                .select('id,full_name,first_name,last_name,email')
                .in('id', bidderIds);

            if (profiles) {
                for (const p of profiles as any[]) {
                    const id = String(p.id).trim();
                    // Construct name: full_name -> first+last -> email prefix -> 'Usuario'
                    let name = (p.full_name || '').trim();
                    if (!name && (p.first_name || p.last_name)) {
                        name = `${p.first_name || ''} ${p.last_name || ''}`.trim();
                    }
                    if (!name && p.email) {
                        name = p.email.split('@')[0];
                    }
                    
                    if (id) {
                        profileMap[id] = name || 'Usuario';
                    }
                }
            }
        }

        // Build response with bidder names
        const enrichedBids = bids.map((b: any) => ({
            id: b.id,
            bidder_id: b.bidder_id,
            bidder_name: profileMap[b.bidder_id] || 'Usuario',
            amount: b.amount,
            created_at: b.created_at,
        }));

        const resp = NextResponse.json({ ok: true, bids: enrichedBids });
        resp.headers.set('Cache-Control', 'no-store, max-age=0');
        return resp;
    } catch (e: unknown) {
        console.error(e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : 'Error fetching bid history' },
            { status: 500 }
        );
    }
}
