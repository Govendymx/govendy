'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { NEW_CATEGORIES_CONFIG, ROOT_CATEGORIES } from '@/lib/categories';
import { VerifiedBadge } from '@/components/VerifiedBadge';

type OfficialStore = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  official_store_name: string | null;
  official_store_banner_url: string | null;
};

export default function CategoriasPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'product' | 'seller' | 'id'>('product');
  const [officialStores, setOfficialStores] = useState<OfficialStore[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  
  // Local filter for categories
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    const fetchOfficialStores = async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, official_store_name, official_store_banner_url')
          .eq('is_official_store', true)
          .limit(20);
        
        if (data) {
          setOfficialStores(data);
        }
      } catch (error) {
        console.error('Error fetching official stores:', error);
      } finally {
        setLoadingStores(false);
      }
    };

    fetchOfficialStores();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    if (searchType === 'product') {
      router.push(`/listings?search=${encodeURIComponent(searchQuery)}`);
    } else if (searchType === 'id') {
      // If it looks like a UUID, go directly, otherwise search text
      router.push(`/listings/${searchQuery.trim()}`);
    } else if (searchType === 'seller') {
      // We don't have a direct seller search page yet, so we'll redirect to a listings search 
      // but ideally this should be a profile search. 
      // For now, let's search listings with this text as it might find seller names if indexed,
      // OR we can implement a seller search results view.
      // A better approach for now: redirect to listings but with a special param if supported, 
      // or just standard search. 
      // User asked for "buscador por ... nombre del vendedor o tienda".
      // Let's assume generic search for now, or maybe /search?q=...&type=seller
      router.push(`/listings?search=${encodeURIComponent(searchQuery)}&type=seller`); 
    }
  };

  const filteredCategories = useMemo(() => {
    if (!categoryFilter) return NEW_CATEGORIES_CONFIG;

    const lowerFilter = categoryFilter.toLowerCase();
    const result: typeof NEW_CATEGORIES_CONFIG = {};

    Object.entries(NEW_CATEGORIES_CONFIG).forEach(([root, categories]) => {
      const matchingCategories = categories.filter(cat => {
        // Match category label
        if (cat.label.toLowerCase().includes(lowerFilter)) return true;
        // Match subcategories
        const hasMatchingSub = cat.subcategories.some(sub => 
          sub.label.toLowerCase().includes(lowerFilter)
        );
        return hasMatchingSub;
      });

      if (matchingCategories.length > 0) {
        result[root] = matchingCategories;
      }
    });

    return result;
  }, [categoryFilter]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header & Search */}
      <div className="bg-white shadow-sm sticky top-0 z-30">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 mb-6">
            Categorías
          </h1>

          {/* Search Box */}
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSearch} className="relative">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-grow">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      searchType === 'product' ? 'Buscar productos...' :
                      searchType === 'seller' ? 'Buscar vendedor o tienda...' :
                      'Ingresa el ID del producto...'
                    }
                    className="w-full rounded-2xl border-gray-300 pl-4 pr-12 py-3 shadow-sm focus:border-brand-orange focus:ring-brand-orange"
                  />
                  <button 
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-brand-orange"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
                
                {/* Search Type Selector */}
                <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setSearchType('product')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      searchType === 'product' ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Producto
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchType('seller')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      searchType === 'seller' ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Vendedor
                  </button>
                  <button
                    type="button"
                    onClick={() => setSearchType('id')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      searchType === 'id' ? 'bg-white text-brand-orange shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    ID
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-12">
        
        {/* Tiendas Oficiales */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="bg-brand-orange text-white p-1 rounded-md">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </span>
              Tiendas Oficiales
            </h2>
          </div>
          
          {loadingStores ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="w-48 h-32 bg-gray-200 animate-pulse rounded-xl shrink-0" />
              ))}
            </div>
          ) : officialStores.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
              {officialStores.map(store => (
                <Link 
                  key={store.id} 
                  href={`/profile/${store.id}`} // Assuming profile page exists
                  className="w-48 shrink-0 snap-start group"
                >
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
                    <div className="h-24 bg-gray-100 relative">
                      {store.official_store_banner_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={store.official_store_banner_url} 
                          alt={store.official_store_name || ''} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-r from-gray-100 to-gray-200" />
                      )}
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
                        <div className="w-12 h-12 rounded-full border-2 border-white bg-white overflow-hidden shadow-sm">
                          {store.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={store.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xs">
                              {store.official_store_name?.[0] || 'T'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="pt-8 pb-3 px-2 text-center">
                      <h3 className="font-bold text-sm text-gray-900 truncate">
                        {store.official_store_name || store.full_name || 'Tienda Oficial'}
                      </h3>
                      <div className="flex justify-center mt-1">
                        <VerifiedBadge size="sm" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 text-sm italic bg-white p-4 rounded-xl border border-dashed">
              Pronto agregaremos tiendas oficiales.
            </div>
          )}
        </section>

        {/* Filter Categories Input */}
        <div className="relative">
           <input
              type="text"
              placeholder="Filtrar categorías..."
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-1/2 border-b border-gray-200 py-2 text-sm focus:border-brand-orange focus:ring-0 bg-transparent"
           />
        </div>

        {/* All Categories Grid */}
        <div className="space-y-16">
          {Object.entries(filteredCategories).map(([rootCategory, categories]) => (
            <section key={rootCategory} id={rootCategory}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-2 flex items-center gap-3">
                {rootCategory}
                <span className="text-xs font-normal text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                  {categories.length}
                </span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {categories.map((cat) => (
                  <div key={cat.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group">
                    <Link 
                      href={`/listings?category=${encodeURIComponent(cat.label)}`}
                      className="block mb-3"
                    >
                      <h3 className="font-bold text-lg text-gray-900 group-hover:text-brand-orange transition-colors">
                        {cat.label}
                      </h3>
                    </Link>
                    
                    <ul className="space-y-2">
                      {cat.subcategories.map((sub) => (
                        <li key={sub.id}>
                          <Link 
                            href={`/listings?category=${encodeURIComponent(cat.label)}&subcategory=${encodeURIComponent(sub.label)}`}
                            className="text-sm text-gray-600 hover:text-gray-900 hover:underline flex items-center gap-1"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-300 group-hover:bg-brand-orange/50"></span>
                            {sub.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    
                    <div className="mt-4 pt-3 border-t border-gray-50 flex justify-end">
                      <Link 
                        href={`/listings?category=${encodeURIComponent(cat.label)}`}
                        className="text-xs font-semibold text-brand-orange opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Ver todo →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {Object.keys(filteredCategories).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No se encontraron categorías que coincidan con tu búsqueda.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
