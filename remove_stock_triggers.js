const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function run() {
    const envPath = path.join(process.cwd(), '.env.local');
    let envMap = {};

    if (fs.existsSync(envPath)) {
        const env = fs.readFileSync(envPath, 'utf8');
        env.split('\n').filter(Boolean).forEach(line => {
            const [k, ...v] = line.split('=');
            if (k) envMap[k.trim()] = v.join('=').trim().replace(/^"(.*)"$/, '$1');
        });
    }

    // Usar valores de vercel.json si no están en .env.local
    const url = envMap.NEXT_PUBLIC_SUPABASE_URL || "https://xlnxdzocwgrzqoznmarc.supabase.co";
    // La service role key debe ser proporcionada por el usuario o estar en .env.local
    // Si no está, intentaremos con la anon key (aunque probablemente falle para DROP TRIGGER)
    const key = envMap.SUPABASE_SERVICE_ROLE_KEY || envMap.SUPABASE_SERVICE_KEY;

    if (!key) {
        console.error('ERROR: No se encontró SUPABASE_SERVICE_ROLE_KEY en .env.local');
        console.log('Por favor, ejecuta este SQL manualmente en el Editor de Supabase:');
        console.log(`
DROP TRIGGER IF EXISTS trg_check_stock_and_pause ON public.listings;
DROP TRIGGER IF EXISTS trg_check_size_stock_and_pause ON public.listings;
DROP FUNCTION IF EXISTS public.check_stock_and_pause();
DROP FUNCTION IF EXISTS public.check_size_stock_and_pause();
    `);
        return;
    }

    const supabase = createClient(url, key);

    console.log('Eliminando triggers de stock...');

    const sql = `
    DROP TRIGGER IF EXISTS trg_check_stock_and_pause ON public.listings;
    DROP TRIGGER IF EXISTS trg_check_size_stock_and_pause ON public.listings;
    DROP FUNCTION IF EXISTS public.check_stock_and_pause();
    DROP FUNCTION IF EXISTS public.check_size_stock_and_pause();
  `;

    // Intentar ejecutar vía rpc si existe una función de ejecución de SQL
    // O informar al usuario para que lo haga manualmente si no hay acceso directo.
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(e => ({ error: e }));

    if (error) {
        console.log('No se pudo ejecutar automáticamente (posiblemente falta permiso de rpc).');
        console.log('EJECUTA ESTO EN EL SQL EDITOR DE SUPABASE:');
        console.log(sql);
    } else {
        console.log('✅ Triggers eliminados exitosamente.');
    }
}

run();
