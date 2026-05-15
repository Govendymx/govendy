'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, TrendingUp, Users } from 'lucide-react';

interface StateStats {
    state: string;
    unique_users: number;
    percentage: number;
}

interface StatsData {
    month: number;
    year: number;
    total_unique_users: number;
    states: StateStats[];
}

const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function StateStatsPanel() {
    const [stats, setStats] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/admin/security/stats/by-state?month=${selectedMonth}&year=${selectedYear}`);
            const data = await res.json();
            setStats(data);
        } catch (error) {
            console.error('Error fetching state stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [selectedMonth, selectedYear]);

    const topStates = stats?.states.filter(s => s.unique_users > 0).slice(0, 10) || [];

    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 rounded-xl">
                        <MapPin className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Usuarios por Estado</h3>
                        <p className="text-sm text-gray-500">Usuarios únicos por mes (México)</p>
                    </div>
                </div>

                {/* Selector de Mes/Año */}
                <div className="flex gap-2">
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {MONTH_NAMES.map((name, idx) => (
                            <option key={idx} value={idx + 1}>{name}</option>
                        ))}
                    </select>
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {[2024, 2025, 2026, 2027].map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent"></div>
                </div>
            ) : (
                <>
                    {/* Stats Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-blue-600 mb-1">
                                <Users className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase">Total</span>
                            </div>
                            <div className="text-2xl font-bold text-blue-900">{stats?.total_unique_users || 0}</div>
                            <div className="text-xs text-blue-600">usuarios únicos</div>
                        </div>

                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-green-600 mb-1">
                                <TrendingUp className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase">Estados</span>
                            </div>
                            <div className="text-2xl font-bold text-green-900">{topStates.length}</div>
                            <div className="text-xs text-green-600">con actividad</div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4">
                            <div className="flex items-center gap-2 text-purple-600 mb-1">
                                <MapPin className="h-4 w-4" />
                                <span className="text-xs font-semibold uppercase">Top Estado</span>
                            </div>
                            <div className="text-lg font-bold text-purple-900">{topStates[0]?.state || 'N/A'}</div>
                            <div className="text-xs text-purple-600">{topStates[0]?.unique_users || 0} usuarios</div>
                        </div>
                    </div>

                    {/* Top 10 States */}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                        {topStates.map((state, idx) => (
                            <motion.div
                                key={state.state}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="relative bg-gradient-to-r from-gray-50 to-transparent rounded-lg p-3 hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center justify-center w-8 h-8 bg-blue-500 text-white rounded-full text-sm font-bold">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{state.state}</div>
                                            <div className="text-xs text-gray-500">{state.unique_users} usuario{state.unique_users !== 1 ? 's' : ''}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-blue-600">{state.percentage.toFixed(1)}%</div>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${state.percentage}%` }}
                                        transition={{ duration: 0.8, delay: idx * 0.05 }}
                                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                                    />
                                </div>
                            </motion.div>
                        ))}

                        {topStates.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                                No hay datos para este período
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
