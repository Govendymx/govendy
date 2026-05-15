'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

type Draft = {
    id: string;
    prompt: string;
    image_url: string | null;
    title: string;
    subtitle: string;
    cta_text: string;
    cta_href: string;
    placement: string;
    status: 'generating' | 'pending' | 'approved' | 'rejected';
    created_at: string;
    reviewed_at: string | null;
};

export default function AdminBannerDraftsPage() {
    const [isBooting, setIsBooting] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [drafts, setDrafts] = useState<Draft[]>([]);
    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [processing, setProcessing] = useState<string | null>(null);
    const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data: userData } = await supabase.auth.getUser();
                if (!userData.user) { window.location.href = '/'; return; }
                const { data: adminRow } = await supabase
                    .from('admin_users').select('user_id').eq('user_id', userData.user.id).maybeSingle();
                if (!adminRow) { setError('Sin permisos de administrador'); return; }
                setIsAdmin(true);
                await loadDrafts();
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsBooting(false);
            }
        })();
    }, []);

    const loadDrafts = async () => {
        let query = supabase
            .from('banner_drafts')
            .select('*')
            .order('created_at', { ascending: false });

        if (filter !== 'all') query = query.eq('status', filter);
        const { data, error: err } = await query;
        if (err) { setError(err.message); return; }
        setDrafts((data as Draft[]) ?? []);
    };

    useEffect(() => { if (isAdmin) loadDrafts(); }, [filter, isAdmin]);

    const approveDraft = async (draft: Draft) => {
        setProcessing(draft.id);
        setError(null);
        setSuccess(null);
        try {
            // 1. Create banner in home_banners
            const { data: insertData, error: insertErr } = await supabase.from('home_banners').insert({
                title: draft.title,
                subtitle: draft.subtitle,
                image_url: draft.image_url,
                cta_text: draft.cta_text,
                cta_href: draft.cta_href,
                placement: 'live_dashboard',
                is_active: true,
                sort_order: 0,
            }).select('id').single();
            if (insertErr) {
                console.error('Insert home_banners error:', insertErr);
                throw new Error(`Error al publicar banner: ${insertErr.message} (code: ${insertErr.code})`);
            }
            console.log('Banner published to home_banners:', insertData);

            // 2. Update draft status
            const { data: userData } = await supabase.auth.getUser();
            await supabase.from('banner_drafts').update({
                status: 'approved',
                reviewed_at: new Date().toISOString(),
                reviewed_by: userData.user?.id,
            }).eq('id', draft.id);

            setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, status: 'approved' } : d));
            setSuccess(`✅ Banner "${draft.title}" aprobado y publicado (ID: ${insertData?.id})`);
        } catch (err: any) {
            setError(err.message || 'Error desconocido al aprobar');
        } finally {
            setProcessing(null);
        }
    };

    const cleanupStuckDrafts = async () => {
        try {
            await supabase.from('banner_drafts')
                .update({ status: 'rejected' })
                .eq('status', 'generating');
            setSuccess('Borradores atorados limpiados');
            await loadDrafts();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const rejectDraft = async (id: string) => {
        setProcessing(id);
        try {
            const { data: userData } = await supabase.auth.getUser();
            await supabase.from('banner_drafts').update({
                status: 'rejected',
                reviewed_at: new Date().toISOString(),
                reviewed_by: userData.user?.id,
            }).eq('id', id);
            setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'rejected' } : d));
            setSuccess('Banner rechazado');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setProcessing(null);
        }
    };

    const updateDraftText = async (draft: Draft) => {
        setProcessing(draft.id);
        try {
            await supabase.from('banner_drafts').update({
                title: draft.title,
                subtitle: draft.subtitle,
                cta_text: draft.cta_text,
            }).eq('id', draft.id);
            setDrafts(prev => prev.map(d => d.id === draft.id ? { ...d, ...draft } : d));
            setEditingDraft(null);
            setSuccess('Texto actualizado');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setProcessing(null);
        }
    };

    const triggerGeneration = async () => {
        setIsGenerating(true);
        setError(null);
        setSuccess(null);
        try {
            const secret = prompt('Ingresa el CRON_SECRET para generar banners:');
            if (!secret) { setIsGenerating(false); return; }
            const res = await fetch(`/api/cron/generate-banners?secret=${encodeURIComponent(secret)}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setSuccess(`✅ Banner generado correctamente. Recargando...`);
            setTimeout(() => loadDrafts(), 2000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    if (isBooting) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
                <div className="mx-auto max-w-6xl px-4 py-10">
                    <div className="h-14 rounded-2xl bg-white/70 ring-1 ring-black/5 animate-pulse" />
                    <div className="mt-6 grid grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-48 rounded-2xl bg-white/70 ring-1 ring-black/5 animate-pulse" />)}
                    </div>
                </div>
            </div>
        );
    }

    const counts = {
        pending: drafts.filter(d => d.status === 'pending').length,
        approved: drafts.filter(d => d.status === 'approved').length,
        rejected: drafts.filter(d => d.status === 'rejected').length,
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
            <div className="mx-auto max-w-6xl px-4 py-10">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <Link href="/admin/banners" className="text-sm text-gray-500 hover:text-gray-700">← Banners</Link>
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 ring-1 ring-purple-100">
                                ✨ IA
                            </span>
                        </div>
                        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Borradores de Banners IA</h1>
                        <p className="mt-1 text-sm text-gray-500">Revisa, edita y aprueba banners generados automáticamente</p>
                    </div>
                    <button
                        onClick={triggerGeneration}
                        disabled={isGenerating}
                        className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-all hover:scale-105 disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #a855f7)' }}
                    >
                        {isGenerating ? (
                            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</>
                        ) : (
                            <>✨ Generar nuevos banners</>
                        )}
                    </button>
                </div>

                {/* Messages */}
                {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
                {success && <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

                {/* Filter tabs */}
                <div className="flex gap-2 mb-6">
                    {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === f
                                ? 'bg-gray-900 text-white shadow-lg'
                                : 'bg-white text-gray-600 ring-1 ring-black/5 hover:bg-gray-50'
                                }`}
                        >
                            {f === 'pending' && `⏳ Pendientes${counts.pending ? ` (${counts.pending})` : ''}`}
                            {f === 'approved' && `✅ Aprobados${counts.approved ? ` (${counts.approved})` : ''}`}
                            {f === 'rejected' && `❌ Rechazados${counts.rejected ? ` (${counts.rejected})` : ''}`}
                            {f === 'all' && 'Todos'}
                        </button>
                    ))}
                </div>

                {/* Drafts grid */}
                {drafts.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-5xl mb-4">🎨</p>
                        <p className="text-lg font-bold text-gray-900">No hay borradores {filter !== 'all' ? `con status "${filter}"` : ''}</p>
                        <p className="text-sm text-gray-500 mt-1">Presiona "Generar nuevos banners" para crear borradores con IA</p>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {drafts.map(draft => (
                            <div key={draft.id} className="bg-white rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5 transition-all hover:shadow-lg">
                                {/* Image preview */}
                                <div className="relative aspect-[21/9] bg-gray-100">
                                    {draft.image_url ? (
                                        <>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={draft.image_url} alt={draft.title} className="w-full h-full object-cover" />
                                            {/* Text overlay preview */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/20 to-transparent flex items-center px-4">
                                                <div>
                                                    <p className="text-white font-black text-sm">{draft.title}</p>
                                                    {draft.subtitle && <p className="text-gray-200 text-xs mt-0.5">{draft.subtitle}</p>}
                                                    {draft.cta_text && (
                                                        <span className="inline-block mt-1.5 text-[10px] font-bold text-white px-3 py-1 rounded-md" style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}>
                                                            {draft.cta_text}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex items-center justify-center h-full">
                                            <span className="text-3xl animate-spin">⏳</span>
                                        </div>
                                    )}
                                    {/* Status badge */}
                                    <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-bold ${draft.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                        draft.status === 'approved' ? 'bg-green-100 text-green-800' :
                                            draft.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                'bg-blue-100 text-blue-800'
                                        }`}>
                                        {draft.status === 'pending' ? '⏳ Pendiente' :
                                            draft.status === 'approved' ? '✅ Aprobado' :
                                                draft.status === 'rejected' ? '❌ Rechazado' :
                                                    '🔄 Generando'}
                                    </div>
                                </div>

                                {/* Info */}
                                <div className="p-4">
                                    {editingDraft?.id === draft.id ? (
                                        <div className="space-y-2">
                                            <input value={editingDraft.title} onChange={e => setEditingDraft({ ...editingDraft, title: e.target.value })}
                                                className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Título" />
                                            <input value={editingDraft.subtitle} onChange={e => setEditingDraft({ ...editingDraft, subtitle: e.target.value })}
                                                className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Subtítulo" />
                                            <input value={editingDraft.cta_text} onChange={e => setEditingDraft({ ...editingDraft, cta_text: e.target.value })}
                                                className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="CTA" />
                                            <div className="flex gap-2">
                                                <button onClick={() => updateDraftText(editingDraft)}
                                                    className="flex-1 rounded-lg bg-gray-900 text-white text-sm font-bold py-2">Guardar</button>
                                                <button onClick={() => setEditingDraft(null)}
                                                    className="rounded-lg border px-3 py-2 text-sm text-gray-600">Cancelar</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="font-bold text-gray-900 text-sm">{draft.title}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{draft.subtitle}</p>
                                                </div>
                                                {draft.status === 'pending' && (
                                                    <button onClick={() => setEditingDraft({ ...draft })}
                                                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold">✏️ Editar</button>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-2 truncate">{new Date(draft.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>

                                            {/* Action buttons */}
                                            {draft.status === 'pending' && draft.image_url && (
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={() => approveDraft(draft)}
                                                        disabled={processing === draft.id}
                                                        className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02] disabled:opacity-50"
                                                        style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
                                                    >
                                                        {processing === draft.id ? '...' : '✅ Aprobar'}
                                                    </button>
                                                    <button
                                                        onClick={() => rejectDraft(draft.id)}
                                                        disabled={processing === draft.id}
                                                        className="flex-1 rounded-xl py-2.5 text-sm font-bold text-red-600 bg-red-50 ring-1 ring-red-200 transition-all hover:bg-red-100 disabled:opacity-50"
                                                    >
                                                        {processing === draft.id ? '...' : '❌ Rechazar'}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
