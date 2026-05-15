import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Colonia = { nombre: string; tipo: string };

function jsonOk(estado: string, municipio: string, colonias: Colonia[]) {
  const resp = NextResponse.json({ ok: true, estado, municipio, colonias });
  resp.headers.set('Cache-Control', 'public, max-age=86400');
  return resp;
}

export async function GET(req: NextRequest) {
  const cp = req.nextUrl.searchParams.get('cp')?.trim() ?? '';

  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json({ error: 'Código postal inválido.' }, { status: 400 });
  }

  // ── API 1: COPOMEX (token pruebas) ────────────────────────────────────────
  try {
    const url = `https://api.copomex.com/query/info_cp/${cp}?token=pruebas`;
    console.log('[CP] Trying COPOMEX:', url);
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = await res.json();
      // COPOMEX puede devolver array o { response: [...] }
      let items: any[] = [];
      if (Array.isArray(json)) items = json;
      else if (Array.isArray(json?.response)) items = json.response;
      else if (json?.response) items = [json.response];

      if (items.length > 0) {
        const first = items[0];
        const estado   = String(first.estado    || first.d_estado || '').trim();
        const municipio = String(first.municipio || first.d_mnpio  || '').trim();
        if (estado || municipio) {
          const coloniasMap = new Map<string, Colonia>();
          for (const item of items) {
            const nombre = String(item.asentamiento || item.d_asenta || '').trim();
            const tipo   = String(item.tipo_asentamiento || item.d_tipo_asenta || '').trim();
            if (nombre && !coloniasMap.has(nombre)) coloniasMap.set(nombre, { nombre, tipo });
          }
          const colonias = Array.from(coloniasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
          console.log('[CP] COPOMEX OK:', { cp, estado, municipio, colonias: colonias.length });
          return jsonOk(estado, municipio, colonias);
        }
      }
    }
    console.warn('[CP] COPOMEX returned no data, status:', res.status);
  } catch (err) {
    console.error('[CP] COPOMEX error:', err);
  }

  // ── API 2: IcaliaLabs SEPOMEX ─────────────────────────────────────────────
  try {
    const url = `https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`;
    console.log('[CP] Trying IcaliaLabs:', url);
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const json = await res.json();
      const items: any[] = json?.zip_codes || json?.data || [];
      if (Array.isArray(items) && items.length > 0) {
        const first = items[0];
        const estado    = String(first.d_estado || first.estado    || '').trim();
        const municipio = String(first.d_mnpio  || first.municipio || '').trim();
        if (estado || municipio) {
          const coloniasMap = new Map<string, Colonia>();
          for (const item of items) {
            const nombre = String(item.d_asenta || item.asentamiento || '').trim();
            const tipo   = String(item.d_tipo_asenta || item.tipo    || '').trim();
            if (nombre && !coloniasMap.has(nombre)) coloniasMap.set(nombre, { nombre, tipo });
          }
          const colonias = Array.from(coloniasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
          console.log('[CP] IcaliaLabs OK:', { cp, estado, municipio, colonias: colonias.length });
          return jsonOk(estado, municipio, colonias);
        }
      }
    }
    console.warn('[CP] IcaliaLabs returned no data, status:', res.status);
  } catch (err) {
    console.error('[CP] IcaliaLabs error:', err);
  }

  // ── API 3: api-sepomex alternativo ────────────────────────────────────────
  try {
    const url = `https://api-sepomex.hckdrk.mx/query/info_cp/${cp}`;
    console.log('[CP] Trying hckdrk:', url);
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const json = await res.json();
      let items: any[] = [];
      if (Array.isArray(json)) items = json;
      else if (Array.isArray(json?.response)) items = json.response;
      else if (json?.response) items = [json.response];

      if (items.length > 0) {
        const first = items[0];
        const estado    = String(first.estado    || first.d_estado || '').trim();
        const municipio = String(first.municipio || first.d_mnpio  || '').trim();
        if (estado || municipio) {
          const coloniasMap = new Map<string, Colonia>();
          for (const item of items) {
            const nombre = String(item.asentamiento || item.d_asenta || '').trim();
            const tipo   = String(item.tipo_asentamiento || item.d_tipo_asenta || '').trim();
            if (nombre && !coloniasMap.has(nombre)) coloniasMap.set(nombre, { nombre, tipo });
          }
          const colonias = Array.from(coloniasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
          console.log('[CP] hckdrk OK:', { cp, estado, municipio, colonias: colonias.length });
          return jsonOk(estado, municipio, colonias);
        }
      }
    }
    console.warn('[CP] hckdrk returned no data, status:', res.status);
  } catch (err) {
    console.error('[CP] hckdrk error:', err);
  }

  // ── API 4: Zippopotam (fallback estado/ciudad sin colonias) ───────────────
  try {
    const url = `https://api.zippopotam.us/MX/${cp}`;
    console.log('[CP] Trying Zippopotam fallback:', url);
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const json = await res.json();
      const places: any[] = json?.places || [];
      if (places.length > 0) {
        const estado    = String(json['country abbreviation'] === 'MX' ? places[0]['state'] : '').trim();
        const municipio = String(places[0]['place name'] || '').trim();
        if (estado || municipio) {
          console.log('[CP] Zippopotam fallback OK:', { cp, estado, municipio });
          return jsonOk(estado, municipio, []);
        }
      }
    }
    console.warn('[CP] Zippopotam returned no data, status:', res.status);
  } catch (err) {
    console.error('[CP] Zippopotam error:', err);
  }

  console.error('[CP] All APIs failed for CP:', cp);
  return NextResponse.json(
    { error: `No se encontró información para el CP ${cp}. Verifica que sea un código postal válido de México.` },
    { status: 404 },
  );
}
