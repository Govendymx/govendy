'use client';

import { useState, useRef } from 'react';
import StarIcon from '@heroicons/react/20/solid/StarIcon';
import XMarkIcon from '@heroicons/react/20/solid/XMarkIcon';
import PhotoIcon from '@heroicons/react/20/solid/PhotoIcon';
import Image from 'next/image';
import { supabase } from '@/lib/supabase/client';

interface ReviewFormProps {
  listingId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReviewForm({ listingId, onClose, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Feature ratings
  const [features, setFeatures] = useState({
    capacidad: 0,
    relacion_precio_calidad: 0,
    facilidad_al_limpiar: 0,
    facilidad_de_uso: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsSubmitting(true); // Block submit while uploading
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('file', files[i]);
    }

    try {
      // Assuming a generic upload endpoint that returns { url }
      // If batch upload not supported, do one by one.
      // Let's assume one by one for safety or check API. 
      // Using /api/upload assuming it returns { url: string }

      const newImages = [...images];
      const { data: { session: uploadSession } } = await supabase.auth.getSession();
      for (let i = 0; i < files.length; i++) {
        const fd = new FormData();
        fd.append('file', files[i]);
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: fd,
          headers: uploadSession?.access_token ? { 'Authorization': `Bearer ${uploadSession.access_token}` } : {},
        });
        const data = await res.json();
        if (data.url) newImages.push(data.url);
      }
      setImages(newImages);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Error al subir imágenes');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Por favor califica el producto');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Debes iniciar sesión para escribir una reseña');
        setIsSubmitting(false);
        return;
      }

      const res = await fetch(`/api/listings/${listingId}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          rating,
          title,
          content,
          images,
          feature_ratings: features
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al enviar opinión');

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Escribir opinión</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Overall Rating */}
          <div className="flex flex-col items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Calificación general</label>
            <div className="flex gap-1" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <StarIcon
                    className={`h-10 w-10 ${(hoverRating || rating) >= star ? 'text-blue-500' : 'text-gray-200'
                      }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-sm font-medium text-blue-600">
              {(hoverRating || rating) > 0 ? (hoverRating || rating) + '.0' : 'Selecciona una calificación'}
            </span>
          </div>

          {/* Feature Ratings */}
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(features).map(([key, value]) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-gray-600 capitalize">
                  {key.replace(/_/g, ' ')}
                </label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeatures(prev => ({ ...prev, [key]: star }))}
                      className="focus:outline-none"
                    >
                      <StarIcon
                        className={`h-5 w-5 ${value >= star ? 'text-blue-500' : 'text-gray-200'
                          }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Título de la opinión</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Ej: Excelente producto, muy recomendado"
              required
            />
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Tu opinión</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Cuéntanos más sobre lo que te gustó o no te gustó..."
              required
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Fotos</label>
            <div className="mt-2 flex flex-wrap gap-4">
              {images.map((url, i) => (
                <div key={i} className="relative h-20 w-20 overflow-hidden rounded-lg border border-gray-200 group">
                  <Image src={url} alt="" fill className="object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition"
              >
                <PhotoIcon className="h-6 w-6" />
                <span className="text-xs">Agregar</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Enviando...' : 'Enviar opinión'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
