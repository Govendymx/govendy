import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notifyAbandonedCart } from '@/lib/email/notify';

// Evita que Vercel cachee esta ruta
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Seguridad básica: Verificar header de Cron Secret (opcional, recomendado para producción)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // Permitir ejecución local o si no hay secreto configurado, pero idealmente proteger
      // return new NextResponse('Unauthorized', { status: 401 });
    }

    const admin = supabaseAdmin();
    
    // 1. Definir el umbral de tiempo (ej. carritos modificados hace más de 1 hora y menos de 24h)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 2. Buscar items de carrito abandonados
    // - Que no hayan sido notificados (last_reminder_at IS NULL)
    // - Creados/modificados hace más de 1 hora
    const { data: abandonedItems, error } = await admin
      .from('cart_items')
      .select(`
        id,
        user_id,
        listing_id,
        quantity,
        updated_at,
        listings (
          id,
          title,
          price,
          images
        )
      `)
      .is('last_reminder_at', null)
      .lt('updated_at', oneHourAgo)
      .gt('updated_at', twentyFourHoursAgo);

    if (error) {
      console.error('[AbandonedCart] Error fetching items:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!abandonedItems || abandonedItems.length === 0) {
      return NextResponse.json({ message: 'No abandoned carts found', count: 0 });
    }

    // 3. Agrupar items por usuario
    const cartsByUser: Record<string, any[]> = {};
    
    for (const item of abandonedItems) {
      if (!cartsByUser[item.user_id]) {
        cartsByUser[item.user_id] = [];
      }
      cartsByUser[item.user_id].push(item);
    }

    // 4. Procesar cada usuario
    let emailsSent = 0;
    const now = new Date().toISOString();

    for (const userId in cartsByUser) {
      const items = cartsByUser[userId];
      
      // Preparar datos para el correo
      const emailItems = items.map(item => ({
        title: item.listings?.title || 'Producto sin nombre',
        price: Number(item.listings?.price || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }),
        image: item.listings?.images?.[0] // Primera imagen
      }));

      // Enviar correo
      // Usamos try/catch individual para no detener todo el proceso si uno falla
      try {
        await notifyAbandonedCart({
          userId,
          items: emailItems,
          cartLink: `${process.env.NEXT_PUBLIC_APP_URL}/cart`
        });
        
        emailsSent++;

        // 5. Marcar items como notificados
        const itemIds = items.map(i => i.id);
        await admin
          .from('cart_items')
          .update({ last_reminder_at: now })
          .in('id', itemIds);

      } catch (err) {
        console.error(`[AbandonedCart] Failed to notify user ${userId}:`, err);
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed_users: Object.keys(cartsByUser).length,
      emails_sent: emailsSent 
    });

  } catch (err: any) {
    console.error('[AbandonedCart] Critical error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
