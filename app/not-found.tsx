import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-black/5">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-emerald text-white shadow-sm">
            <span className="text-sm font-extrabold tracking-widest">P</span>
          </div>
          <div className="text-xl font-extrabold text-gray-900">Página no encontrada</div>
          <div className="mt-2 text-sm text-gray-600">La ruta que abriste no existe o fue movida.</div>
          <div className="mt-6 flex justify-center gap-2">
            <Link
              href="/"
              className="rounded-xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90"
            >
              Ir al inicio
            </Link>
            <Link
              href="/categorias"
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-black/5 hover:bg-gray-50"
            >
              Categorias
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

