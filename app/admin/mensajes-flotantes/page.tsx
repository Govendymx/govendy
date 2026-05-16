'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

type FloatingMessage = {
  id: string;
  title: string;
  content_html?: string | null;
  image_url?: string | null;
  message_type: 'html' | 'image';
  section: string;
  position_x: number;
  position_y: number;
  starts_at: string;
  ends_at?: string | null;
  width: number;
  height?: number | null;
  background_color: string;
  text_color: string;
  border_color: string;
  z_index: number;
  is_draggable: boolean;
  is_closable: boolean;
  is_active: boolean;
  target_user_ids?: string[] | null;
  redirect_url?: string | null;
  created_at: string;
  updated_at: string;
};

type UserOption = {
  id: string;
  email: string;
  name: string;
};

const sections = [
  { value: 'all', label: 'Todas las secciones' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'listings', label: 'Explorar productos' },
  { value: 'cart', label: 'Carrito' },
  { value: 'sell', label: 'Vender' },
  { value: 'profile', label: 'Perfil' },
  { value: 'ventas', label: 'Ventas' },
  { value: 'compras', label: 'Compras' },
  { value: 'preguntas', label: 'Preguntas' },
  { value: 'respuestas', label: 'Respuestas' },
  { value: 'pagos', label: 'Pagos' },
  { value: 'favoritos', label: 'Favoritos' },
  { value: 'reputacion', label: 'Reputación' },
  { value: 'devoluciones', label: 'Devoluciones' },
  { value: 'coupons', label: 'Cupones' },
  { value: 'ayuda', label: 'Ayuda' },
  { value: 'soporte', label: 'Soporte' },
];

