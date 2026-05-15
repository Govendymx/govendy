import { createServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

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

        console.log('Fetching IP frequency for:', { month, year });

        // Query: Obtener todas las IPs del período
        const { data: ips, error } = await admin
            .from('user_ips')
            .select('ip_address, city, country, isp, detected_at')
            .gte('detected_at', startDate.toISOString())
            .lte('detected_at', endDate.toISOString());

        if (error) throw error;

        // Agrupar por IP y contar conexiones
        const ipFrequency = new Map<string, {
            count: number;
            city: string;
            country: string;
            isp: string;
            first_seen: string;
            last_seen: string;
        }>();

        ips?.forEach(ip => {
            if (!ipFrequency.has(ip.ip_address)) {
                ipFrequency.set(ip.ip_address, {
                    count: 0,
                    city: ip.city || 'Unknown',
                    country: ip.country || 'Unknown',
                    isp: ip.isp || 'Unknown',
                    first_seen: ip.detected_at,
                    last_seen: ip.detected_at
                });
            }

            const entry = ipFrequency.get(ip.ip_address)!;
            entry.count++;

            // Actualizar last_seen si es más reciente
            if (new Date(ip.detected_at) > new Date(entry.last_seen)) {
                entry.last_seen = ip.detected_at;
            }

            // Actualizar first_seen si es más antiguo
            if (new Date(ip.detected_at) < new Date(entry.first_seen)) {
                entry.first_seen = ip.detected_at;
            }
        });

        // Convertir a array
        const result = Array.from(ipFrequency.entries()).map(([ip, data]) => ({
            ip_address: ip,
            connections: data.count,
            city: data.city,
            country: data.country,
            isp: data.isp,
            first_seen: data.first_seen,
            last_seen: data.last_seen
        }));

        // Ordenar por número de conexiones (descendente)
        result.sort((a, b) => b.connections - a.connections);

        // Estadísticas generales
        const totalConnections = result.reduce((sum, r) => sum + r.connections, 0);
        const uniqueIPs = result.length;

        return NextResponse.json({
            month: Number(month),
            year: Number(year),
            total_connections: totalConnections,
            unique_ips: uniqueIPs,
            average_connections_per_ip: uniqueIPs > 0 ? totalConnections / uniqueIPs : 0,
            top_ips: result.slice(0, 50), // Top 50 IPs más frecuentes
            all_ips: result
        });

    } catch (error: any) {
        console.error('Error fetching IP frequency:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
