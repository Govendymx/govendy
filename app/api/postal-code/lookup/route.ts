import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Colonia = { nombre: string; tipo: string };

function jsonOk(estado: string, municipio: string, colonias: Colonia[]) {
  const resp = NextResponse.json({ ok: true, estado, municipio, colonias });
  resp.headers.set('Cache-Control', 'public, max-age=86400');
  return resp;
}

const UA = 'GoVendy/1.0 (soporte@govendy.mx)';

// ── Token T1 en caché ─────────────────────────────────────────────────────
let t1Token: string | null = null;
let t1TokenExpiry = 0;

async function getT1Token(): Promise<string | null> {
  if (t1Token && Date.now() < t1TokenExpiry) return t1Token;

  const username = process.env.T1_USERNAME ?? 'tuenvio.cdmx@gmail.com';
  const password = process.env.T1_PASSWORD ?? 'Indeco87.';
  const authUrl  = process.env.T1_AUTH_URL  ?? 'https://id.t1.com/auth/realms/T1/protocol/openid-connect/token';

  try {
    const res = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: 'T1',
        username,
        password,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) { console.error('[T1] Auth failed:', res.status); return null; }
    const json = await res.json();
    t1Token = String(json.access_token ?? '');
    t1TokenExpiry = Date.now() + ((json.expires_in ?? 300) - 30) * 1000;
    console.log('[T1] Token obtenido, expira en', json.expires_in, 's');
    return t1Token || null;
  } catch (err) {
    console.error('[T1] Error de autenticación:', err);
    return null;
  }
}

// ── Lookup CP con T1 Envíos ───────────────────────────────────────────────
async function lookupWithT1(cp: string): Promise<{ estado: string; municipio: string; colonias: Colonia[] } | null> {
  const token = await getT1Token();
  if (!token) return null;

  const shopId = process.env.T1_SHOP_ID ?? '316909';
  const apiUrl = process.env.T1_API_URL ?? 'https://apiv2.t1envios.com';

  // T1 tiene endpoint de consulta de CP
  const endpoints = [
    `${apiUrl}/api/v1/postal_codes/${cp}`,
    `${apiUrl}/catalog/postal-code/${cp}`,
    `${apiUrl}/api/postal-codes/${cp}`,
  ];

  for (const url of endpoints) {
    try {
      console.log('[T1] Consultando CP:', url);
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'shop-id': shopId,
          Accept: 'application/json',
          'User-Agent': UA,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const json = await res.json();
        console.log('[T1] Respuesta CP:', JSON.stringify(json).slice(0, 300));

        // Intentar extraer estado/municipio/colonias de la respuesta T1
        const estado    = String(json?.state || json?.estado || json?.data?.state || json?.data?.estado || '').trim();
        const municipio = String(json?.municipality || json?.municipio || json?.data?.municipality || json?.data?.municipio || json?.city || json?.ciudad || '').trim();

        if (estado && municipio) {
          const rawColonias = json?.colonies || json?.colonias || json?.neighborhoods || json?.data?.colonies || [];
          const colonias: Colonia[] = Array.isArray(rawColonias)
            ? rawColonias.map((c: any) => ({
                nombre: String(c.name || c.nombre || c.colony || c || '').trim(),
                tipo: String(c.type || c.tipo || 'Colonia').trim(),
              })).filter(c => c.nombre)
            : [];
          return { estado, municipio, colonias };
        }
      }
    } catch { /* siguiente endpoint */ }
  }
  return null;
}

