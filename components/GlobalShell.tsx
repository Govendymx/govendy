'use client';

import { usePathname } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { SupportBot } from '@/components/SupportBot';

/**
 * Renderiza el Footer y SupportBot solo en rutas que no sean
 * pantallas de escritorio completo como /live/[id], /admin, etc.
 */
export function GlobalShell() {
    const pathname = usePathname() ?? '';

    // Páginas que usan position:fixed a pantalla completa — ocultar footer y bot
    const isFullscreen =
        /^\/live\/[^/]+/.test(pathname) || // Página del live viewer
        pathname.startsWith('/admin');      // Admin

    if (isFullscreen) return null;

    return (
        <>
            <Footer />
            <SupportBot />
        </>
    );
}
