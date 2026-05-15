'use client';

import { useState } from 'react';
import Image from 'next/image';

interface ColorVariantManagerProps {
    colors: string[];
    onColorsChange: (colors: string[]) => void;
}

export function ColorVariantManager({
    colors,
    onColorsChange
}: ColorVariantManagerProps) {
    const [newColor, setNewColor] = useState('');

    const addColor = () => {
        if (newColor.trim() && !colors.includes(newColor.trim())) {
            onColorsChange([...colors, newColor.trim()]);
            setNewColor('');
        }
    };

    const removeColor = (color: string) => {
        onColorsChange(colors.filter(c => c !== color));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addColor();
        }
    };

    return (
        <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">
                Agrega variantes de color (opcional):
            </p>

            {/* Color List */}
            {colors.length > 0 && (
                <div className="space-y-2">
                    {colors.map((color, index) => (
                        <div
                            key={index}
                            className="flex items-center gap-3 rounded-xl bg-white border-2 border-gray-200 p-3 hover:border-brand-orange transition-colors"
                        >
                            <div className="flex-1">
                                <p className="font-semibold text-gray-900">{color}</p>
                                <p className="text-xs text-gray-500">
                                    Las imágenes se asignarán automáticamente
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => removeColor(color)}
                                className="rounded-lg p-2 text-red-500 hover:bg-red-50 transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Color Input */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ej. Rojo, Azul, Negro..."
                    className="flex-1 rounded-xl border-gray-200 px-4 py-2.5 font-medium focus:border-brand-orange focus:ring-brand-orange"
                />
                <button
                    type="button"
                    onClick={addColor}
                    disabled={!newColor.trim()}
                    className="rounded-xl bg-brand-orange px-6 py-2.5 font-bold text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    Agregar
                </button>
            </div>

            {colors.length === 0 && (
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                    <p className="text-sm text-gray-500">
                        No hay variantes de color. Agrega colores para ofrecer más opciones a tus compradores.
                    </p>
                </div>
            )}
        </div>
    );
}
