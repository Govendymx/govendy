'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Activity, TrendingUp } from 'lucide-react';

interface IPFrequency {
    ip_address: string;
    connections: number;
    city: string;
    country: string;
    isp: string;
    first_seen: string;
    last_seen: string;
}

interface FrequencyData {
    month: number;
    year: number;
    total_connections: number;
    unique_ips: number;
    average_connections_per_ip: number;
    top_ips: IPFrequency[];
}

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function IPFrequencyPanel() {
    const [stats, setStats] = useState<FrequencyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/security/stats/ip-frequency?month=${selectedMonth}&year=${selectedYear}`);
            const data = await res.json();
            setStats(data);
        } catch (error) {
            console.error('Error fetching IP frequency:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [selectedMonth, selectedYear]);

    const topIPs = stats?.top_ips || [];

    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500/10 rounded-xl">
                        <Wifi className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Frecuencia de IPs</h3>
                        <p className="text-sm text-gray-500">Conexiones por IP por mes</p>
                    </div>
                </div>

                {/* Selector de Mes/Año */}
                <div className="flex gap-2">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                        {MONTH_NAMES.map((name, idx) => (
                            <option key={idx} value={idx + 1}>{name}</option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                        {[2024, 2025, 2026, 2027].map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-500 border-t-transparent"></div>
                </div>
            ) : (
                <>
                    {/* Stats Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-purple-600 mb-1">
                                <Activity className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase">Conexiones</span>
                            </div>
                            <div className="text-2xl font-bold text-purple-900">{stats?.total_connections || 0}</div>
                            <div className="text-xs text-purple-600">totales</div>
                        </div>

                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-orange-600 mb-1">
                                <Wifi className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase">IPs Únicas</span>
                            </div>
                            <div className="text-2xl font-bold text-orange-900">{stats?.unique_ips || 0}</div>
                            <div className="text-xs text-orange-600">diferentes</div>
                        </div>

                        <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-pink-600 mb-1">
                                <TrendingUp className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase">Promedio</span>
                            </div>
                            <div className="text-2xl font-bold text-pink-900">
                                {stats?.average_connections_per_ip ? stats.average_connections_per_ip.toFixed(1) : '0'}
                            </div>
                            <div className="text-xs text-pink-600">conexiones/IP</div>
                        </div>
                    </div>

                    {/* Top IPs Table */}
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                        <div className="max-h-[400px] overflow-y-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">IP</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ubicación</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ISP</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Conexiones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {topIPs.map((ip, idx) => (
                                        <motion.tr
                                            key={ip.ip_address}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ delay: idx * 0.03 }}
                                            className="hover:bg-gray-50 transition-colors"
                                        >
                                            <td className="px-4 py-3">
                                                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx === 0 ? 'bg-yellow-500 text-white' :
                                                        idx === 1 ? 'bg-gray-400 text-white' :
                                                            idx === 2 ? 'bg-orange-600 text-white' :
                                                                'bg-gray-200 text-gray-600'
                                                    }`}>
                                                    {idx + 1}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-mono text-sm text-gray-900">{ip.ip_address}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-gray-900">{ip.city}</div>
                                                <div className="text-xs text-gray-500">{ip.country}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm text-gray-700 truncate max-w-[200px]" title={ip.isp}>
                                                    {ip.isp}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-700">
                                                    {ip.connections}
                                                </span>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>

                            {topIPs.length === 0 && (
                                <div className="text-center py-12 text-gray-500">
                                    No hay datos para este período
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