export default function AdminFloatingMessagesPage() {
  const [isBooting, setIsBooting] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [messages, setMessages] = useState<FloatingMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [userSearchResults, setUserSearchResults] = useState<UserOption[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return messages;
    const term = searchTerm.toLowerCase();
    return messages.filter((m) => {
      const title = (m.title || '').toLowerCase();
      const id = (m.id || '').toLowerCase();
      return title.includes(term) || id.includes(term);
    });
  }, [messages, searchTerm]);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1000);
    });
  };

  // Helper para obtener fecha y hora por separado
  const getDateAndTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return { date: '', time: '00:00' };
    const d = new Date(dateStr);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return { date, time };
  };

  // Helper para combinar fecha y hora en ISO string
  const combineDateAndTime = (date: string, time: string): string => {
    if (!date) return new Date().toISOString();
    // Construir fecha en formato local ISO (YYYY-MM-DDTHH:mm:00) para que el constructor de Date
    // lo interprete como hora local y lo convierta correctamente a UTC al usar toISOString().
    const localDateTime = `${date}T${time}:00`;
    return new Date(localDateTime).toISOString();
  };

  const now = new Date();
  const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const [form, setForm] = useState({
    title: '',
    content_html: '',
    image_url: '',
    message_type: 'html' as 'html' | 'image',
    section: 'all',
    position_x: 20,
    position_y: 20,
    starts_date: defaultDate,
    starts_time: defaultTime,
    ends_date: '',
    ends_time: '23:59',
    width: 320,
    height: '',
    background_color: '#ffffff',
    text_color: '#000000',
    border_color: '#e5e7eb',
    z_index: 10000,
    is_draggable: true,
    is_closable: true,
    is_active: true,
    redirect_url: '',
  });

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          window.location.href = '/login';
          return;
        }

        const { data: adminCheck } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', userData.user.id)
          .maybeSingle();

        setIsAdmin(!!adminCheck);
        if (!adminCheck) {
          setError('No tienes permisos de administrador');
        }
      } catch (err) {
        console.error(err);
        setError('Error al verificar permisos');
      } finally {
        setIsBooting(false);
      }
    };

    void checkAdmin();
    void loadMessages();
  }, []);

  // Buscar usuarios
  const searchUsers = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setUserSearchResults([]);
      return;
    }

    try {
      setIsSearchingUsers(true);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}&limit=20`, {
        headers: { authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (res.ok) {
        setUserSearchResults(json.users || []);
      }
    } catch (err) {
      console.error('Error al buscar usuarios:', err);
      setUserSearchResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // Agregar usuario seleccionado
  const addSelectedUser = (user: UserOption) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  // Remover usuario seleccionado
  const removeSelectedUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  const loadMessages = async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/floating-messages/list', {
        headers: { authorization: `Bearer ${token}` },
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al cargar mensajes');

      setMessages(json.messages || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error al cargar mensajes');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsCreating(true);
      setError(null);
      setSuccess(null);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('No hay sesión');

      const payload: any = {
        title: form.title,
        content_html: form.content_html,
        image_url: form.image_url,
        message_type: form.message_type,
        section: form.section,
        position_x: form.position_x,
        position_y: form.position_y,
        starts_at: combineDateAndTime(form.starts_date, form.starts_time),
        ends_at: form.ends_date ? combineDateAndTime(form.ends_date, form.ends_time) : null,
        width: form.width,
        height: form.height ? parseInt(form.height) : null,
        background_color: form.background_color,
        text_color: form.text_color,
        border_color: form.border_color,
        z_index: form.z_index,
        is_draggable: form.is_draggable,
        is_closable: form.is_closable,
        is_active: form.is_active,
      };

      const url = editingId ? '/api/admin/floating-messages/update' : '/api/admin/floating-messages/create';
      const method = editingId ? 'POST' : 'POST';
      const body = editingId ? { id: editingId, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al guardar mensaje');

      setSuccess(editingId ? 'Mensaje actualizado' : 'Mensaje creado');
      const resetNow = new Date();
      const resetDate = `${resetNow.getFullYear()}-${String(resetNow.getMonth() + 1).padStart(2, '0')}-${String(resetNow.getDate()).padStart(2, '0')}`;
      const resetTime = `${String(resetNow.getHours()).padStart(2, '0')}:${String(resetNow.getMinutes()).padStart(2, '0')}`;
      
      setForm({
        title: '',
        content_html: '',
        image_url: '',
        message_type: 'html',
        section: 'all',
        position_x: 20,
        position_y: 20,
        starts_date: resetDate,
        starts_time: resetTime,
        ends_date: '',
        ends_time: '23:59',
        width: 320,
        height: '',
        background_color: '#ffffff',
        text_color: '#000000',
        border_color: '#e5e7eb',
        z_index: 10000,
        is_draggable: true,
        is_closable: true,
        is_active: true,
        redirect_url: '',
      });
      setSelectedUsers([]);
      setEditingId(null);
      void loadMessages();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar mensaje');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = async (msg: FloatingMessage) => {
    const starts = getDateAndTime(msg.starts_at);
    const ends = getDateAndTime(msg.ends_at);
    setForm({
      title: msg.title,
      content_html: msg.content_html || '',
      image_url: msg.image_url || '',
      message_type: msg.message_type,
      section: msg.section,
      position_x: msg.position_x,
      position_y: msg.position_y,
      starts_date: starts.date,
      starts_time: starts.time,
      ends_date: ends.date,
      ends_time: ends.time,
      width: msg.width,
      height: msg.height ? String(msg.height) : '',
      background_color: msg.background_color,
      text_color: msg.text_color,
      border_color: msg.border_color,
      z_index: msg.z_index,
      is_draggable: msg.is_draggable,
      is_closable: msg.is_closable,
      is_active: msg.is_active,
      redirect_url: msg.redirect_url || '',
    });

    // Cargar usuarios seleccionados si existen
    if (msg.target_user_ids && msg.target_user_ids.length > 0) {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (token) {
          // Obtener información de usuarios
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, full_name, username')
            .in('id', msg.target_user_ids);

          if (profiles) {
            const users = profiles.map((p: any) => ({
              id: p.id,
              email: p.email || '',
              name: p.full_name || p.username || p.email || 'Sin nombre',
            }));
            setSelectedUsers(users);
          }
        }
      } catch (err) {
        console.error('Error al cargar usuarios:', err);
        setSelectedUsers([]);
      }
    } else {
      setSelectedUsers([]);
    }

    setEditingId(msg.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este mensaje?')) return;

    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      const res = await fetch('/api/admin/floating-messages/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Error al eliminar');

      setSuccess('Mensaje eliminado');
      void loadMessages();
    } catch (err: any) {
      setError(err?.message || 'Error al eliminar mensaje');
    }
  };

  const handleToggleActive = async (msg: FloatingMessage) => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_active: !m.is_active } : m))
      );

      const res = await fetch('/api/admin/floating-messages/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: msg.id, is_active: !msg.is_active }),
      });

      if (!res.ok) {
        // Revert on error
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, is_active: msg.is_active } : m))
        );
        throw new Error('Error al actualizar estado');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error al actualizar estado');
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-14 rounded-2xl bg-white/70 ring-1 ring-black/5" />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            No tienes permisos de administrador
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-40 border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="GoVendy" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-gray-900">Admin · Mensajes Flotantes</div>
              <div className="text-xs text-gray-500">Gestiona mensajes flotantes para todos los usuarios</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/settings" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Configuración
            </Link>
            <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50">
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {success && <div className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

        {/* Formulario */}
        <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-black/5 sm:p-8">
          <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Editar mensaje' : 'Crear nuevo mensaje flotante'}</h2>
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Título *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de mensaje *</label>
                <select
                  value={form.message_type}
                  onChange={(e) => setForm((p) => ({ ...p, message_type: e.target.value as 'html' | 'image' }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                >
                  <option value="html">HTML</option>
                  <option value="image">Imagen</option>
                </select>
              </div>
            </div>

            {form.message_type === 'html' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700">Contenido HTML *</label>
                <textarea
                  value={form.content_html}
                  onChange={(e) => setForm((p) => ({ ...p, content_html: e.target.value }))}
                  rows={6}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-brand-emerald"
                  placeholder="<p>Tu mensaje HTML aquí</p>"
                  required
                />
                <div className="mt-1 text-xs text-gray-500">Puedes usar HTML completo: &lt;p&gt;, &lt;strong&gt;, &lt;a&gt;, &lt;img&gt;, etc.</div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700">URL de imagen *</label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  placeholder="https://ejemplo.com/imagen.jpg"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Sección *</label>
              <select
                value={form.section}
                onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
              >
                {sections.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Selección de usuarios específicos */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Usuarios específicos (opcional)
              </label>
              <div className="mt-1 space-y-2">
                {/* Búsqueda de usuarios */}
                <div className="relative">
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => {
                      setUserSearchQuery(e.target.value);
                      void searchUsers(e.target.value);
                    }}
                    placeholder="Buscar por email o nombre..."
                    className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                  />
                  {userSearchResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
                      {userSearchResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => addSelectedUser(user)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <div className="font-medium">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Usuarios seleccionados */}
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-2 rounded-lg bg-brand-emerald/10 px-3 py-1.5 text-sm"
                      >
                        <span className="font-medium text-gray-900">{user.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(user.id);
                          }}
                          className="text-gray-400 hover:text-brand-emerald text-xs"
                          title="Copiar ID"
                        >
                          📋
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSelectedUser(user.id)}
                          className="text-brand-emerald hover:text-brand-emerald/80 ml-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  {selectedUsers.length === 0
                    ? 'Dejar vacío para mostrar a todos los usuarios'
                    : `Mostrar solo a ${selectedUsers.length} usuario(s) seleccionado(s)`}
                </div>
              </div>
            </div>

            {/* URL de redirección */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                URL de redirección (opcional)
              </label>
              <input
                type="url"
                value={form.redirect_url}
                onChange={(e) => setForm((p) => ({ ...p, redirect_url: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                placeholder="https://ejemplo.com/pagina"
              />
              <div className="mt-1 text-xs text-gray-500">
                Si se especifica, el mensaje será clickeable y redirigirá a esta URL
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha y hora de inicio *</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={form.starts_date}
                      onChange={(e) => setForm((p) => ({ ...p, starts_date: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
                    <input
                      type="time"
                      value={form.starts_time}
                      onChange={(e) => setForm((p) => ({ ...p, starts_time: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                      required
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fecha y hora de fin (opcional)</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha</label>
                    <input
                      type="date"
                      value={form.ends_date}
                      onChange={(e) => setForm((p) => ({ ...p, ends_date: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Hora</label>
                    <input
                      type="time"
                      value={form.ends_time}
                      onChange={(e) => setForm((p) => ({ ...p, ends_time: e.target.value }))}
                      className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                    />
                  </div>
                </div>
                <div className="mt-1 text-xs text-gray-500">Dejar fecha vacía = sin fecha de fin</div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Posición X (px)</label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={form.position_x}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 20;
                    setForm((p) => ({ ...p, position_x: Math.max(0, Math.min(10000, val)) }));
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Posición Y (px)</label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={form.position_y}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 20;
                    setForm((p) => ({ ...p, position_y: Math.max(0, Math.min(10000, val)) }));
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ancho (px)</label>
                <input
                  type="number"
                  min="100"
                  max="2000"
                  value={form.width}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 320;
                    setForm((p) => ({ ...p, width: Math.max(100, Math.min(2000, val)) }));
                  }}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-emerald"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Color de fondo</label>
                <input
                  type="color"
                  value={form.background_color}
                  onChange={(e) => setForm((p) => ({ ...p, background_color: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-brand-emerald"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Color de texto</label>
                <input
                  type="color"
                  value={form.text_color}
                  onChange={(e) => setForm((p) => ({ ...p, text_color: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-brand-emerald"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Color de borde</label>
                <input
                  type="color"
                  value={form.border_color}
                  onChange={(e) => setForm((p) => ({ ...p, border_color: e.target.value }))}
                  className="mt-1 h-10 w-full rounded-xl border border-gray-300 outline-none focus:ring-2 focus:ring-brand-emerald"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_draggable}
                  onChange={(e) => setForm((p) => ({ ...p, is_draggable: e.target.checked }))}
                  className="rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                />
                <span className="text-sm text-gray-700">Arrastrable</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_closable}
                  onChange={(e) => setForm((p) => ({ ...p, is_closable: e.target.checked }))}
                  className="rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                />
                <span className="text-sm text-gray-700">Cerrable</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-brand-emerald focus:ring-brand-emerald"
                />
                <span className="text-sm text-gray-700">Activo</span>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isCreating}
                className="rounded-xl bg-brand-emerald px-6 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                {isCreating ? 'Guardando…' : editingId ? 'Actualizar' : 'Crear mensaje'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    const cancelNow = new Date();
                    const cancelDate = `${cancelNow.getFullYear()}-${String(cancelNow.getMonth() + 1).padStart(2, '0')}-${String(cancelNow.getDate()).padStart(2, '0')}`;
                    const cancelTime = `${String(cancelNow.getHours()).padStart(2, '0')}:${String(cancelNow.getMinutes()).padStart(2, '0')}`;
                    setForm({
                      title: '',
                      content_html: '',
                      image_url: '',
                      message_type: 'html',
                      section: 'all',
                      position_x: 20,
                      position_y: 20,
                      starts_date: cancelDate,
                      starts_time: cancelTime,
                      ends_date: '',
                      ends_time: '23:59',
                      width: 320,
                      height: '',
                      background_color: '#ffffff',
                      text_color: '#000000',
                      border_color: '#e5e7eb',
                      z_index: 10000,
                      is_draggable: true,
                      is_closable: true,
                      is_active: true,
                      redirect_url: '',
                    });
                    setSelectedUsers([]);
                  }}
                  className="rounded-xl bg-gray-100 px-6 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Lista de mensajes (Tabla tipo Excel) */}
        <section className="rounded-3xl bg-white shadow-sm ring-1 ring-black/5 overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-gray-900">Mensajes existentes ({filteredMessages.length})</h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar mensajes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 rounded-xl border border-gray-300 px-4 py-2 pl-10 text-sm focus:border-brand-emerald focus:outline-none focus:ring-1 focus:ring-brand-emerald"
              />
              <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
            </div>
          </div>
          
          {filteredMessages.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">
              {searchTerm ? 'No se encontraron mensajes con ese criterio.' : 'No hay mensajes creados aún.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Habilitado
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Situación
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Título
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Sección
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Tipo
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Vigencia
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredMessages.map((msg) => {
                    const now = new Date();
                    const startsAt = new Date(msg.starts_at);
                    const endsAt = msg.ends_at ? new Date(msg.ends_at) : null;
                    
                    // Estado de vigencia
                    const isExpired = endsAt && endsAt < now;
                    const isFuture = startsAt > now;
                    const isVigente = !isExpired && !isFuture;

                    return (
                      <tr key={msg.id} className={`hover:bg-gray-50 ${!msg.is_active ? 'bg-gray-50/50' : ''}`}>
                        <td className="whitespace-nowrap px-6 py-4">
                          <button
                            onClick={() => handleToggleActive(msg)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-emerald focus:ring-offset-2 ${
                              msg.is_active ? 'bg-brand-emerald' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                msg.is_active ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <div className="mt-1 text-[10px] text-gray-500 font-medium text-center">
                            {msg.is_active ? 'Sí' : 'No'}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          {!msg.is_active ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                              Deshabilitado
                            </span>
                          ) : isExpired ? (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                              Vencido
                            </span>
                          ) : isFuture ? (
                            <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                              Programado
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                              Publicado
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">{msg.title}</div>
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            ID: {msg.id.slice(0, 8)}…
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                copyToClipboard(msg.id, msg.id);
                              }}
                              className="text-gray-400 hover:text-brand-emerald focus:outline-none"
                              title="Copiar ID"
                            >
                              {copiedId === msg.id ? '✅' : '📋'}
                            </button>
                          </div>
                          <div className="text-xs text-gray-500">
                            {msg.width}x{msg.height || 'auto'} px
                          </div>
                          {msg.target_user_ids && msg.target_user_ids.length > 0 && (
                             <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 mt-1">
                               {msg.target_user_ids.length} usuarios
                             </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                            {sections.find((s) => s.value === msg.section)?.label || msg.section}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            msg.message_type === 'html' ? 'bg-purple-100 text-purple-800' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {msg.message_type === 'html' ? 'HTML' : 'Imagen'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                          <div className={isFuture ? 'text-yellow-600 font-medium' : ''}>
                            Inicia: {startsAt.toLocaleDateString('es-MX')} {startsAt.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}
                          </div>
                          {endsAt ? (
                            <div className={isExpired ? 'text-red-600 font-medium' : ''}>
                              Termina: {endsAt.toLocaleDateString('es-MX')} {endsAt.toLocaleTimeString('es-MX', {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          ) : (
                            <div className="text-gray-400 italic">Indefinido</div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleEdit(msg)}
                              className="text-brand-emerald hover:text-brand-emerald/80 font-semibold"
                            >
                              Editar
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => handleDelete(msg.id)}
                              className="text-red-600 hover:text-red-800 font-semibold"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

