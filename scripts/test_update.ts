import { createClient } from '@supabase/supabase-js';

async function testUpdate() {
    const url = "https://xlnxdzocwgrzqoznmarc.supabase.co";
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY";

    const supabase = createClient(url, key);

    // Buscar un listing pausado
    const { data: list, error: findErr } = await supabase
        .from('listings')
        .select('id,status,expires_at')
        .eq('status', 'paused')
        .limit(1)
        .maybeSingle();

    if (findErr) {
        console.error('Error al buscar listing:', findErr.message);
        return;
    }

    if (!list) {
        console.log('No se encontró ningún listing pausado para probar.');
        return;
    }

    console.log('Listing encontrado:', list);

    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    console.log('Intentando actualizar a status: active y expires_at:', newExpiresAt);

    const { data: updated, error: updErr } = await supabase
        .from('listings')
        .update({
            status: 'active',
            expires_at: newExpiresAt
        })
        .eq('id', list.id)
        .select()
        .single();

    if (updErr) {
        console.error('Error al actualizar:', updErr.message);
    } else {
        console.log('Actualización exitosa (según respuesta):', {
            id: updated.id,
            status: updated.status,
            expires_at: updated.expires_at
        });

        // Verificación final
        const { data: final } = await supabase
            .from('listings')
            .select('id,status,expires_at')
            .eq('id', list.id)
            .single();

        console.log('Estado final en DB:', final);
    }
}

testUpdate();
