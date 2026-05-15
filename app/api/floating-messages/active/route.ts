import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { NOTIFICATION_THRESHOLDS, NOTIFICATION_MESSAGES } from '@/lib/config/notification-thresholds';

export const dynamic = 'force-dynamic';

function generateDeterministicUUID(input: string): string {
  const hash = createHash('sha256').update(input).digest('hex');
  // Format as UUID: 8-4-4-4-12
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

export async function GET(req: NextRequest) {
  try {
    const section = req.nextUrl.searchParams.get('section') || 'all';
    const now = new Date();
    const nowISO = now.toISOString();

    // 1. Obtener mensajes de admin (existente)
    const { data: allMessages, error: fetchError } = await supabaseAdmin()
      .from('admin_floating_messages')
      .select('*')
      .eq('is_active', true)
      .or(`section.eq.all,section.eq.${section}`)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[FLOATING MESSAGES ACTIVE] Error al obtener mensajes:', fetchError);
      throw fetchError;
    }

    // Filtrar por rango de fechas
    let adminMessages = (allMessages || []).filter((m: any) => {
      try {
        const startsAt = new Date(m.starts_at);
        const endsAt = m.ends_at ? new Date(m.ends_at) : null;
        
        if (isNaN(startsAt.getTime())) return false;
        if (endsAt && isNaN(endsAt.getTime())) return false;
        
        if (startsAt > now) return false;
        if (endsAt && endsAt < now) return false;
        
        return true;
      } catch (err) {
        console.error(`[FLOATING MESSAGES ACTIVE] Error al procesar mensaje ${m.id}:`, err);
        return false;
      }
    });

    // 2. Lógica de usuario (Mensajes cerrados, target_user_ids y Notificaciones Dinámicas)
    const authHeader = req.headers.get('authorization');
    let closedMessageIds: string[] = [];
    let dynamicMessages: any[] = [];
    let userId: string | null = null;

    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: { headers: { Authorization: authHeader } },
        });

        const { data: userData } = await supabase.auth.getUser();
        
        if (userData.user) {
          userId = userData.user.id;

          // A. Obtener mensajes cerrados
          const { data: closed } = await supabaseAdmin()
            .from('user_closed_messages')
            .select('message_id')
            .eq('user_id', userId);

          closedMessageIds = (closed || []).map((c) => c.message_id);

          // B. Filtrar mensajes de admin por target_user_ids
          adminMessages = adminMessages.filter((m: any) => {
            if (m.target_user_ids && Array.isArray(m.target_user_ids) && m.target_user_ids.length > 0) {
              return m.target_user_ids.includes(userId);
            }
            return true;
          });

          // C. Generar notificaciones dinámicas (Solo si hay usuario logueado)
          // Consultar órdenes activas recientes (últimos 30 días)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          const { data: orders } = await supabaseAdmin()
            .from('orders')
            .select(`
              id, status, paid_at, shipped_at, delivered_at, completed_at, 
              seller_id, buyer_id, 
              user_ratings(id, rater_id)
            `)
            .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
            .gte('created_at', thirtyDaysAgo.toISOString())
            .neq('status', 'cancelled');

          if (orders && orders.length > 0) {
            for (const order of orders) {
              const isSeller = order.seller_id === userId;
              const isBuyer = order.buyer_id === userId;
              
              // --- C.1 Detectar Retraso de Envío (Solo para Vendedor) ---
              if (isSeller && order.status === 'paid' && order.paid_at) {
                const paidDate = new Date(order.paid_at);
                const hoursSincePaid = (now.getTime() - paidDate.getTime()) / (1000 * 60 * 60);
                
                if (hoursSincePaid > NOTIFICATION_THRESHOLDS.SHIPPING_DELAY_HOURS) {
                  const msgId = generateDeterministicUUID(`delay_${order.id}`);
                  
                  if (!closedMessageIds.includes(msgId)) {
                    const deadlineDate = new Date(paidDate.getTime() + (NOTIFICATION_THRESHOLDS.SHIPPING_DELAY_HOURS * 60 * 60 * 1000));
                    
                    dynamicMessages.push({
                      id: msgId,
                      title: NOTIFICATION_MESSAGES.SHIPPING_DELAY.title,
                      content_html: NOTIFICATION_MESSAGES.SHIPPING_DELAY.body(order.id, deadlineDate.toLocaleDateString()),
                      message_type: 'html',
                      section: 'all',
                      position_x: 20,
                      position_y: 100,
                      width: 320,
                      background_color: '#ffffff',
                      text_color: '#000000',
                      border_color: '#ef4444',
                      z_index: 9999,
                      is_draggable: true,
                      is_closable: true,
                      redirect_url: `/dashboard/ventas?id=${order.id}`,
                      created_at: nowISO,
                    });
                    
                    console.log(`[AUDIT_FLOATING_MSG] Generated DELAY notification for User ${userId}, Order ${order.id}, MsgID ${msgId}`);
                  }
                }
              }

              // --- C.2 Detectar Calificación Pendiente ---
              const isCompleted = ['delivered', 'completed'].includes(order.status);
              if (isCompleted) {
                const myRatings = (order.user_ratings || []).filter((r: any) => r.rater_id === userId);
                const hasRated = myRatings.length > 0;
                
                if (!hasRated) {
                  const type = isBuyer ? 'RATING_PENDING_BUYER' : 'RATING_PENDING_SELLER';
                  const msgConfig = NOTIFICATION_MESSAGES[type];
                  const msgId = generateDeterministicUUID(`rating_${order.id}_${userId}`);
                  
                  if (!closedMessageIds.includes(msgId)) {
                    dynamicMessages.push({
                      id: msgId,
                      title: msgConfig.title,
                      content_html: msgConfig.body(order.id),
                      message_type: 'html',
                      section: 'all',
                      position_x: 20,
                      position_y: isBuyer ? 120 : 140, // Offset simple
                      width: 320,
                      background_color: '#ffffff',
                      text_color: '#000000',
                      border_color: '#fbbf24',
                      z_index: 9998,
                      is_draggable: true,
                      is_closable: true,
                      redirect_url: isBuyer ? `/dashboard/compras?id=${order.id}` : `/dashboard/ventas?id=${order.id}`,
                      created_at: nowISO,
                    });

                    console.log(`[AUDIT_FLOATING_MSG] Generated RATING notification for User ${userId}, Order ${order.id}, MsgID ${msgId}`);
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('[FLOATING MESSAGES ACTIVE] Error procesando lógica de usuario:', err);
      }
    }

    // Filtrar mensajes de admin cerrados
    adminMessages = adminMessages.filter((m) => !closedMessageIds.includes(m.id));

    // Combinar
    const finalMessages = [...adminMessages, ...dynamicMessages];

    console.log(`[FLOATING MESSAGES ACTIVE] Mensajes finales: ${finalMessages.length} (Admin: ${adminMessages.length}, Dinámicos: ${dynamicMessages.length})`);

    const resp = NextResponse.json({ messages: finalMessages });
    resp.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    resp.headers.set('Pragma', 'no-cache');
    resp.headers.set('Expires', '0');
    return resp;
  } catch (err: any) {
    console.error('[FLOATING MESSAGES ACTIVE] Error:', err);
    const resp = NextResponse.json({ error: err?.message || 'Error al cargar mensajes' }, { status: 500 });
    resp.headers.set('Cache-Control', 'no-store, max-age=0');
    return resp;
  }
}
