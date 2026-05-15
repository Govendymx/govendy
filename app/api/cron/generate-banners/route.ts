import { NextRequest, NextResponse } from 'next/server';
import { generateBanner } from '@/lib/replicate';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { uploadImageWithWatermark } from '@/lib/cloudinary/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow up to 2 min for multiple generations

// ═══════════════════════════════════════════════════════════
// Pool de prompts curados — diseño gráfico profesional
// SIN texto en la imagen (el texto se renderiza via CSS)
// ═══════════════════════════════════════════════════════════
const CURATED_PROMPTS = [
    // 🟣 Gradiente rosa-morado con moda
    {
        prompt: 'Professional e-commerce banner, flat design, vibrant pink to purple gradient background, fashion accessories floating composition with designer handbag high heels sunglasses and silk scarf, clean white space on left for text, no text no words no letters in image, commercial product photography, high contrast sharp edges graphic design quality, panoramic wide format',
        title: '¡COMPRA EN VIVO!',
        subtitle: 'Ofertas exclusivas solo en GoVendy Live',
        cta_text: 'Ir al Live',
    },
    // 🟠 Gradiente naranja vibrante con celular
    {
        prompt: 'Wide promotional banner, bold orange to yellow gradient background, smartphone showing live shopping stream with floating hearts and engagement icons, fashion items around phone including sneakers handbag and accessories, modern flat commercial design, no text no words no letters, clean professional e-commerce quality, panoramic format',
        title: 'MODA EN DIRECTO',
        subtitle: 'Transmite y vende tu ropa en vivo',
        cta_text: 'Empezar Live',
    },
    // 🔵 Fondo oscuro premium con neon
    {
        prompt: 'Premium dark banner, deep navy blue to black gradient, neon orange and red light accents, smartphone with live streaming app glowing screen, luxury fashion items floating around with bokeh lights, professional graphic design quality, no text no words no letters, cinematic lighting, wide panoramic format',
        title: 'OFERTAS EN VIVO',
        subtitle: 'Descuentos que solo encuentras en Live',
        cta_text: 'Ver ofertas',
    },
    // 🟡 Amarillo vibrante estilo marketplace
    {
        prompt: 'Bright vivid yellow gradient banner for e-commerce, clean modern design, fashion products arranged artistically including colorful dresses shoes bags and jewelry, white clean space on left side, professional flat design style, no text no words no letters, commercial marketplace quality, wide panoramic banner format',
        title: 'HASTA 50% DESCUENTO',
        subtitle: 'Las mejores ofertas de moda en GoVendy',
        cta_text: 'Explorar',
    },
    // 🔴 Rojo energético con live shopping
    {
        prompt: 'Energetic red to coral gradient wide banner, live shopping concept with smartphone screen showing fashion model, shopping bags and fashion accessories scattered around, hearts and like icons floating, professional graphic design, no text no words no letters in image, clean edges high quality, panoramic e-commerce banner',
        title: '¡ESTAMOS EN VIVO!',
        subtitle: 'Únete al live shopping de GoVendy',
        cta_text: 'Ver ahora',
    },
    // 💜 Morado lujoso con productos
    {
        prompt: 'Luxurious purple to magenta gradient banner, premium fashion products floating composition, designer sunglasses silk scarves high heel shoes elegant handbag, sparkle and gold accents, professional flat graphic design, no text no words no letters, clean commercial quality, wide panoramic format',
        title: 'MODA EXCLUSIVA',
        subtitle: 'Prendas únicas a precios increíbles',
        cta_text: 'Descubrir',
    },
    // 🩷 Rosa moderno con accesorios
    {
        prompt: 'Modern hot pink to soft pink gradient wide banner, trendy fashion accessories arranged in stylish composition, cute handbags sneakers hats and jewelry, social media shopping icons floating, clean professional flat design, no text no words no letters in image, e-commerce marketplace quality, panoramic format',
        title: 'NUEVA TEMPORADA',
        subtitle: 'Lo más trendy llega a GoVendy Live',
        cta_text: 'Ver colección',
    },
    // 🌙 Negro elegante con destellos
    {
        prompt: 'Elegant black to dark gray gradient banner, gold and warm amber light streaks, luxury fashion items including leather bag designer shoes and accessories with subtle glow, premium minimalist design, no text no words no letters, professional quality commercial banner, wide panoramic format',
        title: 'LIVE PREMIUM',
        subtitle: 'Transmite y gana con GoVendy',
        cta_text: 'Comenzar',
    },
    // 🧡 Durazno cálido con lifestyle
    {
        prompt: 'Warm peach to orange sunset gradient banner, lifestyle fashion shopping concept, colorful clothing items and accessories artistically arranged, phone with live stream hearts floating, cheerful vibrant design, no text no words no letters, professional flat commercial quality, wide panoramic format',
        title: 'VENDE EN VIVO',
        subtitle: 'Miles de compradores te esperan',
        cta_text: 'Ir al Live',
    },
    // 💙 Azul eléctrico con tecnología
    {
        prompt: 'Electric blue to teal gradient wide banner, modern tech-fashion crossover, smartphone displaying live commerce stream surrounded by trendy fashion items, neon light effects and geometric shapes, sleek professional design, no text no words no letters in image, high-end commercial quality, panoramic format',
        title: 'LIVE SHOPPING',
        subtitle: 'La nueva forma de comprar moda',
        cta_text: 'Explorar',
    },
];

