import { NextRequest, NextResponse } from 'next/server';
import { runAutomatedJobs } from '@/lib/automation/jobs';

export const dynamic = 'force-dynamic';

/**
 * Endpoint para ejecutar jobs automáticos
 * Protegido con secret para seguridad
 * Configurar en vercel.json la propiedad crons
 */
export async function GET(req: NextRequest) {
  // Validar secret para seguridad
  const secret = req.nextUrl.searchParams.get('secret');
  const authHeader = req.headers.get('authorization');
  const envSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;

  if (envSecret) {
    const isSecretValid = secret === envSecret;
    const isAuthHeaderValid = authHeader === `Bearer ${envSecret}`;
    
    if (!isSecretValid && !isAuthHeaderValid) {
      console.error('[CRON] Intento de acceso no autorizado');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Si no hay secret configurado, permitir (para desarrollo)
  if (!envSecret) {
    console.warn('[CRON] ⚠️ CRON_SECRET no configurado. Configura en Vercel para producción.');
  }

  try {
    console.log('[CRON] Iniciando ejecución de jobs automáticos...');
    const startTime = Date.now();

    const result = await runAutomatedJobs();

    const duration = Date.now() - startTime;

    console.log('[CRON] Jobs ejecutados:', {
      ok: result.ok,
      duration: `${duration}ms`,
      results: result.results,
    });

    return NextResponse.json({
      ok: result.ok,
      message: 'Jobs executed',
      duration: `${duration}ms`,
      results: result.results,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[CRON] Error ejecutando jobs:', e);
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
