'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { TemplateBlock } from '@/lib/templates/blocks';

interface Template {
    id: string;
    title: string;
    description: string;
    blocks: TemplateBlock[];
    is_global: boolean;
    owner_id: string;
}

interface TemplateSelectorProps {
    onSelect: (blocks: TemplateBlock[]) => void;
    onClose: () => void;
}

export function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) {
                setError('Debes iniciar sesión para ver plantillas');
                return;
            }

            // Fetch plantillas globales + del usuario
            const { data, error: fetchError } = await supabase
                .from('listing_templates')
                .select('id, title, description, blocks, is_global, owner_id')
                .or(`and(is_global.eq.true,is_active.eq.true),owner_id.eq.${userData.user.id}`)
                .order('is_global', { ascending: false })
                .order('updated_at', { ascending: false });

            if (fetchError) throw fetchError;

            setTemplates((data as Template[]) || []);
        } catch (e: any) {
            setError(e.message || 'Error al cargar plantillas');
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (template: Template) => {
        onSelect(template.blocks);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-4xl rounded-3xl bg-white shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-gray-900">Plantillas de Descripción</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        >
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                        Selecciona una plantilla para comenzar con una descripción profesional
                    </p>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-emerald border-t-transparent"></div>
                                <p className="mt-4 text-sm text-gray-600">Cargando plantillas...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-center">
                            <p className="text-sm font-semibold text-red-800">{error}</p>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="rounded-2xl bg-gray-50 border border-gray-200 p-8 text-center">
                            <p className="text-sm text-gray-600">No hay plantillas disponibles</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2">
                            {templates.map((template) => (
                                <button
                                    type="button"
                                    key={template.id}
                                    onClick={() => handleSelect(template)}
                                    className="group rounded-2xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-brand-emerald hover:shadow-lg"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-gray-900 group-hover:text-brand-emerald">
                                                {template.title}
                                            </h3>
                                            <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                                                {template.description || 'Sin descripción'}
                                            </p>
                                        </div>
                                        {template.is_global && (
                                            <span className="ml-2 rounded-full bg-brand-emerald px-2 py-1 text-xs font-bold text-white">
                                                Global
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                                        <span>{template.blocks?.length || 0} bloques</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-xl bg-gray-100 px-4 py-2.5 font-semibold text-gray-700 hover:bg-gray-200"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}
