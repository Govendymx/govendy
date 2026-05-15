import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(req: Request) {
    try {
        const { effectiveUserId } = await requireAuth(req as any);

        const body = await req.json();
        const { orderId, fileName, contentType } = body;

        if (!orderId || !fileName) {
            return NextResponse.json({ error: 'Faltan datos (orderId o fileName)' }, { status: 400 });
        }

        const admin = supabaseAdmin();

        // Verify order belongs to this user
        const { data: order, error: orderError } = await admin
            .from('orders')
            .select('id, seller_id')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
        }

        if (order.seller_id !== effectiveUserId) {
            return NextResponse.json({ error: 'No tienes permiso' }, { status: 403 });
        }

        const bucketName = 'delivery-proofs';

        // Ensure bucket exists
        const { data: buckets } = await admin.storage.listBuckets();
        const bucketExists = buckets?.find(b => b.name === bucketName);
        if (!bucketExists) {
            await admin.storage.createBucket(bucketName, {
                public: true,
                fileSizeLimit: 52428800,
            });
        }

        // Generate unique file path
        const safeFileName = (fileName || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${orderId}_${Date.now()}_${Math.random().toString(36).slice(2)}_${safeFileName}`;

        // Create signed upload URL (valid for 5 minutes)
        const { data: signedData, error: signedError } = await admin.storage
            .from(bucketName)
            .createSignedUploadUrl(path);

        if (signedError || !signedData) {
            console.error('[signed-upload] Error creating signed URL:', signedError);
            return NextResponse.json({ error: 'No se pudo generar la URL de subida' }, { status: 500 });
        }

        // Get the public URL for after upload
        const { data: { publicUrl } } = admin.storage.from(bucketName).getPublicUrl(path);

        return NextResponse.json({
            signedUrl: signedData.signedUrl,
            token: signedData.token,
            path,
            publicUrl,
        });
    } catch (error: any) {
        console.error('[signed-upload] Error:', error?.message || error);
        return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
    }
}