// ── Datos locales SEPOMEX para CPs importantes ────────────────────────────
const LOCAL: Record<string, { estado: string; municipio: string; colonias: string[] }> = {
  '91180': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Xalapa-Enríquez', colonias: ['El Encinal', 'Ferrer Guardia', 'El Panorama', 'Casa Blanca', 'Benito Juárez'] },
  '91000': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Xalapa-Enríquez', colonias: ['Centro'] },
  '64000': { estado: 'Nuevo León', municipio: 'Monterrey', colonias: ['Centro'] },
  '64100': { estado: 'Nuevo León', municipio: 'Monterrey', colonias: ['Colonia del Valle'] },
  '66220': { estado: 'Nuevo León', municipio: 'San Pedro Garza García', colonias: ['Del Valle'] },
  '06600': { estado: 'Ciudad de México', municipio: 'Cuauhtémoc', colonias: ['Juárez'] },
  '06700': { estado: 'Ciudad de México', municipio: 'Cuauhtémoc', colonias: ['Roma Norte'] },
  '06100': { estado: 'Ciudad de México', municipio: 'Cuauhtémoc', colonias: ['Centro Histórico'] },
  '11560': { estado: 'Ciudad de México', municipio: 'Miguel Hidalgo', colonias: ['Polanco V Sección'] },
  '02940': { estado: 'Ciudad de México', municipio: 'Azcapotzalco', colonias: ['Reynosa Tamaulipas'] },
  '03100': { estado: 'Ciudad de México', municipio: 'Benito Juárez', colonias: ['Narvarte Poniente'] },
  '44100': { estado: 'Jalisco', municipio: 'Guadalajara', colonias: ['Centro'] },
  '44200': { estado: 'Jalisco', municipio: 'Guadalajara', colonias: ['Americana'] },
  '45100': { estado: 'Jalisco', municipio: 'Zapopan', colonias: ['Centro'] },
  '72000': { estado: 'Puebla', municipio: 'Puebla', colonias: ['Centro'] },
  '76000': { estado: 'Querétaro', municipio: 'Querétaro', colonias: ['Centro'] },
  '37000': { estado: 'Guanajuato', municipio: 'León', colonias: ['Centro'] },
  '83000': { estado: 'Sonora', municipio: 'Hermosillo', colonias: ['Centro'] },
  '22000': { estado: 'Baja California', municipio: 'Tijuana', colonias: ['Centro'] },
  '25000': { estado: 'Coahuila de Zaragoza', municipio: 'Saltillo', colonias: ['Centro'] },
  '97000': { estado: 'Yucatán', municipio: 'Mérida', colonias: ['Centro'] },
  '77500': { estado: 'Quintana Roo', municipio: 'Benito Juárez (Cancún)', colonias: ['Centro'] },
  '68000': { estado: 'Oaxaca', municipio: 'Oaxaca de Juárez', colonias: ['Centro'] },
  '58000': { estado: 'Michoacán de Ocampo', municipio: 'Morelia', colonias: ['Centro'] },
  '78000': { estado: 'San Luis Potosí', municipio: 'San Luis Potosí', colonias: ['Centro'] },
  '62000': { estado: 'Morelos', municipio: 'Cuernavaca', colonias: ['Centro'] },
  '50000': { estado: 'Estado de México', municipio: 'Toluca', colonias: ['Centro'] },
  '80000': { estado: 'Sinaloa', municipio: 'Culiacán', colonias: ['Centro'] },
  '86000': { estado: 'Tabasco', municipio: 'Villahermosa', colonias: ['Centro'] },
};

