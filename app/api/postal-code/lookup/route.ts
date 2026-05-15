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

  // ── API 1: Correos de México (oficial, más precisa) ─────────────────────
  try {
    const url = `https://api.correosdemexico.gob.mx/SSLServicios/ConsultaCP/Consulta.aspx?tipo=json&cp=${cp}`;
    console.log('[CP] Trying Correos de México:', url);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = await res.json();
      const header = json?.CodigoPostal?.header;
      const asentamientos: any[] = json?.CodigoPostal?.asentamientos ?? [];

      const estado    = String(header?.estado    || '').trim();
      const municipio = String(header?.municipio || header?.ciudad || '').trim();

      if (estado || municipio) {
        const coloniasMap = new Map<string, Colonia>();
        for (const a of asentamientos) {
          const nombre = String(a.nombre || a.asentamiento || '').trim();
          const tipo   = String(a.tipoAsentamiento || a.tipo || 'Colonia').trim();
          if (nombre && !coloniasMap.has(nombre)) coloniasMap.set(nombre, { nombre, tipo });
        }
        const colonias = Array.from(coloniasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
        console.log('[CP] Correos MX OK:', { cp, estado, municipio, colonias: colonias.length });
        return jsonOk(estado, municipio, colonias);
      }
    }
    console.warn('[CP] Correos MX no data, status:', res.status);
  } catch (err) {
    console.error('[CP] Correos MX error:', err);
  }

  // ── API 2: IcaliaLabs SEPOMEX ─────────────────────────────────────────────
  try {
    const url = `https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`;
    console.log('[CP] Trying IcaliaLabs:', url);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const json = await res.json();
      const items: any[] = json?.zip_codes || json?.data || [];
      if (Array.isArray(items) && items.length > 0) {
        const first     = items[0];
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
    console.warn('[CP] IcaliaLabs no data, status:', res.status);
  } catch (err) {
    console.error('[CP] IcaliaLabs error:', err);
  }

  // ── API 3: api-sepomex.hckdrk.mx ─────────────────────────────────────────
  try {
    const url = `https://api-sepomex.hckdrk.mx/query/info_cp/${cp}`;
    console.log('[CP] Trying hckdrk:', url);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const json = await res.json();
      let items: any[] = [];
      if (Array.isArray(json)) items = json;
      else if (Array.isArray(json?.response)) items = json.response;
      else if (json?.response) items = [json.response];

      if (items.length > 0) {
        const first     = items[0];
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
    console.warn('[CP] hckdrk no data, status:', res.status);
  } catch (err) {
    console.error('[CP] hckdrk error:', err);
  }

  // ── API 4: Zippopotam (fallback, sin colonias) ────────────────────────────
  try {
    const url = `https://api.zippopotam.us/MX/${cp}`;
    console.log('[CP] Trying Zippopotam fallback:', url);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const json = await res.json();
      const places: any[] = json?.places ?? [];
      if (places.length > 0) {
        const estado    = String(places[0]?.state            || '').trim();
        const municipio = String(places[0]?.['place name']   || '').trim();
        if (estado || municipio) {
          console.log('[CP] Zippopotam OK:', { cp, estado, municipio });
          return jsonOk(estado, municipio, []);
        }
      }
    }
    console.warn('[CP] Zippopotam no data, status:', res.status);
  } catch (err) {
    console.error('[CP] Zippopotam error:', err);
  }

  console.error('[CP] All APIs failed for CP:', cp);
  return NextResponse.json(
    { error: `No se encontró información para el CP ${cp}. Verifica que sea un código postal válido de México o llena los campos manualmente.` },
    { status: 404 },
  );
}
