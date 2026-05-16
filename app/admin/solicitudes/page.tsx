'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Phone, Mail, CheckCircle, Clock } from 'lucide-react';
import Link from 'next/link';

type PlanRequest = {
  id: string;
  user_id: string;
  requested_plan: string;
  status: string;
  contact_preference: string;
  created_at: string;
  user?: {
    id: string;
    email: string;
    raw_user_meta_data?: {
      name?: string;
      full_name?: string;
      phone?: string;
    };
  };
};

export default function SolicitudesAdminPage() {
  const [requests, setRequests] = useState<PlanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/plan-requests', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(json.error || 'Error al cargar solicitudes');

      setRequests(json.requests || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/plan-requests/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ request_id: id, status: newStatus })
      });

      if (!res.ok) throw new Error('Error al actualizar el estado');
      
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case 'pro': return <span className="bg-emerald-100 text-brand-emerald px-2 py-1 rounded-md text-xs font-bold uppercase">PRO</span>;
      case 'platinum': return <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-xs font-bold uppercase">PLATINUM ⭐</span>;
      case 'verification': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-xs font-bold uppercase">Insignia Azul ✓</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-md text-xs font-bold uppercase">{plan}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="flex items-center gap-1 text-amber-600"><Clock className="w-3 h-3" /> Pendiente</span>;
      case 'contacted': return <span className="flex items-center gap-1 text-blue-600"><Phone className="w-3 h-3" /> Contactado</span>;
      case 'resolved': return <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3 h-3" /> Atendido</span>;
      default: return <span>{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Solicitudes de Planes y Verificación</h1>
          <p className="text-gray-500 text-sm">Gestiona los usuarios que desean adquirir un paquete premium.</p>
        </div>
        <button onClick={loadRequests} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
          Actualizar
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6">{error}</div>}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Cargando solicitudes...</div>
        ) : requests.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No hay solicitudes pendientes.</div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Fecha</th>
                <th className="px-6 py-3 font-semibold">Usuario</th>
                <th className="px-6 py-3 font-semibold">Solicitud</th>
                <th className="px-6 py-3 font-semibold">Contacto</th>
                <th className="px-6 py-3 font-semibold">Estado</th>
                <th className="px-6 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map(req => {
                const userPhone = req.user?.raw_user_meta_data?.phone || '';
                const waLink = userPhone ? `https://wa.me/${userPhone.replace(/\D/g, '')}?text=Hola,%20nos%20comunicamos%20del%20equipo%20de%20GoVendy%20sobre%20tu%20solicitud.` : '#';

                return (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-500">{new Date(req.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{req.user?.raw_user_meta_data?.name || req.user?.raw_user_meta_data?.full_name || 'Usuario'}</div>
                      <div className="text-xs text-gray-500">{req.user?.email}</div>
                    </td>
                    <td className="px-6 py-4">{getPlanBadge(req.requested_plan)}</td>
                    <td className="px-6 py-4">
                      <div className="text-gray-900 capitalize">{req.contact_preference === 'phone' ? 'Llamada' : req.contact_preference}</div>
                      {userPhone && <div className="text-xs text-gray-500">{userPhone}</div>}
                    </td>
                    <td className="px-6 py-4 font-medium">{getStatusBadge(req.status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 items-center">
                        {userPhone && (
                          <a href={waLink} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200" title="Contactar por WhatsApp">
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <a href={`mailto:${req.user?.email}`} className="p-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200" title="Contactar por Email">
                          <Mail className="w-4 h-4" />
                        </a>
                        
                        {req.status === 'pending' && (
                          <button onClick={() => updateStatus(req.id, 'contacted')} className="ml-2 text-xs font-semibold px-2 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200">
                            Marcar Contactado
                          </button>
                        )}
                        {(req.status === 'pending' || req.status === 'contacted') && (
                          <button onClick={() => updateStatus(req.id, 'resolved')} className="ml-2 text-xs font-semibold px-2 py-1 bg-brand-emerald text-white rounded hover:bg-emerald-600">
                            Atendido
                          </button>
                        )}
                        
                        <Link href={`/admin/usuarios?search=${req.user_id}`} className="ml-2 text-xs text-gray-500 underline hover:text-gray-900">
                          Ver Perfil
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
