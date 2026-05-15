import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Estados de México
const MEXICAN_STATES = [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche',
    'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima',
    'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco',
    'México', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León',
    'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
    'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala',
    'Veracruz', 'Yucatán', 'Zacatecas'
];

export async function GET(req: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Verificar si es admin
        const admin = supabaseAdmin();
        const { data: isAdmin } = await admin
            .from('admin_users')
            .select('user_id')
            .eq('user_id', user.id)
            .single();

        if (!isAdmin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Obtener parámetros de fecha
        const url = new URL(req.url);
        const month = url.searchParams.get('month') || new Date().getMonth() + 1;
        const year = url.searchParams.get('year') || new Date().getFullYear();

        // Calcular inicio y fin del mes
        const startDate = new Date(Number(year), Number(month) - 1, 1);
        const endDate = new Date(Number(year), Number(month), 0, 23, 59, 59);

        console.log('Fetching stats for:', { month, year, startDate, endDate });

        // Query: Obtener usuarios únicos por estado (región)
        // Usamos ilike para capturar 'Mexico', 'México', 'MX', etc.
        const { data: ips, error } = await admin
            .from('user_ips')
            .select('user_id, region, country')
            .ilike('country', '%Mex%')
            .gte('detected_at', startDate.toISOString())
            .lte('detected_at', endDate.toISOString());

        if (error) throw error;

        console.log(`Stats By State: Found ${ips?.length} IPs for period.`);

        // Agrupar por estado (usuarios únicos)
        const stateStats = new Map<string, Set<string>>();

        ips?.forEach(ip => {
            if (ip.region) {
                // Normalizar nombre del estado
                const normalizedState = normalizeStateName(ip.region);

                if (!stateStats.has(normalizedState)) {
                    stateStats.set(normalizedState, new Set());
                }
                stateStats.get(normalizedState)!.add(ip.user_id);
            }
        });

        // Convertir a array con conteo de usuarios únicos
        const result = Array.from(stateStats.entries()).map(([state, users]) => ({
            state,
            unique_users: users.size,
            percentage: 0 // Calcularemos después
        }));

        // Calcular porcentajes
        const totalUsers = result.reduce((sum, s) => sum + s.unique_users, 0);
        result.forEach(s => {
            s.percentage = totalUsers > 0 ? (s.unique_users / totalUsers) * 100 : 0;
        });

        // Ordenar por usuarios (descendente)
        result.sort((a, b) => b.unique_users - a.unique_users);

        // Agregar estados sin usuarios
        const allStates = MEXICAN_STATES.map(state => {
            const existing = result.find(r => r.state === state);
            return existing || { state, unique_users: 0, percentage: 0 };
        });

        return NextResponse.json({
            month: Number(month),
            year: Number(year),
            total_unique_users: totalUsers,
            states: allStates
        });

    } catch (error: any) {
        console.error('Error fetching state stats:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Normalizar nombres de estados
function normalizeStateName(region: string): string {
    const normalized = region.trim();

    // Mapeo de variaciones comunes
    const mappings: Record<string, string> = {
        'CDMX': 'Ciudad de México',
        'Estado de México': 'México',
        'Edo. de México': 'México',
        'Veracruz de Ignacio de la Llave': 'Veracruz',
        'Michoacán de Ocampo': 'Michoacán',
        'Coahuila de Zaragoza': 'Coahuila',
    };

    return mappings[normalized] || normalized;
}
