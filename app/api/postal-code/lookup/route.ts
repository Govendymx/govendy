import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Busca información de código postal usando múltiples APIs de SEPOMEX.
 * Prioriza la API de IcaliaLabs (más confiable).
 */
export async function GET(req: NextRequest) {
  try {
    const cp = req.nextUrl.searchParams.get('cp');
    if (!cp || !/^\d{5}$/.test(cp)) {
      return NextResponse.json({ error: 'Código postal inválido. Debe tener 5 dígitos.' }, { status: 400 });
    }

    // --- API 1: IcaliaLabs SEPOMEX (most reliable) ---
    try {
      const url = `https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`;
      console.log('[POSTAL CODE LOOKUP] Trying IcaliaLabs:', url);
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const json = await res.json();
        const items = json?.zip_codes || json?.data || [];
        if (Array.isArray(items) && items.length > 0) {
          const first = items[0];
          const estado = String(first.d_estado || first.estado || '').trim();
          const municipio = String(first.d_mnpio || first.municipio || '').trim();

          // Colonias = every unique d_asenta
          const coloniasMap = new Map<string, { nombre: string; tipo: string }>();
          for (const item of items) {
            const nombre = String(item.d_asenta || item.asentamiento || item.colonia || '').trim();
            const tipo = String(item.d_tipo_asenta || item.tipo || '').trim();
            if (nombre && !coloniasMap.has(nombre)) {
              coloniasMap.set(nombre, { nombre, tipo });
            }
          }

          const colonias = Array.from(coloniasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
          console.log('[POSTAL CODE LOOKUP] IcaliaLabs OK:', { cp, estado, municipio, colonias: colonias.length });

          const resp = NextResponse.json({ ok: true, estado, municipio, colonias });
          resp.headers.set('Cache-Control', 'public, max-age=86400');
          return resp;
        }
      }
    } catch (err) {
      console.error('[POSTAL CODE LOOKUP] IcaliaLabs error:', err);
    }

    // --- API 2: SEPOMEX Nitrostudio ---
    try {
      const url = `https://sepomex.nitrostudio.com.mx/api/v1/codigo_postal/${cp}.json`;
      console.log('[POSTAL CODE LOOKUP] Trying Nitrostudio:', url);
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        let items: any[] = [];
        if (Array.isArray(data)) items = data;
        else if (data?.data && Array.isArray(data.data)) items = data.data;
        else if (data?.codigo_postal) items = [data];

        if (items.length > 0) {
          const first = items[0];
          const estado = String(first.d_estado || first.estado || '').trim();
          const municipio = String(first.d_mnpio || first.municipio || '').trim();

          const coloniasMap = new Map<string, { nombre: string; tipo: string }>();
          for (const item of items) {
            const nombre = String(item.d_asenta || item.asentamiento || item.colonia || '').trim();
            const tipo = String(item.d_tipo_asenta || item.tipo || '').trim();
            if (nombre && !coloniasMap.has(nombre)) {
              coloniasMap.set(nombre, { nombre, tipo });
            }
          }

          const colonias = Array.from(coloniasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
          console.log('[POSTAL CODE LOOKUP] Nitrostudio OK:', { cp, estado, municipio, colonias: colonias.length });

          const resp = NextResponse.json({ ok: true, estado, municipio, colonias });
          resp.headers.set('Cache-Control', 'public, max-age=86400');
          return resp;
        }
      }
    } catch (err) {
      console.error('[POSTAL CODE LOOKUP] Nitrostudio error:', err);
    }

    // --- API 3: COPOMEX ---
    try {
      const url = `https://api.copomex.com/query/info_cp/${cp}?token=pruebas`;
      console.log('[POSTAL CODE LOOKUP] Trying COPOMEX:', url);
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const json = await res.json();
        let items: any[] = [];
        if (Array.isArray(json)) items = json;
        else if (json?.response && Array.isArray(json.response)) items = json.response;
        else if (json?.response) items = [json.response];

        if (items.length > 0) {
          const first = items[0];
          const estado = String(first.estado || first.d_estado || '').trim();
          const municipio = String(first.municipio || first.d_mnpio || '').trim();

          const coloniasMap = new Map<string, { nombre: string; tipo: string }>();
          for (const item of items) {
            const nombre = String(item.asentamiento || item.d_asenta || item.colonia || '').trim();
            const tipo = String(item.tipo_asentamiento || item.d_tipo_asenta || '').trim();
            if (nombre && !coloniasMap.has(nombre)) {
              coloniasMap.set(nombre, { nombre, tipo });
            }
          }

          const colonias = Array.from(coloniasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
          console.log('[POSTAL CODE LOOKUP] COPOMEX OK:', { cp, estado, municipio, colonias: colonias.length });

          const resp = NextResponse.json({ ok: true, estado, municipio, colonias });
          resp.headers.set('Cache-Control', 'public, max-age=86400');
          return resp;
        }
      }
    } catch (err) {
      console.error('[POSTAL CODE LOOKUP] COPOMEX error:', err);
    }

    console.error('[POSTAL CODE LOOKUP] All APIs failed for CP:', cp);
    return NextResponse.json({ error: 'No se pudo obtener información del código postal. Intenta de nuevo o llena los campos manualmente.' }, { status: 500 });
  } catch (e: unknown) {
    console.error('[POSTAL CODE LOOKUP] Unexpected error:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error inesperado' }, { status: 500 });
  }
}
