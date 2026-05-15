'use client';

import Link from 'next/link';
import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { FavoriteButton } from '@/components/FavoriteButton';
import { AuthModal } from '@/components/AuthModal';
import { NEW_CATEGORIES_CONFIG, type Category } from '@/lib/categories';
import { FilterSidebar } from '@/components/FilterSidebar';

type ListingPreview = {
  id: string;
  title: string;
  description: string | null;
  price: number | string;
  images: string[] | null;
  condition?: 'nuevo' | 'usado' | 'casi_nuevo' | null;
  free_shipping?: boolean | null;
  gender?: string | null;
  category?: string | null;
  subcategory?: string | null;
  tags?: string[] | null;
  size?: string | null;
};

const ITEMS_PER_PAGE = 24;

function formatMoney(value: number) {
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function getPrice(value: number | string) {
  const n = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// Función para mezclar array aleatoriamente (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}




function ExplorarContent() {
  const searchParams = useSearchParams();
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allListings, setAllListings] = useState<ListingPreview[]>([]);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Filter State
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all active listings with new fields
        let query = supabase
          .from('listings')
          .select('id,title,description,price,images,condition,free_shipping,gender,category,subcategory,tags,size')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        const { data, error: listErr } = await query;

        if (listErr) {
           console.error('Error fetching listings with new columns, attempting fallback...', listErr);
           // Fallback: fetch only basic columns if the schema is not yet updated
           const { data: fallbackData, error: fallbackErr } = await supabase
             .from('listings')
             .select('id,title,description,price,images') // Basic columns only
             .eq('status', 'active')
             .order('created_at', { ascending: false });

           if (fallbackErr) throw fallbackErr;

           if (!cancelled) {
             const shuffled = shuffleArray((fallbackData as ListingPreview[]) ?? []);
             setAllListings(shuffled);
           }
        } else if (!cancelled) {
          // Shuffle initially
          const shuffled = shuffleArray((data as ListingPreview[]) ?? []);
          setAllListings(shuffled);
        }
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se pudieron cargar las publicaciones.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter Logic
  const filteredListings = useMemo(() => {
    const q = searchParams.get('q')?.toLowerCase().trim();
    
    return allListings.filter((p) => {
      // Text Search (Title, Description, Tags)
      if (q) {
        const title = (p.title || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        const tags = (p.tags || []).map(t => t.toLowerCase());
        
        const matchTitle = title.includes(q);
        const matchDesc = desc.includes(q);
        const matchTags = tags.some(t => t.includes(q));
        
        if (!matchTitle && !matchDesc && !matchTags) return false;
      }

      // Gender
      if (selectedGenders.length > 0 && (!p.gender || !selectedGenders.includes(p.gender))) return false;
      // Category
      if (selectedCategories.length > 0 && (!p.category || !selectedCategories.includes(p.category))) return false;
      // Subcategory
      if (selectedSubcategories.length > 0 && (!p.subcategory || !selectedSubcategories.includes(p.subcategory))) return false;

      // Smart Filter: Reglas de negocio para Niños
      if (selectedGenders.includes('Niños') || selectedGenders.includes('Niñas')) {
        // 1. Muestre únicamente productos etiquetados como infantiles
        // Excluir explícitamente si por error de datos aparece algo de adulto
        if (p.gender === 'Mujer' || p.gender === 'Hombre' || p.gender === 'Dama' || p.gender === 'Caballero') return false;

        // 2. Excluya subcategorías de 'Accesorios de Dama' (Check explícito)
        if (p.category === 'Accesorios' && p.subcategory?.toLowerCase().includes('mujer')) return false;

        // 3. Oculte las tallas de adulto (Ropa > 16, Calzado > 25)
        if (p.size) {
          // Normalizar talla (ej: "10-12" -> 10)
          const match = p.size.match(/[\d\.]+/);
          if (match) {
             const s = parseFloat(match[0]);
             const isFootwear = p.category?.toLowerCase().match(/zapato|calzado|tenis|bota|sandalia|chancla/);
             
             if (isFootwear) {
                if (!isNaN(s) && s > 25) return false;
             } else {
                // Asumiendo que tallas numéricas en ropa > 16 son de adulto
                if (!isNaN(s) && s > 16) return false;
             }
          }
        }
      }

      return true;
    });
  }, [allListings, selectedGenders, selectedCategories, selectedSubcategories, searchParams]);

  // Derived filter options
  const availableCategories = useMemo(() => {
    if (selectedGenders.length === 0) return [];
    return selectedGenders.flatMap(g => NEW_CATEGORIES_CONFIG[g] || []);
  }, [selectedGenders]);

  const availableSubcategories = useMemo(() => {
    if (selectedCategories.length === 0) return [];
    return availableCategories
      .filter(c => selectedCategories.includes(c.label))
      .flatMap(c => c.subcategories || []);
  }, [availableCategories, selectedCategories]);

  // Pagination
  const paginatedListings = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredListings.slice(startIndex, endIndex);
  }, [filteredListings, currentPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredListings.length / ITEMS_PER_PAGE);
  }, [filteredListings.length]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">Cargando productos...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">Explorar productos</h1>
            <p className="mt-1 text-sm text-gray-600">Descubre ofertas y prendas únicas</p>
          </div>
          <div className="flex gap-2">
            <button
               onClick={() => setShowFiltersMobile(!showFiltersMobile)}
               className="sm:hidden rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              {showFiltersMobile ? 'Ocultar Filtros' : 'Filtrar'}
            </button>
            <Link
              href="/"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Volver
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <aside className={`w-full lg:w-64 flex-shrink-0 ${showFiltersMobile ? 'block' : 'hidden lg:block'}`}>
            <div className="sticky top-24 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <FilterSidebar
                selectedGenders={selectedGenders}
                setSelectedGenders={setSelectedGenders}
                selectedCategories={selectedCategories}
                setSelectedCategories={setSelectedCategories}
                selectedSubcategories={selectedSubcategories}
                setSelectedSubcategories={setSelectedSubcategories}
                availableCategories={availableCategories}
                availableSubcategories={availableSubcategories}
                onClear={() => {
                  setSelectedGenders([]);
                  setSelectedCategories([]);
                  setSelectedSubcategories([]);
                }}
              />
            </div>
          </aside>

          {/* Grid */}
          <div className="flex-1">
            {filteredListings.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
                <div className="text-lg font-semibold text-gray-900">No hay productos disponibles</div>
                <div className="mt-2 text-sm text-gray-600">Prueba ajustando los filtros o vuelve más tarde.</div>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  Mostrando {paginatedListings.length} de {filteredListings.length} productos
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                  {paginatedListings.map((p) => {
                  const img = (p.images ?? []).filter(Boolean)[0] ?? null;
                  const price = getPrice(p.price);
                  return (
                    <Link key={p.id} href={`/listings/${p.id}`} className="block w-full">
                      <div className="group h-full overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-black/5 hover:shadow-md transition-shadow">
                        <div className="relative aspect-[4/5] bg-gray-100">
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={img}
                              alt={p.title}
                              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">Sin imagen</div>
                          )}
                          {/* Etiquetas de condición y envío gratis */}
                          <div className="absolute top-2 left-2 flex flex-wrap gap-2 z-10">
                            {p.free_shipping && (
                              <div className="rounded-lg bg-blue-500/50 px-2 py-1 text-[10px] font-extrabold text-white shadow-sm backdrop-blur-sm">
                                Envío gratis
                              </div>
                            )}
                          </div>
                          <div className="absolute bottom-2 right-2 z-10 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {p.condition === 'nuevo' && (
                              <div className="rounded-lg bg-green-500/50 px-2 py-1 text-[10px] font-extrabold text-white shadow-sm backdrop-blur-sm">
                                Nuevo
                              </div>
                            )}
                            {p.condition === 'casi_nuevo' && (
                              <div className="rounded-lg bg-pink-500/50 px-2 py-1 text-[10px] font-extrabold text-white shadow-sm backdrop-blur-sm">
                                Casi Nuevo
                              </div>
                            )}
                            {p.condition === 'usado' && (
                              <div className="rounded-lg bg-yellow-500/50 px-2 py-1 text-[10px] font-extrabold text-white shadow-sm backdrop-blur-sm">
                                Usado
                              </div>
                            )}
                            <FavoriteButton
                              listingId={p.id}
                              onLoginRequired={() => setIsAuthOpen(true)}
                              className="hover:bg-white"
                            />
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="line-clamp-1 text-sm font-semibold text-gray-900">{p.title}</div>
                          <div className="mt-1 text-sm font-extrabold text-brand-orange">{formatMoney(price)}</div>
                          {/* Tags Preview (Optional) */}
                          {p.tags && p.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                               {p.tags.slice(0, 3).map(t => (
                                 <span key={t} className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-600">{t}</span>
                               ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                  })}
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                    {/* Botón Anterior */}
                    {currentPage > 1 && (
                      <Link
                        href={`/explorar?page=${currentPage - 1}`}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                      >
                        ‹ Anterior
                      </Link>
                    )}

                    {/* Números de página */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                      const showPage =
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 2 && pageNum <= currentPage + 2);

                      if (!showPage) {
                        if (pageNum === currentPage - 3 || pageNum === currentPage + 3) {
                          return (
                            <span key={pageNum} className="px-2 text-sm text-gray-500">
                              ...
                            </span>
                          );
                        }
                        return null;
                      }

                      return (
                        <Link
                          key={pageNum}
                          href={`/explorar?page=${pageNum}`}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm ring-1 transition-colors ${
                            pageNum === currentPage
                              ? 'bg-brand-orange text-white ring-brand-orange'
                              : 'bg-white text-gray-900 ring-black/5 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </Link>
                      );
                    })}

                    {/* Botón Siguiente */}
                    {currentPage < totalPages && (
                      <Link
                        href={`/explorar?page=${currentPage + 1}`}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
                      >
                        Siguiente ›
                      </Link>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExplorarPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <ExplorarContent />
    </Suspense>
  );
}