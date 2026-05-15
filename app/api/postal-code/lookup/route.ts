import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Colonia = { nombre: string; tipo: string };

function jsonOk(estado: string, municipio: string, colonias: Colonia[]) {
  const resp = NextResponse.json({ ok: true, estado, municipio, colonias });
  resp.headers.set('Cache-Control', 'public, max-age=86400');
  return resp;
}

const UA = 'GoVendy/1.0 (soporte@govendy.mx)';

export async function GET(req: NextRequest) {
  const cp = req.nextUrl.searchParams.get('cp')?.trim() ?? '';

  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json({ error: 'Código postal inválido.' }, { status: 400 });
  }

  // ── API 1: IcaliaLabs SEPOMEX (datos completos con colonias) ─────────────
  try {
    const url = `https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`;
    console.log('[CP] Trying IcaliaLabs:', url);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const json = await res.json();
      const items: any[] = json?.zip_codes || json?.data || [];
      if (Array.isArray(items) && items.length > 0) {
        const first     = items[0];
        const estado    = String(first.d_estado || first.estado    || '').trim();
        const municipio = String(first.d_mnpio  || first.municipio || first.ciudad || '').trim();
        if (estado && municipio) {
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

  // ── API 2: hckdrk SEPOMEX ────────────────────────────────────────────────
  try {
    const url = `https://api-sepomex.hckdrk.mx/query/info_cp/${cp}`;
    console.log('[CP] Trying hckdrk:', url);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(6000),
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
        if (estado && municipio) {
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

  // ── API 3: Correos de México oficial ─────────────────────────────────────
  for (const base of [
    'https://api.correosdemexico.gob.mx',
    'https://www.correosdemexico.gob.mx',
  ]) {
    try {
      const url = `${base}/SSLServicios/ConsultaCP/Consulta.aspx?tipo=json&cp=${cp}`;
      console.log('[CP] Trying Correos MX:', url);
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': UA },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const json = await res.json();
        const header        = json?.CodigoPostal?.header ?? json?.header;
        const asentamientos: any[] = json?.CodigoPostal?.asentamientos ?? json?.asentamientos ?? [];
        const estado    = String(header?.estado    || '').trim();
        const municipio = String(header?.municipio || header?.ciudad || '').trim();
        if (estado && municipio) {
          const coloniasMap = new Map<string, Colonia>();
          for (const a of asentamientos) {
            const nombre = String(a.nombre || a.asentamiento || '').trim();
            const tipo   = String(a.tipoAsentamiento || a.tipo || '').trim();
            if (nombre && !coloniasMap.has(nombre)) coloniasMap.set(nombre, { nombre, tipo });
          }
          const colonias = Array.from(coloniasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
          console.log('[CP] Correos MX OK:', { cp, estado, municipio, colonias: colonias.length });
          return jsonOk(estado, municipio, colonias);
        }
      }
    } catch (err) {
      console.error('[CP] Correos MX error:', err);
    }
  }

  // ── API 4: OpenStreetMap Nominatim (global, sin API key, muy confiable) ──
  try {
    const url = `https://nominatim.openstreetmap.org/search?postalcode=${cp}&country=MX&format=json&addressdetails=1&limit=5&accept-language=es`;
    console.log('[CP] Trying Nominatim:', url);
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': UA,
        Referer: 'https://govendy.mx',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const places: any[] = await res.json();
      if (places.length > 0) {
        const addr      = places[0]?.address ?? {};
        const estado    = String(addr.state           || addr['ISO3166-2-lvl4'] || '').replace(/^MX-/, '').trim();
        const municipio = String(addr.city || addr.county || addr.town || addr.municipality || '').trim();
        if (estado && municipio) {
          // Intentar extraer colonias de todos los resultados
          const coloniasMap = new Map<string, Colonia>();
          for (const place of places) {
            const suburb = String(place.address?.suburb || place.address?.neighbourhood || '').trim();
            if (suburb && !coloniasMap.has(suburb)) coloniasMap.set(suburb, { nombre: suburb, tipo: 'Colonia' });
          }
          const colonias = Array.from(coloniasMap.values());
          console.log('[CP] Nominatim OK:', { cp, estado, municipio, colonias: colonias.length });
          return jsonOk(estado, municipio, colonias);
        }
      }
    }
    console.warn('[CP] Nominatim no data');
  } catch (err) {
    console.error('[CP] Nominatim error:', err);
  }

  // ── API 5: Geocodificación inversa con OpenStreetMap usando CP ────────────
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${cp}+Mexico&format=json&addressdetails=1&limit=3&accept-language=es&countrycodes=mx`;
    console.log('[CP] Trying Nominatim text search:', url);
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': UA, Referer: 'https://govendy.mx' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      const places: any[] = await res.json();
      for (const place of places) {
        const addr      = place?.address ?? {};
        const postcode  = String(addr.postcode || '').trim();
        if (postcode !== cp) continue; // solo si el CP coincide
        const estado    = String(addr.state || '').trim();
        const municipio = String(addr.city || addr.county || addr.town || '').trim();
        if (estado && municipio) {
          console.log('[CP] Nominatim text search OK:', { cp, estado, municipio });
          return jsonOk(estado, municipio, []);
        }
      }
    }
  } catch (err) {
    console.error('[CP] Nominatim text error:', err);
  }

  console.error('[CP] All APIs failed for CP:', cp);
  return NextResponse.json(
    { error: `No se pudo obtener datos para el CP ${cp}. Llena los campos manualmente.` },
    { status: 404 },
  );
}
