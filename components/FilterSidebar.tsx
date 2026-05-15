'use client';

import { Category, ROOT_CATEGORIES } from '@/lib/categories';

interface FilterSidebarProps {
  selectedGenders: string[];
  setSelectedGenders: (v: string[]) => void;
  selectedCategories: string[];
  setSelectedCategories: (v: string[]) => void;
  selectedSubcategories: string[];
  setSelectedSubcategories: (v: string[]) => void;
  availableCategories: Category[];
  availableSubcategories: any[];
  onClear: () => void;
}

export function FilterSidebar({
  selectedGenders,
  setSelectedGenders,
  selectedCategories,
  setSelectedCategories,
  selectedSubcategories,
  setSelectedSubcategories,
  availableCategories,
  availableSubcategories,
  onClear,
}: FilterSidebarProps) {
  
  const toggleSelection = (list: string[], item: string, setter: (l: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item));
    } else {
      setter([...list, item]);
    }
  };

  return (
    <div className="w-full space-y-8">
      {/* Gender Filter */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-900 uppercase tracking-wider">Sección</h3>
        <div className="space-y-2">
          {ROOT_CATEGORIES.map((g) => (
            <label key={g} className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer hover:text-brand-orange transition-colors">
              <input
                type="checkbox"
                checked={selectedGenders.includes(g)}
                onChange={() => {
                  toggleSelection(selectedGenders, g, setSelectedGenders);
                  // Reset lower levels if deselecting? 
                  // For now, let's keep it simple: just toggle. 
                  // Logic in parent handles availability.
                }}
                className="h-4 w-4 rounded border-gray-300 text-brand-orange focus:ring-brand-orange transition duration-150 ease-in-out"
              />
              {g}
            </label>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      {availableCategories.length > 0 && (
        <div className="pt-4 border-t border-gray-100">
          <h3 className="mb-3 text-sm font-bold text-gray-900 uppercase tracking-wider">Categoría</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            {availableCategories.map((c) => (
              <label key={c.id} className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer hover:text-brand-orange transition-colors">
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(c.label)}
                  onChange={() => toggleSelection(selectedCategories, c.label, setSelectedCategories)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-orange focus:ring-brand-orange transition duration-150 ease-in-out"
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Subcategory Filter */}
      {availableSubcategories.length > 0 && (
        <div className="pt-4 border-t border-gray-100">
          <h3 className="mb-3 text-sm font-bold text-gray-900 uppercase tracking-wider">Subcategoría</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
            {availableSubcategories.map((s) => (
              <label key={s.id} className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer hover:text-brand-orange transition-colors">
                <input
                  type="checkbox"
                  checked={selectedSubcategories.includes(s.id)}
                  onChange={() => toggleSelection(selectedSubcategories, s.id, setSelectedSubcategories)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-orange focus:ring-brand-orange transition duration-150 ease-in-out"
                />
                {s.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onClear}
        className="w-full mt-4 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm hover:shadow"
      >
        Limpiar filtros
      </button>
    </div>
  );
}
