import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { TemplateBlock } from '@/lib/templates/blocks';
import { validateTemplateBlocks } from '@/lib/templates/validate';

function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!url || !anon) return NextResponse.json({ error: 'Supabase env vars missing on server' }, { status: 500 });

    const supabase = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr) return NextResponse.json({ error: userErr.message }, { status: 401 });
    if (!userData.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const authed = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const uid = userData.user.id;
    const adminRow: any = await authed.from('admin_users').select('user_id').eq('user_id', uid).maybeSingle();
    const ok = Boolean(adminRow?.data?.user_id) && !adminRow?.error;
    if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    let db: any = authed;
    try {
      db = supabaseAdmin();
    } catch {
      db = authed;
    }

    const defaults: Array<{ title: string; description: string; blocks: TemplateBlock[] }> = [
      {
        title: 'PRO · Básica (rápida y clara)',
        description: 'Ideal para la mayoría de prendas. Corto, directo y con bullets.',
        blocks: [
          { type: 'heading', text: 'Estado y detalles', level: 2 },
          { type: 'bullets', items: ['Condición: (nuevo / como nuevo / usado)', 'Marca:', 'Talla:', 'Color:', 'Medidas:'] },
          { type: 'callout', title: 'Tip', body: 'Entre más claras las medidas y el estado, más conversiones.', tone: 'pink' },
        ],
      },
      {
        title: 'PRO · Envío + Garantía',
        description: 'Incluye recuadros para envío, cambios y compra protegida.',
        blocks: [
          { type: 'heading', text: 'Descripción', level: 2 },
          { type: 'paragraph', text: 'Detalles del producto, condición, material y cualquier defecto (si lo hay).' },
          { type: 'divider' },
          { type: 'callout', title: 'Envío', body: 'Envío rápido. Empaque seguro. Te paso guía cuando se genere.', tone: 'neutral' },
          { type: 'callout', title: 'Compra protegida', body: 'Tu compra está protegida: soporte y seguimiento.', tone: 'success' },
        ],
      },
      {
        title: 'PRO · Storytelling (vende más)',
        description: 'Estructura tipo “anuncio bonito”: título + beneficios + detalles.',
        blocks: [
          { type: 'heading', text: 'Lo que te va a encantar', level: 2 },
          { type: 'bullets', items: ['Tela cómoda', 'Color combinable', 'Súper cuidado', 'Ideal para (ocasión)'] },
          { type: 'heading', text: 'Detalles', level: 3 },
          { type: 'paragraph', text: 'Marca, talla, medidas y condición. Si tiene detalles, los menciono para transparencia.' },
          { type: 'callout', title: 'Pregunta sin pena', body: 'Si quieres más fotos o medidas, pregúntame aquí.', tone: 'pink' },
        ],
      },
      // New 20 Templates
      {
        title: 'PRO · Minimalista Azul',
        description: 'Diseño limpio y profesional en tonos azules para transmitir confianza.',
        blocks: [
          { type: 'heading', text: 'Resumen', level: 2 },
          { type: 'paragraph', text: 'Descripción breve y concisa del artículo.' },
          { type: 'bullets', items: ['Estado: Impecable', 'Original 100%', 'Envío inmediato'] },
          { type: 'callout', title: 'Confianza', body: 'Vendedor verificado con excelentes calificaciones.', tone: 'blue' },
        ],
      },
      {
        title: 'PRO · Detalles Completos',
        description: 'Enfocado en medidas exactas y materiales. Tono morado.',
        blocks: [
          { type: 'heading', text: 'Ficha Técnica', level: 2 },
          { type: 'bullets', items: ['Hombro a hombro: __ cm', 'Axila a axila: __ cm', 'Largo total: __ cm', 'Composición: __'] },
          { type: 'callout', title: 'Nota sobre tallas', body: 'Revisa las medidas con una prenda tuya para asegurar el fit.', tone: 'purple' },
        ],
      },
      {
        title: 'PRO · Vintage Vibe',
        description: 'Estilo retro para prendas únicas o de época. Tono ámbar.',
        blocks: [
          { type: 'heading', text: 'Tesoro Vintage', level: 2 },
          { type: 'paragraph', text: 'Pieza única de la década de los __. Ideal para coleccionistas o amantes del estilo retro.' },
          { type: 'callout', title: 'Autenticidad', body: 'Prenda seleccionada por su calidad y estado de conservación.', tone: 'amber' },
        ],
      },
      {
        title: 'PRO · Alerta de Oferta',
        description: 'Destaca descuentos y oportunidades únicas. Tono rojo.',
        blocks: [
          { type: 'heading', text: '¡Oportunidad!', level: 2 },
          { type: 'paragraph', text: 'Precio reducido por tiempo limitado. No dejes pasar esta oferta.' },
          { type: 'callout', title: 'Última pieza', body: 'Solo queda una unidad disponible. ¡Aprovecha!', tone: 'red' },
        ],
      },
      {
        title: 'PRO · Elegancia Nocturna',
        description: 'Perfecto para vestidos de noche o trajes. Tono índigo.',
        blocks: [
          { type: 'heading', text: 'Elegancia y Estilo', level: 2 },
          { type: 'paragraph', text: 'Ideal para eventos formales, bodas o cenas especiales.' },
          { type: 'callout', title: 'Cuidado', body: 'Se recomienda tintorería para mantener la prenda perfecta.', tone: 'indigo' },
        ],
      },
      {
        title: 'PRO · Frescura de Verano',
        description: 'Ideal para ropa ligera, trajes de baño y accesorios. Tono turquesa.',
        blocks: [
          { type: 'heading', text: 'Summer Ready', level: 2 },
          { type: 'bullets', items: ['Tela fresca', 'Secado rápido', 'Colores vibrantes'] },
          { type: 'callout', title: 'Vacaciones', body: 'El complemento perfecto para tu próximo viaje a la playa.', tone: 'teal' },
        ],
      },
      {
        title: 'PRO · Tecnología & Gadgets',
        description: 'Estructura técnica para electrónicos. Tono cian.',
        blocks: [
          { type: 'heading', text: 'Especificaciones', level: 2 },
          { type: 'bullets', items: ['Modelo:', 'Almacenamiento:', 'Batería:', 'Accesorios incluidos:'] },
          { type: 'callout', title: 'Garantía', body: 'Funciona al 100%. Se entrega probado y reseteado.', tone: 'cyan' },
        ],
      },
      {
        title: 'PRO · Sport & Fitness',
        description: 'Para ropa deportiva y equipamiento. Tono verde.',
        blocks: [
          { type: 'heading', text: 'Rendimiento', level: 2 },
          { type: 'paragraph', text: 'Diseñado para entrenamiento de alto impacto. Tecnología transpirable.' },
          { type: 'callout', title: 'Go!', body: 'Mejora tu entrenamiento con el equipo adecuado.', tone: 'success' },
        ],
      },
      {
        title: 'PRO · Kids & Bebés',
        description: 'Tierno y seguro para los más pequeños. Tono rosa.',
        blocks: [
          { type: 'heading', text: 'Para tu peque', level: 2 },
          { type: 'bullets', items: ['Talla:', 'Material hipoalergénico', 'Poco uso'] },
          { type: 'callout', title: 'Cuidado', body: 'Lavado con detergente especial para bebés.', tone: 'pink' },
        ],
      },
      {
        title: 'PRO · Streetwear Style',
        description: 'Urbano y moderno. Tono neutro.',
        blocks: [
          { type: 'heading', text: 'Urban Flow', level: 2 },
          { type: 'paragraph', text: 'Prenda statement para destacar tu outfit.' },
          { type: 'callout', title: 'Hype', body: 'Modelo difícil de conseguir. Stock limitado.', tone: 'neutral' },
        ],
      },
      {
        title: 'PRO · Lujo Silencioso',
        description: 'Minimalismo de alta gama. Tono azul.',
        blocks: [
          { type: 'heading', text: 'Calidad Premium', level: 2 },
          { type: 'paragraph', text: 'Materiales nobles y confección de primera. Sin logos excesivos.' },
          { type: 'callout', title: 'Inversión', body: 'Una prenda que dura toda la vida.', tone: 'blue' },
        ],
      },
      {
        title: 'PRO · Outlet Express',
        description: 'Para liquidación rápida de inventario. Tono rojo.',
        blocks: [
          { type: 'heading', text: 'Liquidación', level: 2 },
          { type: 'paragraph', text: 'Todo debe irse. Precios de remate.' },
          { type: 'callout', title: 'Final', body: 'Venta final, sin cambios ni devoluciones por el precio.', tone: 'red' },
        ],
      },
      {
        title: 'PRO · Denim Lover',
        description: 'Especializado en jeans y mezclilla. Tono índigo.',
        blocks: [
          { type: 'heading', text: 'Fit & Wash', level: 2 },
          { type: 'bullets', items: ['Corte: (Skinny/Mom/Straight)', 'Tiro:', 'Lavado:', 'Stretch: (Sí/No)'] },
          { type: 'callout', title: 'Denim Tip', body: 'El denim se amolda a tu cuerpo con el uso.', tone: 'indigo' },
        ],
      },
      {
        title: 'PRO · Accesorios Chic',
        description: 'Para bolsos, joyería y complementos. Tono morado.',
        blocks: [
          { type: 'heading', text: 'El Toque Final', level: 2 },
          { type: 'paragraph', text: 'El accesorio que levanta cualquier look básico.' },
          { type: 'callout', title: 'Detalle', body: 'Incluye bolsa cubrepolvo original.', tone: 'purple' },
        ],
      },
      {
        title: 'PRO · Calzado Top',
        description: 'Plantilla específica para zapatos y sneakers. Tono ámbar.',
        blocks: [
          { type: 'heading', text: 'Sobre el par', level: 2 },
          { type: 'bullets', items: ['Talla exacta:', 'Material suela:', 'Desgaste:', 'Caja original:'] },
          { type: 'callout', title: 'Pisada', body: 'Suela con mucha vida útil por delante.', tone: 'amber' },
        ],
      },
      {
        title: 'PRO · Invierno Cozy',
        description: 'Para chamarras, suéteres y abrigo. Tono turquesa.',
        blocks: [
          { type: 'heading', text: 'Mantente abrigado', level: 2 },
          { type: 'paragraph', text: 'Ideal para climas fríos. Tela térmica y suave.' },
          { type: 'callout', title: 'Warmth', body: 'Perfecto para la temporada que viene.', tone: 'teal' },
        ],
      },
      {
        title: 'PRO · Edición Limitada',
        description: 'Para artículos raros o de colección. Tono cian.',
        blocks: [
          { type: 'heading', text: 'Rare Find', level: 2 },
          { type: 'paragraph', text: 'Colaboración exclusiva / Edición numerada.' },
          { type: 'callout', title: 'Exclusivo', body: 'No verás a nadie más con esto.', tone: 'cyan' },
        ],
      },
      {
        title: 'PRO · Básico Imprescindible',
        description: 'Para prendas fondo de armario. Tono neutro.',
        blocks: [
          { type: 'heading', text: 'Must Have', level: 2 },
          { type: 'paragraph', text: 'La prenda que combina con todo. Un básico de calidad.' },
          { type: 'callout', title: 'Versátil', body: 'Úsala para la oficina o para salir el fin de semana.', tone: 'neutral' },
        ],
      },
      {
        title: 'PRO · Fiesta & Cóctel',
        description: 'Brillo y glamour para fiestas. Tono rosa.',
        blocks: [
          { type: 'heading', text: 'Party Time', level: 2 },
          { type: 'paragraph', text: 'Destaca en tu próximo evento. Lentejuelas, satén o terciopelo.' },
          { type: 'callout', title: 'Glam', body: 'Combínalo con tacones altos para impacto total.', tone: 'pink' },
        ],
      },
      {
        title: 'PRO · Coleccionistas',
        description: 'Para figuras, cartas o memorabilia. Tono morado.',
        blocks: [
          { type: 'heading', text: 'Estado de colección', level: 2 },
          { type: 'bullets', items: ['Grado:', 'Empaque:', 'Año:', 'Serie:'] },
          { type: 'callout', title: 'Collector', body: 'Pieza clave para completar tu colección.', tone: 'purple' },
        ],
      },
    ];

    const existing: any = await db.from('listing_templates').select('title').eq('is_global', true).limit(500);
    if (existing?.error) return NextResponse.json({ error: String(existing.error?.message || 'No se pudo leer templates.') }, { status: 400 });
    const existingTitles = new Set(((existing.data as any[]) ?? []).map((r) => String(r?.title || '').trim()).filter(Boolean));

    let inserted = 0;
    for (const t of defaults) {
      if (existingTitles.has(t.title)) continue;
      const v = validateTemplateBlocks(t.blocks, { maxBlocks: 60 });
      if (!v.ok) continue;
      const ins: any = await db
        .from('listing_templates')
        .insert([
          {
            owner_id: null,
            is_global: true,
            is_active: true,
            title: t.title,
            description: t.description,
            preview_image_url: null,
            blocks: v.blocks as any,
          },
        ])
        .select('id')
        .single();
      if (!ins?.error) inserted += 1;
    }

    return NextResponse.json({ ok: true, inserted });
  } catch (e: unknown) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unexpected error' }, { status: 500 });
  }
}

