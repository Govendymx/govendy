'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { X, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

interface ReportModalProps {
    listingId: string;
    isOpen: boolean;
    onClose: () => void;
}

const REPORT_REASONS = [
    'Producto prohibido o ilegal',
    'Posible fraude o estafa',
    'Información de contacto en el título/imagen',
    'Precio abusivo o irreal',
    'Categoría incorrecta',
    'Contenido ofensivo o inapropiado',
    'Falsificación o imitación',
    'Otro motivo'
];

export function ReportModal({ listingId, isOpen, onClose }: ReportModalProps) {
    const [reason, setReason] = useState('');
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason) {
            setError('Por favor selecciona un motivo');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setError('Debes iniciar sesión para reportar una publicación');
                setIsSubmitting(false);
                return;
            }

            const res = await fetch('/api/listings/report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    listingId,
                    reason,
                    comment
                })
            });

            const json = await res.json();
            if (res.ok) {
                setIsSuccess(true);
                setTimeout(() => {
                    onClose();
                    setIsSuccess(false);
                    setReason('');
                    setComment('');
                }, 2000);
            } else {
                setError(json.error || 'Error al enviar el reporte');
            }
        } catch (err) {
            setError('Error de conexión. Inténtalo de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="text-amber-500" size={20} />
                        <h3 className="text-lg font-bold text-gray-900">Denunciar publicación</h3>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {isSuccess ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in duration-300">
                            <div className="mb-4 rounded-full bg-green-100 p-3 text-green-600">
                                <CheckCircle2 size={40} />
                            </div>
                            <h4 className="text-xl font-bold text-gray-900">¡Reporte enviado!</h4>
                            <p className="mt-2 text-gray-500">Un administrador revisará la publicación pronto. Gracias por ayudarnos a mantener segura la comunidad.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700">
                                    Motivo de la denuncia
                                </label>
                                <select
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                                    required
                                >
                                    <option value="">Selecciona un motivo...</option>
                                    {REPORT_REASONS.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-bold text-gray-700">
                                    Comentarios adicionales (opcional)
                                </label>
                                <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    className="h-24 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                                    placeholder="Danos más detalles sobre el problema..."
                                />
                            </div>

                            {error && (
                                <div className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 ring-1 ring-red-100">
                                    {error}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !reason}
                                    className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-brand-orange py-3 text-sm font-bold text-white shadow-lg shadow-brand-orange/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : 'Enviar denuncia'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
