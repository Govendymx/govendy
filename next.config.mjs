import { readFileSync, existsSync } from 'fs';

/* ---------- load env from .env.production.local (Vercel CLI builds) ---------- */
const prodEnvPath = '.env.production.local';
const _loaded = {};
if (existsSync(prodEnvPath)) {
  for (const line of readFileSync(prodEnvPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.substring(0, i).trim();
    let v = t.substring(i + 1).trim();
    if (v.length >= 2 && ((v[0] === '"' && v.at(-1) === '"') || (v[0] === "'" && v.at(-1) === "'")))
      v = v.slice(1, -1);
    _loaded[k] = v;
    if (!process.env[k]) process.env[k] = v;   // also set on process.env for middleware / server
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Expose NEXT_PUBLIC_ vars explicitly so they survive Vercel CLI builds */
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || _loaded.NEXT_PUBLIC_SUPABASE_URL || '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || _loaded.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  // Evita que `next build` (producción) corrompa el cache/artefactos del dev server en Windows.
  // Dev usa `.next-dev` y producción usa `.next`.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',

  // OPTIMIZACIÓN: Compresión automática
  compress: true,

  // Evitar "failed to load stylesheet" cuando algo pide layout.css desde rutas anidadas (ej. /dashboard/reputacion).
  async rewrites() {
    return [
      { source: '/layout.css', destination: '/_next/static/css/app/layout.css' },
      { source: '/:path+/layout.css', destination: '/_next/static/css/app/layout.css' },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.cloudinary.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      { protocol: 'https', hostname: '**.r2.dev' },
      { protocol: 'https', hostname: '**.cloudflarestorage.com' },
      { protocol: 'https', hostname: '**.mercadolibre.com' },
      { protocol: 'https', hostname: '**.mlstatic.com' },
    ],
  },

  // Forzar webpack en lugar de Turbopack (compatible con Next.js 14 y 16)
  // Si usas Next.js 16+, puedes usar --webpack flag o esta configuración
  webpack: (config, { dev }) => {
    // En Windows a veces se corrompe el cache en disco (.next/cache/webpack/*.pack.gz)
    // y Next se queda sin manifests (middleware-manifest.json) => "missing required error components".
    // Forzamos cache en memoria para evitar ENOENT por pack files.
    if (dev) {
      config.cache = { type: 'memory' };
    }
    return config;
  },

  turbopack: {},

  experimental: {
    webpackBuildWorker: true,
  },
};

export default nextConfig;
