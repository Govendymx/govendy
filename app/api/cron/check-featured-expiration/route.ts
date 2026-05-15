import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendUnifiedNotification } from '@/lib/notifications/unified';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // This endpoint should ideally be protected by a cron secret
    const authHeader = req.headers.get('authorization');
    // For now, we allow it to be called without secret for testing, or check for a specific key if configured
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) ...

    const admin = supabaseAdmin();
    const now = new Date().toISOString();

    // 1. Find expired featured listings that are still marked as active
    const { data: expired, error: fetchError } = await admin
      .from('featured_listings')
      .select('id, listing_id, user_id')
      .eq('status', 'active')
      .lt('end_at', now);

    if (fetchError) throw fetchError;

    if (!expired || expired.length === 0) {
      return NextResponse.json({ message: 'No expired listings found', count: 0 });
    }

    // 2. Update them to 'expired'
    const expiredIds = expired.map(x => x.id);
    const listingIds = expired.map(x => x.listing_id);

    const { error: updateError } = await admin
      .from('featured_listings')
      .update({ status: 'expired' })
      .in('id', expiredIds);

    if (updateError) throw updateError;

    // 3. Update the listing 'is_featured' flag to false and Notify
    // Note: A listing might have multiple featured entries (unlikely active at same time, but possible in history)
    // We should only turn off is_featured if there are no OTHER active featured entries for this listing.
    
    for (const item of expired) {
      const listingId = item.listing_id;
      
      // Check for other active promotions
      const { data: activeOthers } = await admin
        .from('featured_listings')
        .select('id')
        .eq('listing_id', listingId)
        .eq('status', 'active')
        .gt('end_at', now)
        .limit(1);

      if (!activeOthers || activeOthers.length === 0) {
        await admin
          .from('listings')
          .update({ is_featured: false })
          .eq('id', listingId);
      }

      // Send Notification
      try {
        // Fetch title for better message
        const { data: listingData } = await admin
            .from('listings')
            .select('title')
            .eq('id', listingId)
            .single();
        
        const title = listingData?.title || 'Tu publicación';

        await sendUnifiedNotification(admin, {
          userId: item.user_id,
          type: 'system',
          title: 'Destacado Finalizado',
          body: `El periodo destacado de "${title}" ha finalizado. Renuevalo para mantener la visibilidad.`,
          linkTo: `/dashboard/publicidad`,
          data: { listingId, planId: item.id }
        });
      } catch (notifError) {
        console.error('Error sending expiration notification:', notifError);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Processed ${expired.length} expired listings`,
      expired_ids: expiredIds 
    });

  } catch (error: any) {
    console.error('Error processing expired listings:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
