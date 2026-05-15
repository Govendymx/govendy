'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

type Campaign = {
    id: string;
    advertiser_name: string;
    type: 'overlay' | 'video' | 'product_spotlight';
    title: string;
    subtitle: string | null;
    content_url: string | null;
    target_url: string | null;
    cta_text: string | null;
    duration_secs: number;
    frequency_mins: number;
    is_active: boolean;
    priority: number;
    impressions: number;
    clicks: number;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
};

const TYPE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
    overlay: { label: 'Overlay Banner', emoji: '🏷️', color: 'bg-blue-100 text-blue-700' },
    video: { label: 'Video Pre/Mid-roll', emoji: '🎬', color: 'bg-purple-100 text-purple-700' },
    product_spotlight: { label: 'Product Spotlight', emoji: '🛍️', color: 'bg-amber-100 text-amber-700' },
};

const EMPTY_FORM = {
    advertiser_name: 'GoVendy',
    type: 'overlay' as Campaign['type'],
    title: '',
    subtitle: '',
    content_url: '',
    target_url: '',
    cta_text: 'Ver más',
    duration_secs: 10,
    frequency_mins: 15,
    is_active: true,
    priority: 0,
};

export default function AdminAdCampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const { data, error: err } = await supabase
            .from('live_ad_campaigns')
            .select('*')
            .order('priority', { ascending: false });
        if (err) setError(err.message);
        else setCampaigns((data || []) as Campaign[]);
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const payload = {
                ...form,
                subtitle: form.subtitle || null,
                content_url: form.content_url || null,
                target_url: form.target_url || null,
                cta_text: form.cta_text || 'Ver más',
            };

            if (editId) {
                const { error: err } = await supabase
                    .from('live_ad_campaigns')
                    .update(payload)
                    .eq('id', editId);
                if (err) throw err;
            } else {
                const { error: err } = await supabase
                    .from('live_ad_campaigns')
                    .insert(payload);
                if (err) throw err;
            }

            setShowForm(false);
            setEditId(null);
            setForm(EMPTY_FORM);
            await load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (id: string, active: boolean) => {
        await supabase.from('live_ad_campaigns').update({ is_active: !active }).eq('id', id);
        await load();
    };

    const deleteCampaign = async (id: string) => {
        if (!confirm('¿Eliminar esta campaña permanentemente?')) return;
        await supabase.from('live_ad_campaigns').delete().eq('id', id);
        await load();
    };

    const editCampaign = (c: Campaign) => {
        setForm({
            advertiser_name: c.advertiser_name,
            type: c.type,
            title: c.title,
            subtitle: c.subtitle || '',
            content_url: c.content_url || '',
            target_url: c.target_url || '',
            cta_text: c.cta_text || 'Ver más',
            duration_secs: c.duration_secs,
            frequency_mins: c.frequency_mins,
            is_active: c.is_active,
            priority: c.priority,
        });
        setEditId(c.id);
        setShowForm(true);
    };

    // Stats
    const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);
    const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);
    const activeCampaigns = campaigns.filter(c => c.is_active).length;

    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <Link href="/admin" className="text-xs text-gray-400 hover:text-gray-600 mb-1 block">← Admin Panel</Link>
                    <h1 className="text-2xl font-black text-gray-900">📺 Campañas de Anuncios</h1>
                    <p className="text-sm text-gray-500 mt-1">Gestiona los anuncios que aparecen en lives gratuitos</p>
                </div>
                <button
                    onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}
                    className="rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-4 py-2.5 shadow-lg hover:shadow-xl transition-all hover:scale-105"
                >
                    + Nueva Campaña
                </button>
            </div>

            {error && (
                <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>
            )}

            {/* Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-4 text-center">
                    <div className="text-2xl font-black text-gray-900">{campaigns.length}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Campañas</div>
                </div>
                <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-4 text-center">
                    <div className="text-2xl font-black text-green-600">{activeCampaigns}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Activas</div>
                </div>
                <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-4 text-center">
                    <div className="text-2xl font-black text-blue-600">{totalImpressions.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Impresiones</div>
                </div>
                <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-4 text-center">
                    <div className="text-2xl font-black text-purple-600">{totalClicks.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase mt-1">Clicks</div>
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-black text-gray-900 mb-4">{editId ? '✏️ Editar Campaña' : '➕ Nueva Campaña'}</h2>

                        <div className="space-y-3">
                            {/* Type */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Tipo</label>
                                <div className="grid grid-cols-3 gap-2 mt-1">
                                    {Object.entries(TYPE_LABELS).map(([key, v]) => (
                                        <button key={key}
                                            onClick={() => setForm({ ...form, type: key as any })}
                                            className={`rounded-xl text-xs font-bold py-2 px-2 transition-all ${form.type === key ? 'bg-gray-900 text-white ring-2 ring-gray-900 shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                        >{v.emoji} {v.label}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Título</label>
                                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                                    placeholder="Ej: ¡Vendé en vivo con GoVendy!"
                                    className="w-full mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" />
                            </div>

                            {/* Subtitle */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Subtítulo (opcional)</label>
                                <input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
                                    placeholder="Texto secundario"
                                    className="w-full mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" />
                            </div>

                            {/* Advertiser */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Anunciante</label>
                                <input value={form.advertiser_name} onChange={e => setForm({ ...form, advertiser_name: e.target.value })}
                                    className="w-full mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" />
                            </div>

                            {/* Content URL */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">
                                    {form.type === 'video' ? 'URL del Video (mp4/webm)' : 'URL de Imagen'}
                                </label>
                                <input value={form.content_url} onChange={e => setForm({ ...form, content_url: e.target.value })}
                                    placeholder="https://..."
                                    className="w-full mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" />
                                {form.content_url && (
                                    <div className="mt-2 rounded-xl bg-gray-50 p-2">
                                        {form.content_url.match(/\.(mp4|webm|mov)/i) ? (
                                            <video src={form.content_url} controls muted className="w-full h-32 rounded-lg object-contain bg-black" />
                                        ) : (
                                            <img src={form.content_url} alt="preview" className="w-full h-32 rounded-lg object-contain" />
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Target URL */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">URL de destino (al hacer click)</label>
                                <input value={form.target_url} onChange={e => setForm({ ...form, target_url: e.target.value })}
                                    placeholder="https://gopocket.com.mx/..."
                                    className="w-full mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" />
                            </div>

                            {/* CTA */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Texto del botón (CTA)</label>
                                <input value={form.cta_text} onChange={e => setForm({ ...form, cta_text: e.target.value })}
                                    className="w-full mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" />
                            </div>

                            {/* Duration + Frequency */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Duración (seg)</label>
                                    <input type="number" min={3} max={30} value={form.duration_secs}
                                        onChange={e => setForm({ ...form, duration_secs: +e.target.value })}
                                        className="w-full mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Frecuencia (min)</label>
                                    <input type="number" min={1} max={60} value={form.frequency_mins}
                                        onChange={e => setForm({ ...form, frequency_mins: +e.target.value })}
                                        className="w-full mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" />
                                </div>
                            </div>

                            {/* Priority */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase">Prioridad (mayor = se muestra primero)</label>
                                <input type="number" min={0} max={100} value={form.priority}
                                    onChange={e => setForm({ ...form, priority: +e.target.value })}
                                    className="w-full mt-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none" />
                            </div>

                            {/* Active toggle */}
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setForm({ ...form, is_active: !form.is_active })}
                                    className={`w-10 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all ${form.is_active ? 'left-5' : 'left-1'}`} />
                                </button>
                                <span className="text-sm font-semibold text-gray-700">{form.is_active ? 'Activa' : 'Inactiva'}</span>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-5">
                            <button onClick={() => { setShowForm(false); setEditId(null); }}
                                className="flex-1 rounded-xl bg-gray-100 text-gray-600 text-sm font-bold py-2.5 hover:bg-gray-200 transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSave} disabled={!form.title || saving}
                                className="flex-1 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold py-2.5 disabled:opacity-50 transition-all shadow-lg">
                                {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear Campaña'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Campaign list */}
            {loading ? (
                <div className="py-16 text-center text-gray-400 text-sm">Cargando campañas…</div>
            ) : campaigns.length === 0 ? (
                <div className="py-16 text-center">
                    <div className="text-5xl mb-3">📺</div>
                    <div className="text-gray-500 text-sm font-medium">No hay campañas aún. Crea la primera.</div>
                </div>
            ) : (
                <div className="space-y-3">
                    {campaigns.map(c => {
                        const typeInfo = TYPE_LABELS[c.type] || TYPE_LABELS.overlay;
                        const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : '0.0';
                        return (
                            <div key={c.id} className={`rounded-2xl bg-white ring-1 p-4 transition-all ${c.is_active ? 'ring-gray-100' : 'ring-gray-100 opacity-60'}`}>
                                <div className="flex items-start gap-4">
                                    {/* Preview */}
                                    {c.content_url ? (
                                        c.content_url.match(/\.(mp4|webm|mov)/i) ? (
                                            <video src={c.content_url} muted className="w-20 h-20 rounded-xl object-cover bg-black shrink-0" />
                                        ) : (
                                            <img src={c.content_url} alt="" className="w-20 h-20 rounded-xl object-cover shrink-0" />
                                        )
                                    ) : (
                                        <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-3xl shrink-0">
                                            {typeInfo.emoji}
                                        </div>
                                    )}

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${typeInfo.color}`}>
                                                {typeInfo.emoji} {typeInfo.label}
                                            </span>
                                            <span className={`w-2 h-2 rounded-full ${c.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                                        </div>
                                        <div className="text-sm font-bold text-gray-900 truncate">{c.title}</div>
                                        <div className="text-xs text-gray-400 mt-0.5">{c.advertiser_name} · {c.duration_secs}s · cada {c.frequency_mins}min</div>

                                        {/* Metrics */}
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="text-xs">
                                                <span className="font-black text-blue-600">{c.impressions.toLocaleString()}</span>
                                                <span className="text-gray-400 ml-1">impr.</span>
                                            </div>
                                            <div className="text-xs">
                                                <span className="font-black text-purple-600">{c.clicks.toLocaleString()}</span>
                                                <span className="text-gray-400 ml-1">clicks</span>
                                            </div>
                                            <div className="text-xs">
                                                <span className="font-black text-amber-600">{ctr}%</span>
                                                <span className="text-gray-400 ml-1">CTR</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col gap-1 shrink-0">
                                        <button onClick={() => editCampaign(c)}
                                            className="rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-3 py-1.5 transition-colors">
                                            ✏️ Editar
                                        </button>
                                        <button onClick={() => toggleActive(c.id, c.is_active)}
                                            className={`rounded-lg text-xs font-bold px-3 py-1.5 transition-colors ${c.is_active ? 'bg-orange-100 hover:bg-orange-200 text-orange-700' : 'bg-green-100 hover:bg-green-200 text-green-700'
                                                }`}>
                                            {c.is_active ? '⏸ Pausar' : '▶ Activar'}
                                        </button>
                                        <button onClick={() => deleteCampaign(c.id)}
                                            className="rounded-lg bg-red-100 hover:bg-red-200 text-red-600 text-xs font-bold px-3 py-1.5 transition-colors">
                                            🗑 Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