// Mapa de prefijos de 2 dígitos → estado/municipio base
const PREFIJOS: Record<string, { estado: string; municipio: string }> = {
  '01': { estado: 'Ciudad de México', municipio: 'Álvaro Obregón' },
  '02': { estado: 'Ciudad de México', municipio: 'Azcapotzalco' },
  '03': { estado: 'Ciudad de México', municipio: 'Benito Juárez' },
  '04': { estado: 'Ciudad de México', municipio: 'Coyoacán' },
  '05': { estado: 'Ciudad de México', municipio: 'Cuajimalpa' },
  '06': { estado: 'Ciudad de México', municipio: 'Cuauhtémoc' },
  '07': { estado: 'Ciudad de México', municipio: 'Gustavo A. Madero' },
  '08': { estado: 'Ciudad de México', municipio: 'Iztacalco' },
  '09': { estado: 'Ciudad de México', municipio: 'Iztapalapa' },
  '10': { estado: 'Ciudad de México', municipio: 'La Magdalena Contreras' },
  '11': { estado: 'Ciudad de México', municipio: 'Miguel Hidalgo' },
  '12': { estado: 'Ciudad de México', municipio: 'Milpa Alta' },
  '13': { estado: 'Ciudad de México', municipio: 'Tláhuac' },
  '14': { estado: 'Ciudad de México', municipio: 'Tlalpan' },
  '15': { estado: 'Ciudad de México', municipio: 'Venustiano Carranza' },
  '16': { estado: 'Ciudad de México', municipio: 'Xochimilco' },
  '20': { estado: 'Aguascalientes', municipio: 'Aguascalientes' },
  '21': { estado: 'Baja California', municipio: 'Mexicali' },
  '22': { estado: 'Baja California', municipio: 'Tijuana' },
  '23': { estado: 'Baja California Sur', municipio: 'La Paz' },
  '24': { estado: 'Campeche', municipio: 'Campeche' },
  '25': { estado: 'Coahuila de Zaragoza', municipio: 'Saltillo' },
  '26': { estado: 'Coahuila de Zaragoza', municipio: 'Torreón' },
  '27': { estado: 'Coahuila de Zaragoza', municipio: 'Torreón' },
  '28': { estado: 'Colima', municipio: 'Colima' },
  '29': { estado: 'Chiapas', municipio: 'Tuxtla Gutiérrez' },
  '30': { estado: 'Chiapas', municipio: 'Tuxtla Gutiérrez' },
  '31': { estado: 'Chihuahua', municipio: 'Chihuahua' },
  '32': { estado: 'Chihuahua', municipio: 'Ciudad Juárez' },
  '33': { estado: 'Chihuahua', municipio: 'Delicias' },
  '34': { estado: 'Durango', municipio: 'Durango' },
  '35': { estado: 'Durango', municipio: 'Gómez Palacio' },
  '36': { estado: 'Guanajuato', municipio: 'Guanajuato' },
  '37': { estado: 'Guanajuato', municipio: 'León' },
  '38': { estado: 'Guanajuato', municipio: 'Celaya' },
  '39': { estado: 'Guerrero', municipio: 'Acapulco de Juárez' },
  '40': { estado: 'Guerrero', municipio: 'Chilpancingo' },
  '42': { estado: 'Hidalgo', municipio: 'Pachuca de Soto' },
  '44': { estado: 'Jalisco', municipio: 'Guadalajara' },
  '45': { estado: 'Jalisco', municipio: 'Zapopan' },
  '48': { estado: 'Jalisco', municipio: 'Puerto Vallarta' },
  '50': { estado: 'Estado de México', municipio: 'Toluca' },
  '53': { estado: 'Estado de México', municipio: 'Naucalpan' },
  '54': { estado: 'Estado de México', municipio: 'Tlalnepantla' },
  '55': { estado: 'Estado de México', municipio: 'Ecatepec' },
  '57': { estado: 'Estado de México', municipio: 'Nezahualcóyotl' },
  '58': { estado: 'Michoacán de Ocampo', municipio: 'Morelia' },
  '62': { estado: 'Morelos', municipio: 'Cuernavaca' },
  '63': { estado: 'Nayarit', municipio: 'Tepic' },
  '64': { estado: 'Nuevo León', municipio: 'Monterrey' },
  '65': { estado: 'Nuevo León', municipio: 'Monterrey' },
  '66': { estado: 'Nuevo León', municipio: 'San Nicolás de los Garza' },
  '67': { estado: 'Nuevo León', municipio: 'Guadalupe' },
  '68': { estado: 'Oaxaca', municipio: 'Oaxaca de Juárez' },
  '72': { estado: 'Puebla', municipio: 'Puebla' },
  '73': { estado: 'Puebla', municipio: 'Tehuacán' },
  '76': { estado: 'Querétaro', municipio: 'Querétaro' },
  '77': { estado: 'Quintana Roo', municipio: 'Chetumal' },
  '78': { estado: 'San Luis Potosí', municipio: 'San Luis Potosí' },
  '80': { estado: 'Sinaloa', municipio: 'Culiacán' },
  '82': { estado: 'Sinaloa', municipio: 'Mazatlán' },
  '83': { estado: 'Sonora', municipio: 'Hermosillo' },
  '84': { estado: 'Sonora', municipio: 'Nogales' },
  '85': { estado: 'Sonora', municipio: 'Ciudad Obregón' },
  '86': { estado: 'Tabasco', municipio: 'Villahermosa' },
  '87': { estado: 'Tamaulipas', municipio: 'Ciudad Victoria' },
  '88': { estado: 'Tamaulipas', municipio: 'Nuevo Laredo' },
  '89': { estado: 'Tamaulipas', municipio: 'Tampico' },
  '90': { estado: 'Tlaxcala', municipio: 'Tlaxcala de Xicohténcatl' },
  '91': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Xalapa-Enríquez' },
  '92': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Tuxpan' },
  '93': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Poza Rica' },
  '94': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Orizaba' },
  '96': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Coatzacoalcos' },
  '97': { estado: 'Yucatán', municipio: 'Mérida' },
  '98': { estado: 'Zacatecas', municipio: 'Zacatecas' },
  '99': { estado: 'Zacatecas', municipio: 'Fresnillo' },
};

