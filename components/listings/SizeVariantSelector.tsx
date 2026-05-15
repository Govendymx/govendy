'use client';

import { useState } from 'react';

interface SizeVariantSelectorProps {
    sizeType: 'clothing' | 'shoes';
    selectedSizes: string[];
    sizeStock: Record<string, number>;
    onSizesChange: (sizes: string[]) => void;
    onStockChange: (sizeStock: Record<string, number>) => void;
    onSizeTypeChange: (sizeType: 'clothing' | 'shoes') => void;
    allowedTypes?: ('clothing' | 'shoes')[];
}

const CLOTHING_SIZES = ['SCH', 'CH', 'M', 'G', 'XL', 'XXL', 'XXXL', 'XXXXL'];

// Tallas de calzado según guía mexicana
const SHOE_SIZES_BABIES = ['11', '11.5', '12', '12.5', '13', '13.5']; // Bebés (9-18 meses)
const SHOE_SIZES_KIDS = ['14', '14.5', '15', '15.5', '16', '16.5', '17', '17.5', '18', '18.5', '19', '19.5', '20', '20.5', '21', '21.5', '22', '22.5']; // 1-10 años
const SHOE_SIZES_WOMEN = ['22', '22.5', '23', '23.5', '24', '24.5', '25', '25.5', '26', '26.5', '27', '27.5', '28', '28.5'];
const SHOE_SIZES_MEN = ['24', '24.5', '25', '25.5', '26', '26.5', '27', '27.5', '28', '28.5', '29', '29.5', '30', '30.5', '31'];

export function SizeVariantSelector({
    sizeType,
    selectedSizes,
    sizeStock,
    onSizesChange,
    onStockChange,
    onSizeTypeChange,
    allowedTypes = ['clothing', 'shoes']
}: SizeVariantSelectorProps) {
    const [shoeCategory, setShoeCategory] = useState<'babies' | 'kids' | 'women' | 'men'>('kids');

    const availableSizes = sizeType === 'clothing'
        ? CLOTHING_SIZES
        : shoeCategory === 'babies'
            ? SHOE_SIZES_BABIES
            : shoeCategory === 'kids'
                ? SHOE_SIZES_KIDS
                : shoeCategory === 'women'
                    ? SHOE_SIZES_WOMEN
                    : SHOE_SIZES_MEN;

    const toggleSize = (size: string) => {
        if (selectedSizes.includes(size)) {
            // Remove size
            onSizesChange(selectedSizes.filter(s => s !== size));
            const newStock = { ...sizeStock };
            delete newStock[size];
            onStockChange(newStock);
        } else {
            // Add size
            onSizesChange([...selectedSizes, size]);
            onStockChange({ ...sizeStock, [size]: 1 });
        }
    };

    const updateStock = (size: string, stock: number) => {
        onStockChange({ ...sizeStock, [size]: Math.max(0, stock) });
    };

    return (
        <div className="space-y-4">
            {/* Size Type Toggle - Only show if we have more than 1 allowed type */}
            {allowedTypes.length > 1 && (
                <div className="flex gap-2">
                    {allowedTypes.includes('clothing') && (
                        <button
                            type="button"
                            onClick={() => {
                                onSizeTypeChange('clothing');
                                onSizesChange([]);
                                onStockChange({});
                            }}
                            className={`px-4 py-2 rounded-xl font-semibold transition-all ${sizeType === 'clothing'
                                ? 'bg-brand-orange text-white shadow-lg'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Ropa
                        </button>
                    )}
                    {allowedTypes.includes('shoes') && (
                        <button
                            type="button"
                            onClick={() => {
                                onSizeTypeChange('shoes');
                                onSizesChange([]);
                                onStockChange({});
                            }}
                            className={`px-4 py-2 rounded-xl font-semibold transition-all ${sizeType === 'shoes'
                                ? 'bg-brand-orange text-white shadow-lg'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Calzado
                        </button>
                    )}
                </div>
            )}

            {/* Shoe Category Selector */}
            {sizeType === 'shoes' && (
                <div className="flex gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setShoeCategory('babies')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${shoeCategory === 'babies'
                            ? 'bg-pink-100 text-brand-orange'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Bebés
                    </button>
                    <button
                        type="button"
                        onClick={() => setShoeCategory('kids')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${shoeCategory === 'kids'
                            ? 'bg-pink-100 text-brand-orange'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Niños
                    </button>
                    <button
                        type="button"
                        onClick={() => setShoeCategory('women')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${shoeCategory === 'women'
                            ? 'bg-pink-100 text-brand-orange'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Mujer
                    </button>
                    <button
                        type="button"
                        onClick={() => setShoeCategory('men')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${shoeCategory === 'men'
                            ? 'bg-pink-100 text-brand-orange'
                            : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        Hombre
                    </button>
                </div>
            )}

            {/* Size Chips */}
            <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">
                    Selecciona las tallas disponibles:
                </p>
                <div className="flex flex-wrap gap-2">
                    {availableSizes.map((size) => (
                        <button
                            key={size}
                            type="button"
                            onClick={() => toggleSize(size)}
                            className={`px-4 py-2 rounded-xl font-bold transition-all ${selectedSizes.includes(size)
                                ? 'bg-brand-orange text-white shadow-lg ring-2 ring-brand-orange/20'
                                : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-brand-orange hover:text-brand-orange'
                                }`}
                        >
                            {size}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stock Inputs */}
            {selectedSizes.length > 0 && (
                <div className="space-y-3 rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-700">
                        Stock por talla:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {selectedSizes.map((size) => (
                            <div key={size} className="space-y-1">
                                <label className="text-xs font-semibold text-gray-600">
                                    Talla {size}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={sizeStock[size] ?? 1}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                        updateStock(size, isNaN(val) ? 0 : val);
                                    }}
                                    className="w-full rounded-xl border-gray-200 px-3 py-2 text-sm font-semibold focus:border-brand-orange focus:ring-brand-orange"
                                    placeholder="Stock"
                                />
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 rounded-xl bg-white p-3 border border-gray-200">
                        <p className="text-sm font-semibold text-gray-900">
                            Stock total: {Object.values(sizeStock).reduce((a, b) => a + b, 0)} unidades
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
