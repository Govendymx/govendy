'use client';

import { useRef, useState } from 'react';
import { Camera, Plus, X, UploadCloud, Trash2 } from 'lucide-react';

interface ImageUploaderProps {
    existingImages: string[];
    files: File[];
    previewUrls: string[];
    maxImages: number;
    onSelectFiles: (files: File[]) => void;
    onRemoveExisting: (index: number) => void;
    onRemoveNew: (index: number) => void;
}

export default function ImageUploader({
    existingImages,
    files,
    previewUrls,
    maxImages,
    onSelectFiles,
    onRemoveExisting,
    onRemoveNew,
}: ImageUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const totalCount = existingImages.length + files.length;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFiles = Array.from(e.target.files);
            const remainingSlots = maxImages - totalCount;
            if (remainingSlots <= 0) {
                alert(`Ya has alcanzado el límite de ${maxImages} imágenes.`);
                return;
            }
            onSelectFiles(selectedFiles.slice(0, remainingSlots));
            if (e.target.value) e.target.value = ''; // Reset input
        }
    };

    const triggerSelect = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Camera className="text-brand-emerald" size={20} />
                    Imágenes de tu producto
                </h2>
                <div className={`text-sm font-black px-3 py-1 rounded-full ${totalCount >= maxImages ? 'bg-red-100 text-red-600' : 'bg-pink-50 text-brand-emerald'
                    }`}>
                    {totalCount}/{maxImages}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {/* Existing Images */}
                {existingImages.map((url, idx) => (
                    <div key={`exist-${idx}`} className="group relative aspect-square rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden transition-all hover:border-brand-emerald/50">
                        <img src={url} alt={`Existente ${idx}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                                type="button"
                                onClick={() => onRemoveExisting(idx)}
                                className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors shadow-lg"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-white/90 text-[10px] font-bold text-gray-500 shadow-sm">
                            FOTO {idx + 1}
                        </div>
                    </div>
                ))}

                {/* New Preview Images */}
                {previewUrls.map((url, idx) => (
                    <div key={`new-${idx}`} className="group relative aspect-square rounded-2xl border-2 border-brand-emerald/20 bg-pink-50/30 overflow-hidden transition-all hover:border-brand-emerald">
                        <img src={url} alt={`Nueva ${idx}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                                type="button"
                                onClick={() => onRemoveNew(idx)}
                                className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors shadow-lg"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-brand-emerald text-[10px] font-bold text-white shadow-sm uppercase">
                            Nueva
                        </div>
                    </div>
                ))}

                {/* Upload Slots */}
                {totalCount < maxImages && (
                    <button
                        type="button"
                        onClick={triggerSelect}
                        className="group relative aspect-square rounded-2xl border-2 border-dashed border-gray-300 bg-white flex flex-col items-center justify-center gap-2 transition-all hover:border-brand-emerald hover:bg-pink-50/50 hover:shadow-md active:scale-95"
                    >
                        <div className="p-3 rounded-full bg-gray-50 group-hover:bg-brand-emerald/10 transition-colors">
                            <Plus size={24} className="text-gray-400 group-hover:text-brand-emerald" />
                        </div>
                        <span className="text-[11px] font-bold text-gray-400 group-hover:text-brand-emerald uppercase tracking-wider">
                            Agregar foto
                        </span>
                    </button>
                )}

                {/* Placeholder Slots to complete a nice grid look if few images */}
                {Array.from({ length: Math.max(0, 5 - (totalCount % 5 === 0 ? 5 : totalCount % 5)) }).map((_, i) => (
                    totalCount + i + 1 < maxImages ? (
                        <div key={`placeholder-${i}`} className="aspect-square rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50/30 opacity-40 hidden md:block" />
                    ) : null
                ))}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                multiple
                className="hidden"
            />

            {totalCount === 0 && (
                <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/50">
                    <UploadCloud className="text-gray-300 mb-2" size={48} />
                    <p className="text-sm font-medium text-gray-400">Arrastra tus fotos aquí o haz clic en el botón</p>
                    <button
                        type="button"
                        onClick={triggerSelect}
                        className="mt-4 px-6 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 shadow-sm hover:bg-gray-50 transition-all"
                    >
                        Elegir Archivos
                    </button>
                </div>
            )}

            <p className="text-[11px] text-gray-400 italic">
                * Recomendamos fotos con fondo blanco para mejores resultados. Límite máximo: {maxImages} fotos.
            </p>
        </div>
    );
}
