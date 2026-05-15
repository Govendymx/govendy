'use client';

import { useState } from 'react';

export type WholesaleTier = {
    min: number;
    max: number | null; // null = unlimited
    price: number;
};

interface WholesaleTierEditorProps {
    tiers: WholesaleTier[];
    onChange: (tiers: WholesaleTier[]) => void;
    basePrice?: number;
}

export function WholesaleTierEditor({ tiers, onChange, basePrice }: WholesaleTierEditorProps) {
    const [error, setError] = useState<string | null>(null);

    const addTier = () => {
        const last = tiers[tiers.length - 1];
        const newMin = last ? (last.max ? last.max + 1 : last.min + 10) : 1;
        const newPrice = last ? Math.max(1, Math.round(last.price * 0.85)) : (basePrice ? Math.round(basePrice * 0.9) : 100);
        onChange([...tiers, { min: newMin, max: newMin + 9, price: newPrice }]);
        setError(null);
    };

    const removeTier = (index: number) => {
        const next = tiers.filter((_, i) => i !== index);
        onChange(next);
        setError(null);
    };

    const updateTier = (index: number, field: keyof WholesaleTier, value: string) => {
        const next = [...tiers];
        if (field === 'max' && (value === '' || value === '∞')) {
            next[index] = { ...next[index], max: null };
        } else {
            const num = parseInt(value, 10);
            if (isNaN(num) || num < 0) return;
            next[index] = { ...next[index], [field]: num };
        }
        onChange(next);
        setError(null);
    };

    const validate = (): boolean => {
        if (tiers.length < 2) {
            setError('Se necesitan al menos 2 rangos para mayoreo.');
            return false;
        }
        if (tiers[0].min !== 1) {
            setError('El primer rango debe empezar en 1.');
            return false;
        }
        for (let i = 0; i < tiers.length; i++) {
            const t = tiers[i];
            if (t.price <= 0) {
                setError(`El precio del rango ${i + 1} debe ser mayor a 0.`);
                return false;
            }
            if (t.max !== null && t.min > t.max) {
                setError(`El rango ${i + 1}: "De" no puede ser mayor a "Hasta".`);
                return false;
            }
            if (i > 0) {
                const prev = tiers[i - 1];
                if (prev.max === null) {
                    setError(`Solo el último rango puede ser ilimitado.`);
                    return false;
                }
                if (t.min !== prev.max + 1) {
                    setError(`El rango ${i + 1} debe empezar en ${prev.max! + 1} (sin huecos ni solapamientos).`);
                    return false;
                }
                if (t.price >= prev.price) {
                    setError(`El precio del rango ${i + 1} ($${t.price}) debe ser menor al anterior ($${prev.price}).`);
                    return false;
                }
            }
        }
        setError(null);
        return true;
    };

    return (
        <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Rangos de precio</div>

            {tiers.length === 0 && (
                <div className="text-xs text-gray-500">No hay rangos configurados. Agrega al menos 2 para activar mayoreo.</div>
            )}

            {tiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                        <span className="font-medium">De</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={tier.min}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9]/g, '');
                                if (v === '') {
                                    updateTier(i, 'min', '0');
                                } else {
                                    updateTier(i, 'min', v);
                                }
                            }}
                            className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-900 text-center outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/20"
                        />
                        <span className="font-medium">a</span>
                        <input
                            type="text"
                            inputMode="numeric"
                            value={tier.max === null ? '∞' : tier.max}
                            onFocus={(e) => {
                                if (e.target.value === '∞') e.target.value = '';
                                e.target.select();
                            }}
                            onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v === '' || v === '∞') {
                                    updateTier(i, 'max', '');
                                }
                            }}
                            onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9]/g, '');
                                if (v === '') {
                                    updateTier(i, 'max', '');
                                } else {
                                    updateTier(i, 'max', v);
                                }
                            }}
                            placeholder="∞"
                            className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-900 text-center outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/20"
                        />
                        <span className="font-medium">pzas →</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">$</span>
                        <input
                            type="text"
                            inputMode="decimal"
                            value={tier.price}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9.]/g, '');
                                if (v === '' || v === '.') {
                                    updateTier(i, 'price', '0');
                                } else {
                                    updateTier(i, 'price', v);
                                }
                            }}
                            className="w-20 rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs font-bold text-gray-900 text-center outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/20"
                        />
                        <span className="text-xs text-gray-500">c/u</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => removeTier(i)}
                        className="ml-auto rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="Eliminar rango"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            ))}

            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={addTier}
                    className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-brand-orange shadow-sm ring-1 ring-pink-200 hover:bg-pink-50 transition-colors"
                >
                    + Agregar rango
                </button>
                {tiers.length >= 2 && (
                    <button
                        type="button"
                        onClick={validate}
                        className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-green-700 shadow-sm ring-1 ring-green-200 hover:bg-green-50 transition-colors"
                    >
                        ✓ Validar rangos
                    </button>
                )}
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                    ⚠️ {error}
                </div>
            )}

            {tiers.length >= 2 && !error && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
                    ✅ {tiers.length} rangos configurados. Los compradores verán descuentos al seleccionar más cantidad.
                </div>
            )}
        </div>
    );
}
