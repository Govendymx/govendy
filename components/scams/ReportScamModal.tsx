'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type ReportScamModalProps = {
  isOpen: boolean;
  onClose: () => void;
  reporterId: string;
  defaultListingId?: string;
  defaultSuspectId?: string;
};

export function ReportScamModal({ isOpen, onClose, reporterId, defaultListingId, defaultSuspectId }: ReportScamModalProps) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || !description.trim()) {
      setError('Por favor, selecciona un motivo y escribe una descripción detallada.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('scam_reports')
        .insert({
          reporter_id: reporterId,
          suspect_id: defaultSuspectId || null,
          listing_id: defaultListingId || null,
          reason,
          description: description.trim(),
          status: 'pending',
        });

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setReason('');
        setDescription('');
        onClose();
      }, 3000);
    } catch (err: any) {
      console.error('Error enviando reporte:', err);
      setError(err.message || 'Ocurrió un error al enviar el reporte. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-red-50/50 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h3 className="text-base font-black text-gray-900 uppercase tracking-wide">Reportar Estafa</h3>
              <p className="text-xs font-medium text-gray-500">Este reporte es 100% anónimo.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
                <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-gray-900">¡Reporte Enviado!</h4>
              <p className="mt-2 text-sm text-gray-600">Nuestro equipo de seguridad revisará tu caso en menos de 24 horas.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              
              <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-700">Motivo de sospecha</label>
                <div className="relative">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-4 py-3 pr-10 text-sm font-medium text-gray-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  >
                    <option value="" disabled>Selecciona un motivo...</option>
                    <option value="Fraude con pago">Me pidieron depósito o transferencia directa</option>
                    <option value="Venta fuera de plataforma">Intentan llevar la venta fuera de GoVendy</option>
                    <option value="Artículo falso">Sospecho que el artículo es falso o no existe</option>
                    <option value="Suplantación de identidad">Perfil falso o suplantación de identidad</option>
                    <option value="Otro">Otro motivo grave</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-700">Detalles adicionales</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Por favor, proporciona toda la información posible para ayudarnos en la investigación..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
              </div>

              {error && (
                <div className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-600">
                  {error}
                </div>
              )}

              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-200"
                  disabled={isSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-700 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    'Enviar Reporte'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
