import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(req: Request) {
  try {
    const { effectiveUserId } = await requireAuth(req as any);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      }
    );

    const formData = await req.formData();
    const orderId = formData.get('orderId') as string;
    const file = formData.get('file') as File;

    if (!orderId || !file) {
      return NextResponse.json({ error: 'Faltan datos (orderId o file)' }, { status: 400 });
    }

    // Validar que la orden pertenezca al vendedor
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, seller_id, status, shipping_option_id')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    if (order.seller_id !== effectiveUserId) {
      return NextResponse.json({ error: 'No tienes permiso para modificar esta orden' }, { status: 403 });
    }

    // Subir archivo a Storage
    // Usamos 'delivery-proofs' porque ya existe y es para evidencia.
    const fileExt = file.name.split('.').pop();
    const fileName = `guide_${orderId}_${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    // Convertir File a Buffer para asegurar compatibilidad en Node environment
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Usar cliente admin para asegurar acceso al bucket y crearlo si no existe
    const admin = supabaseAdmin();
    const bucketName = 'delivery-proofs';

    // Verificar si existe el bucket, si no, crearlo
    const { data: buckets } = await admin.storage.listBuckets();
    const bucketExists = buckets?.find(b => b.name === bucketName);
    
    if (!bucketExists) {
      await admin.storage.createBucket(bucketName, { public: true });
    }

    const { error: uploadError } = await admin.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading self-ship evidence:', uploadError);
      return NextResponse.json({ error: `Error al subir el archivo: ${uploadError.message}` }, { status: 500 });
    }

    // Obtener URL pública
    const { data: { publicUrl } } = admin.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    // Retornamos la URL para que el cliente la use en mark-shipped
    return NextResponse.json({ url: publicUrl });
  } catch (error: any) {
    console.error('Error en upload-self-ship-evidence:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
