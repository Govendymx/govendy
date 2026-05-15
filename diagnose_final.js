const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Cargar env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- Diagnóstico de Publicaciones Normales ---');
    const { data, error } = await supabase
        .from('listings')
        .select('id, title, status, sale_type, expires_at, updated_at')
        .eq('sale_type', 'direct')
        .order('updated_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.table(data);

    if (data.length > 0) {
        const first = data[0];
        const now = Date.now();
        const expires = first.expires_at ? Date.parse(first.expires_at) : null;
        console.log(`\nAnálisis de la publicación más reciente:`);
        console.log(`ID: ${first.id}`);
        console.log(`Expires At (raw): ${first.expires_at}`);
        console.log(`Expires At (ms): ${expires}`);
        console.log(`Now (ms): ${now}`);
        console.log(`Diff (h): ${expires ? (expires - now) / 3600000 : 'N/A'}`);

        if (expires && expires < now) {
            console.log('¡ALERTA! La publicación está marcada como expirada.');
        } else {
            console.log('La publicación NO está expirada.');
        }
    }
}

run();