/**
 * Cron endpoint: genera banners automáticamente cada 3 días
 * Se ejecuta via Vercel Cron: "0 8 every-3-days" (cada 3 días a las 8am)
 */
export async function GET(req: NextRequest) {
    // ── Auth ──
    const secret = req.nextUrl.searchParams.get('secret');
    const authHeader = req.headers.get('authorization');
    const envSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

    if (envSecret) {
        const ok = secret === envSecret || authHeader === `Bearer ${envSecret}`;
        if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!process.env.REPLICATE_API_TOKEN) {
        return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
    }

    const admin = supabaseAdmin();

    try {
        // Seleccionar 1 prompt aleatorio del pool (1 por ejecución para evitar timeout)
        const item = CURATED_PROMPTS[Math.floor(Math.random() * CURATED_PROMPTS.length)];

        // 1. Crear draft en status 'generating'
        const { data: draft, error: insertErr } = await admin
            .from('banner_drafts')
            .insert({
                prompt: item.prompt,
                title: item.title,
                subtitle: item.subtitle,
                cta_text: item.cta_text,
                cta_href: '/dashboard/live',
                placement: 'live_dashboard',
                status: 'generating',
            })
            .select('id')
            .single();

        if (insertErr || !draft) {
            console.error('[CRON-BANNERS] Insert error:', insertErr);
            return NextResponse.json({ error: 'Failed to insert draft', details: insertErr?.message }, { status: 500 });
        }

        console.log(`[CRON-BANNERS] Draft created: ${draft.id}, generating: "${item.title}"`);

        // 2. Generar imagen con Replicate (Flux Dev)
        const output = await generateBanner({
            prompt: item.prompt,
            aspectRatio: '21:9',
        });

        const replicateUrl = Array.isArray(output) ? output[0] : (typeof output === 'string' ? output : String(output));
        console.log(`[CRON-BANNERS] Replicate output URL: ${replicateUrl?.substring(0, 80)}...`);

        if (!replicateUrl) {
            throw new Error('Replicate returned empty output');
        }

        // 3. Intentar subir a Cloudinary, si falla usar URL de Replicate directo
        let finalUrl = replicateUrl;
        try {
            const cloudinaryUrl = await uploadImageWithWatermark(replicateUrl, {
                folder: 'banners/ai-generated',
            });
            finalUrl = cloudinaryUrl;
            console.log(`[CRON-BANNERS] Cloudinary OK: ${cloudinaryUrl?.substring(0, 60)}...`);
        } catch (uploadErr: any) {
            console.warn(`[CRON-BANNERS] ⚠️ Cloudinary failed, using Replicate URL: ${uploadErr?.message}`);
        }

        // 4. Actualizar draft a 'pending' con URL
        await admin
            .from('banner_drafts')
            .update({ image_url: finalUrl, status: 'pending' })
            .eq('id', draft.id);

        console.log(`[CRON-BANNERS] ✅ Generated: "${item.title}"`);

        return NextResponse.json({
            ok: true,
            banner: { id: draft.id, title: item.title, status: 'pending', image_url: finalUrl },
        });
    } catch (err: any) {
        console.error('[CRON-BANNERS] ❌ Error:', err?.message || err);
        return NextResponse.json({
            error: err?.message || 'Unknown error',
            stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined
        }, { status: 500 });
    }
}
