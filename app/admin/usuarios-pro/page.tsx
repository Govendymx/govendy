'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { format, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search, Filter, RefreshCw, Bell, AlertTriangle, CheckCircle, Clock, DollarSign, Download, Calendar, Crown } from 'lucide-react';
import { toast } from 'sonner';

// --- Types ---
type ProUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_pro: boolean;
  plan_type: string;
  pro_subscription_start: string | null;
  pro_subscription_end: string | null;
  wallet_balance?: number;
};

// --- Components ---

function Countdown({ targetDate }: { targetDate: string }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [color, setColor] = useState('text-gray-700');

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date();
      const end = new Date(targetDate);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Vencido');
        setColor('text-red-600 font-bold');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);

      if (days < 3) setColor('text-red-600 font-bold');
      else if (days < 7) setColor('text-yellow-600 font-bold');
      else setColor('text-green-600');
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return <span className={`font-mono ${color}`}>{timeLeft}</span>;
}

export default function AdminProUsersPage() {
  const [users, setUsers] = useState<ProUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, expiring, expired
  const [planFilter, setPlanFilter] = useState('all'); // all, pro, platinum
  const [sortConfig, setSortConfig] = useState<{ key: keyof ProUser; direction: 'asc' | 'desc' } | null>(null);

  // --- Actions State ---
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewTarget, setRenewTarget] = useState<ProUser | null>(null);
  const [renewDays, setRenewDays] = useState(30);
  const [renewCost, setRenewCost] = useState(199); // Default cost, maybe configurable
  const [isRenewing, setIsRenewing] = useState(false);

  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('Tu suscripción PRO está por vencer. ¡Renueva ahora para mantener tus beneficios!');
  const [isNotifying, setIsNotifying] = useState(false);

  // --- Data Fetching ---
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/pro-users', {
        cache: 'no-store', // Disable caching
        headers: {
          'Authorization': 'Bearer ADMIN_SECRET_KEY'
        }
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Error fetching pro users');

      console.log('Pro Users Data:', data); // Debug log
      setUsers(data);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      toast.error('Error al cargar usuarios: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // --- Filtering & Sorting ---
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Filter by Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u =>
        (u.full_name?.toLowerCase() || '').includes(q) ||
        (u.email?.toLowerCase() || '').includes(q)
      );
    }

    // Filter by Plan Type
    if (planFilter === 'pro') {
      result = result.filter(u => (u.plan_type || '').toLowerCase() === 'pro');
    } else if (planFilter === 'platinum') {
      result = result.filter(u => (u.plan_type || '').toLowerCase() === 'platinum');
    }

    // Filter by Status
    const now = new Date();
    if (filter === 'active') {
      result = result.filter(u => u.pro_subscription_end && new Date(u.pro_subscription_end) > now);
    } else if (filter === 'expiring') {
      const warningDate = addDays(now, 7);
      result = result.filter(u =>
        u.pro_subscription_end &&
        new Date(u.pro_subscription_end) > now &&
        new Date(u.pro_subscription_end) <= warningDate
      );
    } else if (filter === 'expired') {
      result = result.filter(u => !u.pro_subscription_end || new Date(u.pro_subscription_end) <= now);
    }

    // Sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === bVal) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, search, filter, planFilter, sortConfig]);

  const requestSort = (key: keyof ProUser) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // --- Handlers ---
  const handleRenew = async () => {
    if (!renewTarget) return;
    setIsRenewing(true);
    try {
      // Call API to process renewal
      const res = await fetch('/api/admin/pro/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: renewTarget.id,
          days: renewDays,
          cost: renewCost,
          paymentMethod: 'pocket_cash' // Or admin_manual
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en renovación');

      toast.success('Suscripción renovada exitosamente');
      setShowRenewModal(false);
      fetchUsers(); // Refresh data
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsRenewing(false);
    }
  };

  const handleNotify = async () => {
    if (selectedUsers.length === 0 && !renewTarget) return;
    setIsNotifying(true);
    const targets = renewTarget ? [renewTarget.id] : selectedUsers;

    try {
      const res = await fetch('/api/admin/pro/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: targets,
          message: notifyMessage
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error enviando notificaciones');

      toast.success(`Se enviaron ${targets.length} notificaciones`);
      setShowNotifyModal(false);
      setSelectedUsers([]);
      setRenewTarget(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsNotifying(false);
    }
  };

  const exportCSV = () => {
    const headers = ['ID', 'Nombre', 'Email', 'Inicio', 'Fin', 'Estado'];
    const rows = filteredUsers.map(u => {
      const isExpired = !u.pro_subscription_end || new Date(u.pro_subscription_end) <= new Date();
      return [
        u.id,
        u.full_name || '',
        u.email || '',
        u.pro_subscription_start ? format(new Date(u.pro_subscription_start), 'yyyy-MM-dd') : '',
        u.pro_subscription_end ? format(new Date(u.pro_subscription_end), 'yyyy-MM-dd') : '',
        isExpired ? 'Vencido' : 'Activo'
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `usuarios_pro_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Suscripciones PRO & Platinum</h1>
          <p className="text-gray-500">Administra suscripciones, renovaciones y alertas de todos los planes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 text-sm font-medium">
            <RefreshCw className="w-4 h-4" /> Actualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          {[
            { id: 'all', label: 'Todos', icon: Filter },
            { id: 'active', label: 'Activos', icon: CheckCircle },
            { id: 'expiring', label: 'Por vencer (<7d)', icon: AlertTriangle },
            { id: 'expired', label: 'Vencidos', icon: Clock },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${filter === f.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
            >
              <f.icon className="w-4 h-4" />
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 border-l border-gray-200 pl-4 ml-2">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'pro', label: 'PRO', color: 'text-blue-600' },
            { id: 'platinum', label: 'Platinum', color: 'text-amber-600' },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPlanFilter(p.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg whitespace-nowrap text-sm font-medium transition-colors ${planFilter === p.id
                  ? p.id === 'platinum' ? 'bg-amber-500 text-white' : p.id === 'pro' ? 'bg-blue-500 text-white' : 'bg-gray-900 text-white'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
            >
              {p.id === 'platinum' && <Crown className="w-3.5 h-3.5" />}
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 w-10">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) setSelectedUsers(filteredUsers.map(u => u.id));
                      else setSelectedUsers([]);
                    }}
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                  />
                </th>
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('full_name')}>Usuario</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('pro_subscription_start')}>Inicio</th>
                <th className="px-6 py-3 cursor-pointer hover:bg-gray-100" onClick={() => requestSort('pro_subscription_end')}>Vencimiento</th>
                <th className="px-6 py-3">Tiempo Restante</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Cargando usuarios...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No se encontraron usuarios</td></tr>
              ) : (
                filteredUsers.map(user => {
                  const isExpired = !user.pro_subscription_end || new Date(user.pro_subscription_end) <= new Date();
                  return (
                    <tr key={user.id} className="hover:bg-gray-50 group transition-colors">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUsers([...selectedUsers, user.id]);
                            else setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                          }}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{user.full_name || 'Sin nombre'}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        {(user.plan_type || '').toLowerCase() === 'platinum' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <Crown className="w-3 h-3" /> PLATINUM
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            ✓ PRO
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {user.pro_subscription_start ? format(new Date(user.pro_subscription_start), 'dd MMM yyyy', { locale: es }) : '—'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {user.pro_subscription_end ? format(new Date(user.pro_subscription_end), 'dd MMM yyyy', { locale: es }) : '—'}
                      </td>
                      <td className="px-6 py-4">
                        {user.pro_subscription_end ? (
                          <Countdown targetDate={user.pro_subscription_end} />
                        ) : (
                          <span className="text-gray-400">Inactivo</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setRenewTarget(user); setShowNotifyModal(true); }}
                            className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Enviar recordatorio"
                          >
                            <Bell className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setRenewTarget(user); setShowRenewModal(true); }}
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                            title="Renovar suscripción"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bulk Actions Footer */}
        {selectedUsers.length > 0 && (
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-600">{selectedUsers.length} usuarios seleccionados</span>
            <div className="flex gap-2">
              <button
                onClick={() => { setRenewTarget(null); setShowNotifyModal(true); }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 text-gray-700"
              >
                Enviar Recordatorio Masivo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Renew Modal */}
      {showRenewModal && renewTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Renovar Suscripción {(renewTarget?.plan_type || '').toLowerCase() === 'platinum' ? 'Platinum' : 'PRO'}</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Usuario</p>
                <p className="font-medium">{renewTarget.full_name}</p>
                <p className="text-xs text-gray-400">{renewTarget.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Días a agregar</label>
                <select
                  value={renewDays}
                  onChange={(e) => setRenewDays(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                >
                  <option value={30}>30 días (1 mes)</option>
                  <option value={90}>90 días (3 meses)</option>
                  <option value={365}>365 días (1 año)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo (MXN)</label>
                <input
                  type="number"
                  value={renewCost}
                  onChange={(e) => setRenewCost(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Esta acción descontará saldo de Pocket Cash del usuario. Si no tiene saldo suficiente, la operación fallará.</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRenewModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleRenew}
                disabled={isRenewing}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isRenewing ? 'Procesando...' : 'Confirmar Renovación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notify Modal */}
      {showNotifyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Enviar Recordatorio</h3>
            <p className="text-sm text-gray-500 mb-4">
              Enviando a {renewTarget ? '1 usuario' : `${selectedUsers.length} usuarios`}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensaje</label>
                <textarea
                  value={notifyMessage}
                  onChange={(e) => setNotifyMessage(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg h-32 resize-none"
                  placeholder="Escribe el mensaje..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNotifyModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleNotify}
                disabled={isNotifying}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {isNotifying ? 'Enviando...' : 'Enviar Notificación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