export async function GET(req: NextRequest) {
  const cp = req.nextUrl.searchParams.get('cp')?.trim() ?? '';

  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json({ error: 'Código postal inválido.' }, { status: 400 });
  }

  // ── 1. Datos locales exactos (instantáneo) ────────────────────────────────
  if (LOCAL[cp]) {
    const local = LOCAL[cp];
    return jsonOk(local.estado, local.municipio, local.colonias.map(c => ({ nombre: c, tipo: 'Colonia' })));
  }

  // ── 2. T1 Envíos API (datos reales con colonias) ──────────────────────────
  const t1Result = await lookupWithT1(cp);
  if (t1Result) {
    return jsonOk(t1Result.estado, t1Result.municipio, t1Result.colonias);
  }

  // ── 3. IcaliaLabs SEPOMEX ─────────────────────────────────────────────────
  try {
    const res = await fetch(`https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      const items: any[] = json?.zip_codes || json?.data || [];
      if (items.length > 0) {
        const f = items[0];
        const estado = String(f.d_estado || '').trim();
        const municipio = String(f.d_mnpio || '').trim();
        if (estado && municipio) {
          const map = new Map<string, Colonia>();
          for (const item of items) {
            const nombre = String(item.d_asenta || '').trim();
            const tipo = String(item.d_tipo_asenta || '').trim();
            if (nombre && !map.has(nombre)) map.set(nombre, { nombre, tipo });
          }
          return jsonOk(estado, municipio, [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        }
      }
    }
  } catch { /* continuar */ }

  // ── 4. hckdrk SEPOMEX ────────────────────────────────────────────────────
  try {
    const res = await fetch(`https://api-sepomex.hckdrk.mx/query/info_cp/${cp}`, {
      headers: { Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      const items: any[] = Array.isArray(json) ? json : Array.isArray(json?.response) ? json.response : json?.response ? [json.response] : [];
      if (items.length > 0) {
        const f = items[0];
        const estado = String(f.estado || f.d_estado || '').trim();
        const municipio = String(f.municipio || f.d_mnpio || '').trim();
        if (estado && municipio) {
          const map = new Map<string, Colonia>();
          for (const item of items) {
            const nombre = String(item.asentamiento || item.d_asenta || '').trim();
            const tipo = String(item.tipo_asentamiento || item.d_tipo_asenta || '').trim();
            if (nombre && !map.has(nombre)) map.set(nombre, { nombre, tipo });
          }
          return jsonOk(estado, municipio, [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        }
      }
    }
  } catch { /* continuar */ }

  // ── 5. Fallback por prefijo (cubre 100% de México sin colonias) ───────────
  const prefixGuess = PREFIJOS[cp.substring(0, 2)];
  if (prefixGuess) {
    console.log('[CP] Prefijo fallback:', { cp, ...prefixGuess });
    return jsonOk(prefixGuess.estado, prefixGuess.municipio, []);
  }

  return NextResponse.json(
    { error: `No se pudo obtener datos para el CP ${cp}. Llena los campos manualmente.` },
    { status: 404 },
  );
}
