import { createClient } from '@supabase/supabase-js';

async function checkColumns() {
    const url = "https://xlnxdzocwgrzqoznmarc.supabase.co";
    const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsbnhkem9jd2dyenFvem5tYXJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODc4MjM2NywiZXhwIjoyMDg0MzU4MzY3fQ.ZJA4T-u9SaSFwgLwHOYXyravjB-lkhTIX2zwi17ahxY";

    if (!url || !key) {
        console.log('Faltan URL o Service Role Key en el entorno.');
        return;
    }

    const supabase = createClient(url, key);

    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'listings' });

    if (error) {
        // Si RPC no existe, probamos una consulta directa al esquema si tenemos permisos
        console.log('RPC get_table_columns falló, intentando query directa...');
        const { data: cols, error: err2 } = await supabase
            .from('listings')
            .select('*')
            .limit(1);

        if (err2) {
            console.error('Error al consultar tabla:', err2.message);
        } else if (cols && cols.length > 0) {
            const keys = Object.keys(cols[0]).sort();
            console.log('Listado de columnas:');
            keys.forEach(k => console.log(' - ' + k));
        } else {
            console.log('No se pudieron obtener columnas (tabla vacía o sin acceso).');
        }
    } else {
        console.log('Columnas:', data);
    }
}

checkColumns();
