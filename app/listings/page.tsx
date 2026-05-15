import { Suspense } from 'react';
import ListingsClient from './ListingsClient';

export default function ListingsPage({
  searchParams,
}: {
  searchParams?: { 
    q?: string | string[]; 
    gender?: string | string[];
    category?: string | string[];
    subcategory?: string | string[];
    tag?: string | string[];
  };
}) {
  const q = typeof searchParams?.q === 'string' ? searchParams.q : Array.isArray(searchParams?.q) ? searchParams.q[0] : '';
  
  const gender = searchParams?.gender;
  const category = searchParams?.category;
  const subcategory = searchParams?.subcategory;
  const tag = typeof searchParams?.tag === 'string' ? searchParams.tag : undefined;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="h-14 rounded-2xl bg-white/70 ring-1 ring-black/5" />
            <div className="mt-6 h-72 rounded-2xl bg-white/70 ring-1 ring-black/5" />
          </div>
        </div>
      }
    >
      <ListingsClient 
        q={q.trim()} 
        initialGender={gender}
        initialCategory={category}
        initialSubcategory={subcategory}
        initialTag={tag}
      />
    </Suspense>
  );
}

