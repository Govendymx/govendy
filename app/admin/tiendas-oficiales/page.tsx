'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Search, Plus, Store, Trash2, Edit2, Check, X, Upload } from 'lucide-react';
import { toast } from 'sonner';

// --- Types ---
type OfficialStore = {
  id: string;
  full_name: string | null;
  email: string | null;
  is_official_store: boolean;
  official_store_name: string | null;
  official_store_brand_color: string | null;
  official_store_banner_url: string | null;
  official_store_slogan: string | null;
};

type SearchUser = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export default function AdminOfficialStoresPage() {
  const [stores, setStores] = useState<OfficialStore[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Search/Add State ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);

  // --- Edit/Create Form State ---
  const [formData, setFormData] = useState({
    storeName: '',
    brandColor: '#ec4899', // Brand pink default
    bannerUrl: '',
    slogan: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editStoreId, setEditStoreId] = useState<string | null>(null);

  // --- Fetch Data ---
  const fetchStores = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/official-stores', {
        headers: {
          'Authorization': 'Bearer ADMIN_SECRET_KEY' // En producción esto se manejaría con cookies/session, por ahora validamos solo log
        }
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Error fetching stores');

      setStores(data);
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Error al cargar tiendas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores();
  }, []);

  // --- Search Users ---
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(5);

      if (error) throw error;
      setSearchResults(data as SearchUser[]);
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  // --- Actions ---
  const openAddModal = () => {
    setIsEditing(false);
    setEditStoreId(null);
    setSelectedUser(null);
    setFormData({ storeName: '', brandColor: '#ec4899', bannerUrl: '', slogan: '' });
    setShowAddModal(true);
  };

  const openEditModal = (store: OfficialStore) => {
    setIsEditing(true);
    setEditStoreId(store.id);
    setSelectedUser({ id: store.id, full_name: store.full_name, email: store.email });
    setFormData({
      storeName: store.official_store_name || '',
      brandColor: store.official_store_brand_color || '#ec4899',
      bannerUrl: store.official_store_banner_url || '',
      slogan: store.official_store_slogan || '',
    });
    setShowAddModal(true);
  };

  const handleSaveStore = async () => {
    if (!selectedUser || !formData.storeName) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_official_store: true,
          official_store_name: formData.storeName,
          official_store_brand_color: formData.brandColor,
          official_store_banner_url: formData.bannerUrl || null,
          official_store_slogan: formData.slogan || null,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast.success(isEditing ? 'Tienda actualizada' : 'Tienda oficial agregada');
      setShowAddModal(false);
      fetchStores();
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message);
    }
  };

  const handleRemoveStore = async (id: string) => {
    if (!confirm('¿Estás seguro de quitar el estatus de Tienda Oficial?')) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_official_store: false,
          official_store_name: null,
          official_store_brand_color: null,
          official_store_banner_url: null,
        })
        .eq('id', id);

      if (error) throw error;
      toast.success('Tienda oficial removida');
      fetchStores();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tiendas Oficiales</h1>
          <p className="text-sm text-gray-500">Gestiona las cuentas verificadas y marcas oficiales</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-pink-600 hover:shadow-md"
        >
          <Plus className="h-4 w-4" />
          Nueva Tienda
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-6 py-3">Tienda / Marca</th>
                <th className="px-6 py-3">Propietario</th>
                <th className="px-6 py-3">Color de Marca</th>
                <th className="px-6 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">Cargando tiendas...</td>
                </tr>
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No hay tiendas oficiales registradas.</td>
                </tr>
              ) : (
                stores.map((store) => (
                  <tr key={store.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 overflow-hidden">
                          {store.official_store_banner_url ? (
                            <img src={store.official_store_banner_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Store className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{store.official_store_name || 'Sin Nombre'}</div>
                          <div className="text-xs text-gray-400">ID: {store.id.slice(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{store.full_name || 'Sin Nombre'}</div>
                      <div className="text-xs text-gray-500">{store.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-6 w-6 rounded-full border border-gray-200 shadow-sm"
                          style={{ backgroundColor: store.official_store_brand_color || '#ec4899' }}
                        />
                        <span className="font-mono text-xs">{store.official_store_brand_color || '#ec4899'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(store)}
                          className="rounded-lg p-2 text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveStore(store.id)}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50 transition-colors"
                          title="Remover estatus oficial"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{isEditing ? 'Editar Tienda' : 'Agregar Tienda Oficial'}</h2>
              <button onClick={() => setShowAddModal(false)} className="rounded-full p-1 hover:bg-gray-100">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              {/* User Search (Only when adding) */}
              {!isEditing && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Buscar Usuario</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Nombre o email..."
                      className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-4 text-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                    />
                  </div>
                  {/* Search Results */}
                  {searchResults.length > 0 && !selectedUser && (
                    <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => {
                            setSelectedUser(user);
                            setFormData(prev => ({ ...prev, storeName: user.full_name || '' }));
                            setSearchResults([]);
                          }}
                          className="flex w-full flex-col items-start px-4 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">{user.full_name || 'Sin nombre'}</span>
                          <span className="text-xs text-gray-500">{user.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedUser && (
                <div className={`rounded-xl border p-3 ${isEditing ? 'border-gray-100 bg-gray-50' : 'border-blue-100 bg-blue-50'}`}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Store className="h-4 w-4" />
                    <span>Propietario:</span>
                  </div>
                  <div className="mt-1 pl-6 text-sm text-gray-600">
                    {selectedUser.full_name}
                  </div>
                  <div className="pl-6 text-xs text-gray-500">
                    {selectedUser.email}
                  </div>
                  {!isEditing && (
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="mt-2 text-xs font-medium text-blue-700 hover:underline pl-6"
                    >
                      Cambiar usuario
                    </button>
                  )}
                </div>
              )}

              {/* Store Config */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nombre de la Tienda</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                  placeholder="Ej. Nike Oficial"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">URL del Banner/Logo</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                  placeholder="https://..."
                  value={formData.bannerUrl}
                  onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Frase / Eslogan</label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                  placeholder="Ej. Just Do It"
                  value={formData.slogan}
                  onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Color de Marca (Hex)</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    className="h-10 w-10 cursor-pointer rounded-lg border border-gray-200 p-0.5"
                    value={formData.brandColor}
                    onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                  />
                  <input
                    type="text"
                    className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                    value={formData.brandColor}
                    onChange={(e) => setFormData({ ...formData, brandColor: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleSaveStore}
                  disabled={!selectedUser || !formData.storeName}
                  className="w-full rounded-xl bg-brand-orange py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditing ? 'Guardar Cambios' : 'Confirmar Tienda Oficial'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
