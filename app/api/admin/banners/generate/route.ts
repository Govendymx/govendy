import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateBanner } from '@/lib/replicate';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { uploadImageWithWatermark } from '@/lib/cloudinary/utils';

export async function POST(request: Request) {
  try {
    // 1. Validar autenticación vía Header (Bearer Token)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Cliente para verificar sesión
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Admin check
    const admin = supabaseAdmin();
    const { data: adminRow } = await admin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!adminRow) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 3. Parse body
    const body = await request.json();
    const { prompt, aspectRatio } = body;

    if (!process.env.REPLICATE_API_TOKEN) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN no está configurado en el servidor (.env).' }, { status: 500 });
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // 4. Generate image
    // Map UI aspect ratios to Replicate supported ones if needed
    // The UI in admin page supports many, but lib/replicate.ts types define specific ones.
    // valid: "16:9" | "1:1" | "21:9" | "3:2" | "4:5" | "9:16"
    
    // We'll let the client pass the valid one, or default to 21:9 for banners if not specified.
    // For mid4/mid5 (24:9), we might approximate with 21:9 or just pass it if the model supports it (Flux allows custom sometimes, but let's stick to the type definition in lib/replicate for safety or cast it).
    
    const output = await generateBanner({
      prompt,
      aspectRatio: aspectRatio || '21:9',
    });

    // Flux Schnell output is typically [ "https://..." ]
    const replicateUrl = Array.isArray(output) ? output[0] : output;

    // Upload to Cloudinary to make it persistent
    // Replicate URLs expire after 1 hour
    const cloudinaryUrl = await uploadImageWithWatermark(replicateUrl, {
      folder: 'banners/ai-generated',
    });

    return NextResponse.json({ url: cloudinaryUrl });
  } catch (error: any) {
    console.error('Error generating banner:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate banner' },
      { status: 500 }
    );
  }
}
