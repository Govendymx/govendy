import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Colonia = { nombre: string; tipo: string };

// Datos locales embebidos para CPs más comunes de México
// Fuente: SEPOMEX (datos públicos del gobierno mexicano)
const SEPOMEX_LOCAL: Record<string, { estado: string; municipio: string; colonias: string[] }> = {
  // Veracruz
  '91180': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Xalapa-Enríquez', colonias: ['El Encinal', 'Ferrer Guardia', 'El Panorama', 'Casa Blanca', 'Benito Juárez'] },
  '91000': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Xalapa-Enríquez', colonias: ['Centro'] },
  '91010': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Xalapa-Enríquez', colonias: ['Centro', 'Zona Centro'] },
  // Nuevo León
  '64000': { estado: 'Nuevo León', municipio: 'Monterrey', colonias: ['Centro'] },
  '64100': { estado: 'Nuevo León', municipio: 'Monterrey', colonias: ['Colonia del Valle'] },
  '64600': { estado: 'Nuevo León', municipio: 'Monterrey', colonias: ['San Jerónimo'] },
  '66220': { estado: 'Nuevo León', municipio: 'San Pedro Garza García', colonias: ['Del Valle'] },
  '66000': { estado: 'Nuevo León', municipio: 'San Nicolás de los Garza', colonias: ['Centro'] },
  // Ciudad de México
  '06600': { estado: 'Ciudad de México', municipio: 'Cuauhtémoc', colonias: ['Juárez'] },
  '06700': { estado: 'Ciudad de México', municipio: 'Cuauhtémoc', colonias: ['Roma Norte'] },
  '06100': { estado: 'Ciudad de México', municipio: 'Cuauhtémoc', colonias: ['Centro Histórico'] },
  '01000': { estado: 'Ciudad de México', municipio: 'Álvaro Obregón', colonias: ['Santa Fe'] },
  '11000': { estado: 'Ciudad de México', municipio: 'Miguel Hidalgo', colonias: ['Lomas de Chapultepec'] },
  '11560': { estado: 'Ciudad de México', municipio: 'Miguel Hidalgo', colonias: ['Polanco V Sección'] },
  '02940': { estado: 'Ciudad de México', municipio: 'Azcapotzalco', colonias: ['Reynosa Tamaulipas'] },
  '03100': { estado: 'Ciudad de México', municipio: 'Benito Juárez', colonias: ['Narvarte Poniente'] },
  '03810': { estado: 'Ciudad de México', municipio: 'Benito Juárez', colonias: ['Del Valle Centro'] },
  '04100': { estado: 'Ciudad de México', municipio: 'Coyoacán', colonias: ['Del Carmen'] },
  '14000': { estado: 'Ciudad de México', municipio: 'Tlalpan', colonias: ['Centro'] },
  '09000': { estado: 'Ciudad de México', municipio: 'Iztapalapa', colonias: ['Centro'] },
  // Jalisco
  '44100': { estado: 'Jalisco', municipio: 'Guadalajara', colonias: ['Centro'] },
  '44200': { estado: 'Jalisco', municipio: 'Guadalajara', colonias: ['Americana'] },
  '45100': { estado: 'Jalisco', municipio: 'Zapopan', colonias: ['Centro'] },
  '44600': { estado: 'Jalisco', municipio: 'Guadalajara', colonias: ['Providencia'] },
  // Puebla
  '72000': { estado: 'Puebla', municipio: 'Puebla', colonias: ['Centro'] },
  '72140': { estado: 'Puebla', municipio: 'Puebla', colonias: ['Las Ánimas'] },
  // Querétaro
  '76000': { estado: 'Querétaro', municipio: 'Querétaro', colonias: ['Centro'] },
  '76030': { estado: 'Querétaro', municipio: 'Querétaro', colonias: ['Carretas'] },
  // Guanajuato
  '37000': { estado: 'Guanajuato', municipio: 'León', colonias: ['Centro'] },
  '36000': { estado: 'Guanajuato', municipio: 'Guanajuato', colonias: ['Centro'] },
  // Chihuahua
  '31000': { estado: 'Chihuahua', municipio: 'Chihuahua', colonias: ['Centro'] },
  '32000': { estado: 'Chihuahua', municipio: 'Ciudad Juárez', colonias: ['Centro'] },
  // Sonora
  '83000': { estado: 'Sonora', municipio: 'Hermosillo', colonias: ['Centro'] },
  // Baja California
  '22000': { estado: 'Baja California', municipio: 'Tijuana', colonias: ['Centro'] },
  '21000': { estado: 'Baja California', municipio: 'Mexicali', colonias: ['Centro'] },
  // Coahuila
  '25000': { estado: 'Coahuila de Zaragoza', municipio: 'Saltillo', colonias: ['Centro'] },
  // Tamaulipas
  '87000': { estado: 'Tamaulipas', municipio: 'Ciudad Victoria', colonias: ['Centro'] },
  '89000': { estado: 'Tamaulipas', municipio: 'Tampico', colonias: ['Centro'] },
  // Sinaloa
  '80000': { estado: 'Sinaloa', municipio: 'Culiacán', colonias: ['Centro'] },
  // Estado de México
  '50000': { estado: 'Estado de México', municipio: 'Toluca', colonias: ['Centro'] },
  '52000': { estado: 'Estado de México', municipio: 'Metepec', colonias: ['Centro'] },
  '55000': { estado: 'Estado de México', municipio: 'Ecatepec', colonias: ['Centro'] },
  // Yucatán
  '97000': { estado: 'Yucatán', municipio: 'Mérida', colonias: ['Centro'] },
  // Quintana Roo
  '77000': { estado: 'Quintana Roo', municipio: 'Chetumal', colonias: ['Centro'] },
  '77500': { estado: 'Quintana Roo', municipio: 'Benito Juárez', colonias: ['Centro', 'Cancún'] },
  // Oaxaca
  '68000': { estado: 'Oaxaca', municipio: 'Oaxaca de Juárez', colonias: ['Centro'] },
  // Guerrero
  '39000': { estado: 'Guerrero', municipio: 'Acapulco de Juárez', colonias: ['Centro'] },
  // Michoacán
  '58000': { estado: 'Michoacán de Ocampo', municipio: 'Morelia', colonias: ['Centro'] },
  // San Luis Potosí
  '78000': { estado: 'San Luis Potosí', municipio: 'San Luis Potosí', colonias: ['Centro'] },
  // Hidalgo
  '42000': { estado: 'Hidalgo', municipio: 'Pachuca de Soto', colonias: ['Centro'] },
  // Morelos
  '62000': { estado: 'Morelos', municipio: 'Cuernavaca', colonias: ['Centro'] },
  // Aguascalientes
  '20000': { estado: 'Aguascalientes', municipio: 'Aguascalientes', colonias: ['Centro'] },
  // Durango
  '34000': { estado: 'Durango', municipio: 'Durango', colonias: ['Centro'] },
  // Zacatecas
  '98000': { estado: 'Zacatecas', municipio: 'Zacatecas', colonias: ['Centro'] },
};

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

  // ── PRIMERO: datos locales embebidos (100% confiables) ───────────────────
  if (SEPOMEX_LOCAL[cp]) {
    const local = SEPOMEX_LOCAL[cp];
    const colonias = local.colonias.map(c => ({ nombre: c, tipo: 'Colonia' }));
    console.log('[CP] Local data hit:', { cp, ...local });
    return jsonOk(local.estado, local.municipio, colonias);
  }

  // ── Deducir estado por prefijo si no está en el catálogo local ───────────
  const prefix2 = cp.substring(0, 2);
  const prefix3 = cp.substring(0, 3);

  const PREFIJOS: Record<string, { estado: string; municipio: string }> = {
    // Ciudad de México (01-16)
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
    // Aguascalientes
    '20': { estado: 'Aguascalientes', municipio: 'Aguascalientes' },
    // Baja California
    '21': { estado: 'Baja California', municipio: 'Mexicali' },
    '22': { estado: 'Baja California', municipio: 'Tijuana' },
    '23': { estado: 'Baja California Sur', municipio: 'La Paz' },
    // Campeche
    '24': { estado: 'Campeche', municipio: 'Campeche' },
    // Coahuila
    '25': { estado: 'Coahuila de Zaragoza', municipio: 'Saltillo' },
    '26': { estado: 'Coahuila de Zaragoza', municipio: 'Torreón' },
    '27': { estado: 'Coahuila de Zaragoza', municipio: 'Torreón' },
    // Colima
    '28': { estado: 'Colima', municipio: 'Colima' },
    // Chiapas
    '29': { estado: 'Chiapas', municipio: 'Tuxtla Gutiérrez' },
    '30': { estado: 'Chiapas', municipio: 'Tuxtla Gutiérrez' },
    // Chihuahua
    '31': { estado: 'Chihuahua', municipio: 'Chihuahua' },
    '32': { estado: 'Chihuahua', municipio: 'Ciudad Juárez' },
    '33': { estado: 'Chihuahua', municipio: 'Delicias' },
    // Durango
    '34': { estado: 'Durango', municipio: 'Durango' },
    '35': { estado: 'Durango', municipio: 'Gómez Palacio' },
    // Guanajuato
    '36': { estado: 'Guanajuato', municipio: 'Guanajuato' },
    '37': { estado: 'Guanajuato', municipio: 'León' },
    '38': { estado: 'Guanajuato', municipio: 'Celaya' },
    // Guerrero
    '39': { estado: 'Guerrero', municipio: 'Acapulco de Juárez' },
    '40': { estado: 'Guerrero', municipio: 'Chilpancingo' },
    '41': { estado: 'Guerrero', municipio: 'Iguala de la Independencia' },
    // Hidalgo
    '42': { estado: 'Hidalgo', municipio: 'Pachuca de Soto' },
    '43': { estado: 'Hidalgo', municipio: 'Tula de Allende' },
    // Jalisco
    '44': { estado: 'Jalisco', municipio: 'Guadalajara' },
    '45': { estado: 'Jalisco', municipio: 'Zapopan' },
    '46': { estado: 'Jalisco', municipio: 'Lagos de Moreno' },
    '47': { estado: 'Jalisco', municipio: 'Ocotlán' },
    '48': { estado: 'Jalisco', municipio: 'Puerto Vallarta' },
    '49': { estado: 'Jalisco', municipio: 'Cd. Guzmán' },
    // Estado de México
    '50': { estado: 'Estado de México', municipio: 'Toluca' },
    '51': { estado: 'Estado de México', municipio: 'Valle de Bravo' },
    '52': { estado: 'Estado de México', municipio: 'Metepec' },
    '53': { estado: 'Estado de México', municipio: 'Naucalpan' },
    '54': { estado: 'Estado de México', municipio: 'Tlalnepantla' },
    '55': { estado: 'Estado de México', municipio: 'Ecatepec' },
    '56': { estado: 'Estado de México', municipio: 'Texcoco' },
    '57': { estado: 'Estado de México', municipio: 'Nezahualcóyotl' },
    // Michoacán
    '58': { estado: 'Michoacán de Ocampo', municipio: 'Morelia' },
    '59': { estado: 'Michoacán de Ocampo', municipio: 'Uruapan' },
    '60': { estado: 'Michoacán de Ocampo', municipio: 'Lázaro Cárdenas' },
    '61': { estado: 'Michoacán de Ocampo', municipio: 'Apatzingán' },
    // Morelos
    '62': { estado: 'Morelos', municipio: 'Cuernavaca' },
    '63': { estado: 'Nayarit', municipio: 'Tepic' },
    // Nuevo León
    '64': { estado: 'Nuevo León', municipio: 'Monterrey' },
    '65': { estado: 'Nuevo León', municipio: 'Monterrey' },
    '66': { estado: 'Nuevo León', municipio: 'San Pedro Garza García' },
    '67': { estado: 'Nuevo León', municipio: 'Guadalupe' },
    // Oaxaca
    '68': { estado: 'Oaxaca', municipio: 'Oaxaca de Juárez' },
    '69': { estado: 'Oaxaca', municipio: 'Huajuapan de León' },
    '70': { estado: 'Oaxaca', municipio: 'Salina Cruz' },
    '71': { estado: 'Oaxaca', municipio: 'Oaxaca de Juárez' },
    // Puebla
    '72': { estado: 'Puebla', municipio: 'Puebla' },
    '73': { estado: 'Puebla', municipio: 'Tehuacán' },
    '74': { estado: 'Puebla', municipio: 'Izúcar de Matamoros' },
    '75': { estado: 'Puebla', municipio: 'Teziutlán' },
    // Querétaro
    '76': { estado: 'Querétaro', municipio: 'Querétaro' },
    '77': { estado: 'Quintana Roo', municipio: 'Chetumal' },
    // San Luis Potosí
    '78': { estado: 'San Luis Potosí', municipio: 'San Luis Potosí' },
    '79': { estado: 'San Luis Potosí', municipio: 'Ciudad Valles' },
    // Sinaloa
    '80': { estado: 'Sinaloa', municipio: 'Culiacán' },
    '81': { estado: 'Sinaloa', municipio: 'Los Mochis' },
    '82': { estado: 'Sinaloa', municipio: 'Mazatlán' },
    // Sonora
    '83': { estado: 'Sonora', municipio: 'Hermosillo' },
    '84': { estado: 'Sonora', municipio: 'Nogales' },
    '85': { estado: 'Sonora', municipio: 'Ciudad Obregón' },
    // Tabasco
    '86': { estado: 'Tabasco', municipio: 'Villahermosa' },
    // Tamaulipas
    '87': { estado: 'Tamaulipas', municipio: 'Ciudad Victoria' },
    '88': { estado: 'Tamaulipas', municipio: 'Nuevo Laredo' },
    '89': { estado: 'Tamaulipas', municipio: 'Tampico' },
    // Tlaxcala
    '90': { estado: 'Tlaxcala', municipio: 'Tlaxcala de Xicohténcatl' },
    // Veracruz
    '91': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Xalapa-Enríquez' },
    '92': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Tuxpan' },
    '93': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Poza Rica' },
    '94': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Orizaba' },
    '95': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'San Andrés Tuxtla' },
    '96': { estado: 'Veracruz de Ignacio de la Llave', municipio: 'Coatzacoalcos' },
    // Yucatán
    '97': { estado: 'Yucatán', municipio: 'Mérida' },
    // Zacatecas
    '98': { estado: 'Zacatecas', municipio: 'Zacatecas' },
    '99': { estado: 'Zacatecas', municipio: 'Fresnillo' },
  };

  // Ajustes de prefijo-3 para mayor precisión
  const PREFIJOS3: Record<string, { estado: string; municipio: string }> = {
    '775': { estado: 'Quintana Roo', municipio: 'Benito Juárez (Cancún)' },
    '776': { estado: 'Quintana Roo', municipio: 'Solidaridad (Playa del Carmen)' },
    '660': { estado: 'Nuevo León', municipio: 'Monterrey' },
    '661': { estado: 'Nuevo León', municipio: 'Apodaca' },
    '662': { estado: 'Nuevo León', municipio: 'Santa Catarina' },
    '663': { estado: 'Nuevo León', municipio: 'Escobedo' },
    '665': { estado: 'Baja California', municipio: 'Ensenada' },
    '530': { estado: 'Estado de México', municipio: 'Naucalpan de Juárez' },
    '538': { estado: 'Estado de México', municipio: 'Huixquilucan' },
  };

  const prefixGuess = PREFIJOS3[prefix3] ?? PREFIJOS[prefix2];

  // ── API 1: IcaliaLabs SEPOMEX ─────────────────────────────────────────────
  try {
    const url = `https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = await res.json();
      const items: any[] = json?.zip_codes || json?.data || [];
      if (Array.isArray(items) && items.length > 0) {
        const first = items[0];
        const estado = String(first.d_estado || '').trim();
        const municipio = String(first.d_mnpio || '').trim();
        if (estado && municipio) {
          const coloniasMap = new Map<string, Colonia>();
          for (const item of items) {
            const nombre = String(item.d_asenta || '').trim();
            const tipo = String(item.d_tipo_asenta || '').trim();
            if (nombre && !coloniasMap.has(nombre)) coloniasMap.set(nombre, { nombre, tipo });
          }
          return jsonOk(estado, municipio, Array.from(coloniasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)));
        }
      }
    }
  } catch { /* continuar */ }

  // ── API 2: hckdrk ────────────────────────────────────────────────────────
  try {
    const url = `https://api-sepomex.hckdrk.mx/query/info_cp/${cp}`;
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = await res.json();
      let items: any[] = Array.isArray(json) ? json : Array.isArray(json?.response) ? json.response : json?.response ? [json.response] : [];
      if (items.length > 0) {
        const f = items[0];
        const estado = String(f.estado || f.d_estado || '').trim();
        const municipio = String(f.municipio || f.d_mnpio || '').trim();
        if (estado && municipio) {
          const coloniasMap = new Map<string, Colonia>();
          for (const item of items) {
            const nombre = String(item.asentamiento || item.d_asenta || '').trim();
            const tipo = String(item.tipo_asentamiento || item.d_tipo_asenta || '').trim();
            if (nombre && !coloniasMap.has(nombre)) coloniasMap.set(nombre, { nombre, tipo });
          }
          return jsonOk(estado, municipio, Array.from(coloniasMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)));
        }
      }
    }
  } catch { /* continuar */ }

  // ── FALLBACK: deducción por prefijo ──────────────────────────────────────
  if (prefixGuess) {
    console.log('[CP] Prefix fallback:', { cp, ...prefixGuess });
    return jsonOk(prefixGuess.estado, prefixGuess.municipio, []);
  }

  return NextResponse.json(
    { error: `No se pudo obtener datos para el CP ${cp}. Llena los campos manualmente.` },
    { status: 404 },
  );
}
