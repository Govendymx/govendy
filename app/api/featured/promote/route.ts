import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { WalletService } from '@/lib/services/wallet/wallet.service';
import { sendUnifiedNotification } from '@/lib/notifications/unified';

export const dynamic = 'force-dynamic';

const PLANS = {
  '7_days': { days: 7, price: 79 },
  '15_days': { days: 15, price: 149 },
  '30_days': { days: 30, price: 199 },
};

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnon);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { listingId, planType } = body;

    if (!listingId || !planType || !PLANS[planType as keyof typeof PLANS]) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const plan = PLANS[planType as keyof typeof PLANS];
    const admin = supabaseAdmin();

    // 2. Verify listing ownership and existence
    const { data: listing, error: listingError } = await admin
      .from('listings')
      .select('id, seller_id, title, is_featured')
      .eq('id', listingId)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (listing.seller_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this listing' }, { status: 403 });
    }

    // 3. Check for existing active promotion
    const { data: existingPromos } = await admin
      .from('featured_listings')
      .select('id')
      .eq('listing_id', listingId)
      .eq('status', 'active')
      .gt('end_at', new Date().toISOString());

    if (existingPromos && existingPromos.length > 0) {
      return NextResponse.json({ error: 'This listing is already featured' }, { status: 400 });
    }

    // 3.5 System Check (Prevent money loss if table missing)
    try {
      const { error: checkError } = await admin.from('featured_listings').select('id').limit(1);
      if (checkError && checkError.message.toLowerCase().includes('does not exist')) {
        console.error('Missing featured_listings table');
        return NextResponse.json({ error: 'System maintenance: Feature temporarily unavailable' }, { status: 503 });
      }
    } catch (e) {
      // Continue if check fails for other reasons (e.g. RLS), but strictly catch missing table
    }

    // 4. Process Payment (Atomic)
    // We use WalletService to deduct funds. It throws if insufficient balance.
    let transaction;
    try {
      transaction = await WalletService.deductFunds(
        user.id,
        plan.price,
        `Destacar publicación: ${listing.title} (${plan.days} días)`,
        'order', // Using 'order' as generic payment reference type
        listingId
      );
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Payment failed' }, { status: 402 });
    }

    // 5. Create Featured Subscription
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + plan.days);

    const { error: insertError } = await admin
      .from('featured_listings')
      .insert({
        user_id: user.id,
        listing_id: listingId,
        plan_type: planType,
        start_at: startDate.toISOString(),
        end_at: endDate.toISOString(),
        status: 'active',
        payment_id: transaction.id
      });

    if (insertError) {
      console.error('Error creating featured subscription:', insertError);
      
      // CRITICAL: Refund logic to prevent money loss
      try {
        await WalletService.addFunds(
          user.id,
          plan.price,
          `Reembolso: Error al activar destacado (${listing.title})`,
          'refund',
          transaction.id
        );
        return NextResponse.json({ error: 'Error processing request. Funds have been refunded.' }, { status: 500 });
      } catch (refundError) {
        console.error('CRITICAL: Refund failed for user', user.id, refundError);
        // Log this severely - maybe send alert
        return NextResponse.json({ 
          error: 'Error processing request. Please contact support regarding transaction ' + transaction.id 
        }, { status: 500 });
      }
    }

    // 6. Update listing status (for easy UI checks)
    await admin
      .from('listings')
      .update({ is_featured: true, featured_fee: plan.price })
      .eq('id', listingId);

    // 7. Send Notification
    try {
      await sendUnifiedNotification(admin, {
        userId: user.id,
        type: 'system',
        title: '¡Publicación Destacada!',
        body: `Tu publicación "${listing.title}" ahora está destacada por ${plan.days} días.`,
        linkTo: `/listings/${listingId}`,
        data: { listingId, planType }
      });
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({ success: true });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || 'Internal Server Error' }, { status: 500 });
  }
}
