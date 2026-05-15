'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Loader2, Calendar, User, Tag, CheckCircle, XCircle } from 'lucide-react';

export default function AdminFeaturedPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/featured/list', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al cargar');
      
      setItems(json.featured || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-pink-600" /></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">Gestión de Publicaciones Destacadas</h1>
      
      {error && <div className="p-4 mb-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-700">Publicación</th>
              <th className="px-6 py-4 font-medium text-gray-700">Usuario</th>
              <th className="px-6 py-4 font-medium text-gray-700">Plan</th>
              <th className="px-6 py-4 font-medium text-gray-700">Fechas</th>
              <th className="px-6 py-4 font-medium text-gray-700">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
              const isActive = item.status === 'active' && new Date(item.end_at) > new Date();
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-gray-100 flex-shrink-0 overflow-hidden">
                        {item.listing?.images?.[0] && (
                          <img
                            src={item.listing.images[0]}
                            alt={item.listing?.title || 'Publicación destacada'}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{item.listing?.title || 'Eliminada'}</div>
                        <div className="text-xs text-gray-500">{item.listing_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{item.user?.full_name || 'Desconocido'}</div>
                        <div className="text-xs text-gray-500">{item.user?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                      <Tag className="h-3 w-3" />
                      {item.plan_type?.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    <div className="flex flex-col gap-1 text-xs">
                      <span className="flex items-center gap-1">
                        Inicia: {new Date(item.start_at).toLocaleDateString('es-MX')}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        Vence: {new Date(item.end_at).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <CheckCircle className="h-3 w-3" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        <XCircle className="h-3 w-3" />
                        {item.status}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                  No hay publicaciones destacadas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
