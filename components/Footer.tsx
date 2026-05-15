import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-black/5 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-gray-600">
            <p className="font-semibold text-gray-900">© {currentYear} GoVendy Es una Marca Registrada todos los derechos reservados.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <Link
              href="/terminos-y-condiciones"
              className="text-gray-600 hover:text-brand-emerald hover:underline"
            >
              Términos y Condiciones
            </Link>
            <Link
              href="/politica-privacidad"
              className="text-gray-600 hover:text-brand-emerald hover:underline"
            >
              Política de Privacidad
            </Link>
            <Link
              href="/reglas-plataforma"
              className="text-gray-600 hover:text-brand-emerald hover:underline"
            >
              Reglas de la Plataforma
            </Link>
            <Link
              href="/dashboard/ayuda"
              className="text-gray-600 hover:text-brand-emerald hover:underline"
            >
              Ayuda
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
