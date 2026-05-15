import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

type Colonia = { nombre: string; tipo: string };
function ok(estado: string, municipio: string, colonias: Colonia[]) {
  return NextResponse.json({ ok: true, estado, municipio, colonias });
}

// SEPOMEX local — fuente garantizada sin APIs externas
const LOCAL: Record<string, [string, string, string[]]> = {
  '91180': ['Veracruz de Ignacio de la Llave', 'Xalapa-Enríquez', ['El Encinal', 'Ferrer Guardia', 'El Panorama', 'Casa Blanca', 'Benito Juárez', 'Unidad Habitacional']],
  '91000': ['Veracruz de Ignacio de la Llave', 'Xalapa-Enríquez', ['Centro']],
  '91020': ['Veracruz de Ignacio de la Llave', 'Xalapa-Enríquez', ['Rafael Lucio', 'Badillo']],
  '91900': ['Veracruz de Ignacio de la Llave', 'Veracruz', ['Centro']],
  '64000': ['Nuevo León', 'Monterrey', ['Centro']],
  '64100': ['Nuevo León', 'Monterrey', ['Colonia del Valle']],
  '64600': ['Nuevo León', 'Monterrey', ['San Jerónimo']],
  '66220': ['Nuevo León', 'San Pedro Garza García', ['Del Valle']],
  '66000': ['Nuevo León', 'San Nicolás de los Garza', ['Centro']],
  '67100': ['Nuevo León', 'Guadalupe', ['Centro']],
  '06600': ['Ciudad de México', 'Cuauhtémoc', ['Juárez']],
  '06700': ['Ciudad de México', 'Cuauhtémoc', ['Roma Norte']],
  '06800': ['Ciudad de México', 'Cuauhtémoc', ['Roma Sur']],
  '06100': ['Ciudad de México', 'Cuauhtémoc', ['Centro Histórico']],
  '06000': ['Ciudad de México', 'Cuauhtémoc', ['Centro']],
  '11560': ['Ciudad de México', 'Miguel Hidalgo', ['Polanco V Sección']],
  '11500': ['Ciudad de México', 'Miguel Hidalgo', ['Polanco I Sección']],
  '02940': ['Ciudad de México', 'Azcapotzalco', ['Reynosa Tamaulipas', 'Porvenir']],
  '02000': ['Ciudad de México', 'Azcapotzalco', ['Centro']],
  '03100': ['Ciudad de México', 'Benito Juárez', ['Narvarte Poniente']],
  '03810': ['Ciudad de México', 'Benito Juárez', ['Del Valle Centro']],
  '04100': ['Ciudad de México', 'Coyoacán', ['Del Carmen']],
  '44100': ['Jalisco', 'Guadalajara', ['Centro']],
  '44200': ['Jalisco', 'Guadalajara', ['Americana']],
  '44600': ['Jalisco', 'Guadalajara', ['Providencia']],
  '45100': ['Jalisco', 'Zapopan', ['Centro']],
  '48300': ['Jalisco', 'Puerto Vallarta', ['Centro']],
  '72000': ['Puebla', 'Puebla', ['Centro']],
  '72140': ['Puebla', 'Puebla', ['Las Ánimas']],
  '76000': ['Querétaro', 'Querétaro', ['Centro']],
  '76030': ['Querétaro', 'Querétaro', ['Carretas']],
  '37000': ['Guanajuato', 'León', ['Centro']],
  '36000': ['Guanajuato', 'Guanajuato', ['Centro']],
  '38000': ['Guanajuato', 'Celaya', ['Centro']],
  '83000': ['Sonora', 'Hermosillo', ['Centro']],
  '84000': ['Sonora', 'Nogales', ['Centro']],
  '85000': ['Sonora', 'Ciudad Obregón', ['Centro']],
  '22000': ['Baja California', 'Tijuana', ['Centro']],
  '21000': ['Baja California', 'Mexicali', ['Centro']],
  '25000': ['Coahuila de Zaragoza', 'Saltillo', ['Centro']],
  '27000': ['Coahuila de Zaragoza', 'Torreón', ['Centro']],
  '97000': ['Yucatán', 'Mérida', ['Centro']],
  '77500': ['Quintana Roo', 'Benito Juárez', ['Cancún Centro']],
  '77000': ['Quintana Roo', 'Chetumal', ['Centro']],
  '68000': ['Oaxaca', 'Oaxaca de Juárez', ['Centro']],
  '58000': ['Michoacán de Ocampo', 'Morelia', ['Centro']],
  '59000': ['Michoacán de Ocampo', 'Uruapan', ['Centro']],
  '78000': ['San Luis Potosí', 'San Luis Potosí', ['Centro']],
  '62000': ['Morelos', 'Cuernavaca', ['Centro']],
  '50000': ['Estado de México', 'Toluca', ['Centro']],
  '52000': ['Estado de México', 'Metepec', ['Centro']],
  '55000': ['Estado de México', 'Ecatepec de Morelos', ['Centro']],
  '57000': ['Estado de México', 'Nezahualcóyotl', ['Centro']],
  '80000': ['Sinaloa', 'Culiacán', ['Centro']],
  '82000': ['Sinaloa', 'Mazatlán', ['Centro']],
  '86000': ['Tabasco', 'Villahermosa', ['Centro']],
  '87000': ['Tamaulipas', 'Ciudad Victoria', ['Centro']],
  '88000': ['Tamaulipas', 'Nuevo Laredo', ['Centro']],
  '89000': ['Tamaulipas', 'Tampico', ['Centro']],
  '98000': ['Zacatecas', 'Zacatecas', ['Centro']],
  '20000': ['Aguascalientes', 'Aguascalientes', ['Centro']],
  '23000': ['Baja California Sur', 'La Paz', ['Centro']],
  '24000': ['Campeche', 'Campeche', ['Centro']],
  '28000': ['Colima', 'Colima', ['Centro']],
  '29000': ['Chiapas', 'Tuxtla Gutiérrez', ['Centro']],
  '31000': ['Chihuahua', 'Chihuahua', ['Centro']],
  '32000': ['Chihuahua', 'Ciudad Juárez', ['Centro']],
  '34000': ['Durango', 'Durango', ['Centro']],
  '39000': ['Guerrero', 'Acapulco de Juárez', ['Centro']],
  '42000': ['Hidalgo', 'Pachuca de Soto', ['Centro']],
  '63000': ['Nayarit', 'Tepic', ['Centro']],
  '90000': ['Tlaxcala', 'Tlaxcala de Xicohténcatl', ['Centro']],
};

// Prefijos de 2 dígitos → [estado, municipio base]
const PREFIJOS: Record<string, [string, string]> = {
  '01': ['Ciudad de México', 'Álvaro Obregón'],
  '02': ['Ciudad de México', 'Azcapotzalco'],
  '03': ['Ciudad de México', 'Benito Juárez'],
  '04': ['Ciudad de México', 'Coyoacán'],
  '05': ['Ciudad de México', 'Cuajimalpa'],
  '06': ['Ciudad de México', 'Cuauhtémoc'],
  '07': ['Ciudad de México', 'Gustavo A. Madero'],
  '08': ['Ciudad de México', 'Iztacalco'],
  '09': ['Ciudad de México', 'Iztapalapa'],
  '10': ['Ciudad de México', 'La Magdalena Contreras'],
  '11': ['Ciudad de México', 'Miguel Hidalgo'],
  '12': ['Ciudad de México', 'Milpa Alta'],
  '13': ['Ciudad de México', 'Tláhuac'],
  '14': ['Ciudad de México', 'Tlalpan'],
  '15': ['Ciudad de México', 'Venustiano Carranza'],
  '16': ['Ciudad de México', 'Xochimilco'],
  '20': ['Aguascalientes', 'Aguascalientes'],
  '21': ['Baja California', 'Mexicali'],
  '22': ['Baja California', 'Tijuana'],
  '23': ['Baja California Sur', 'La Paz'],
  '24': ['Campeche', 'Campeche'],
  '25': ['Coahuila de Zaragoza', 'Saltillo'],
  '26': ['Coahuila de Zaragoza', 'Torreón'],
  '27': ['Coahuila de Zaragoza', 'Torreón'],
  '28': ['Colima', 'Colima'],
  '29': ['Chiapas', 'Tuxtla Gutiérrez'],
  '30': ['Chiapas', 'Tuxtla Gutiérrez'],
  '31': ['Chihuahua', 'Chihuahua'],
  '32': ['Chihuahua', 'Ciudad Juárez'],
  '33': ['Chihuahua', 'Delicias'],
  '34': ['Durango', 'Durango'],
  '35': ['Durango', 'Gómez Palacio'],
  '36': ['Guanajuato', 'Guanajuato'],
  '37': ['Guanajuato', 'León'],
  '38': ['Guanajuato', 'Celaya'],
  '39': ['Guerrero', 'Acapulco de Juárez'],
  '40': ['Guerrero', 'Chilpancingo'],
  '41': ['Guerrero', 'Iguala de la Independencia'],
  '42': ['Hidalgo', 'Pachuca de Soto'],
  '43': ['Hidalgo', 'Tula de Allende'],
  '44': ['Jalisco', 'Guadalajara'],
  '45': ['Jalisco', 'Zapopan'],
  '46': ['Jalisco', 'Lagos de Moreno'],
  '47': ['Jalisco', 'Ocotlán'],
  '48': ['Jalisco', 'Puerto Vallarta'],
  '49': ['Jalisco', 'Ciudad Guzmán'],
  '50': ['Estado de México', 'Toluca'],
  '51': ['Estado de México', 'Valle de Bravo'],
  '52': ['Estado de México', 'Metepec'],
  '53': ['Estado de México', 'Naucalpan de Juárez'],
  '54': ['Estado de México', 'Tlalnepantla'],
  '55': ['Estado de México', 'Ecatepec de Morelos'],
  '56': ['Estado de México', 'Texcoco'],
  '57': ['Estado de México', 'Nezahualcóyotl'],
  '58': ['Michoacán de Ocampo', 'Morelia'],
  '59': ['Michoacán de Ocampo', 'Uruapan'],
  '60': ['Michoacán de Ocampo', 'Lázaro Cárdenas'],
  '61': ['Michoacán de Ocampo', 'Apatzingán'],
  '62': ['Morelos', 'Cuernavaca'],
  '63': ['Nayarit', 'Tepic'],
  '64': ['Nuevo León', 'Monterrey'],
  '65': ['Nuevo León', 'Monterrey'],
  '66': ['Nuevo León', 'San Nicolás de los Garza'],
  '67': ['Nuevo León', 'Guadalupe'],
  '68': ['Oaxaca', 'Oaxaca de Juárez'],
  '69': ['Oaxaca', 'Huajuapan de León'],
  '70': ['Oaxaca', 'Salina Cruz'],
  '71': ['Oaxaca', 'Oaxaca de Juárez'],
  '72': ['Puebla', 'Puebla'],
  '73': ['Puebla', 'Tehuacán'],
  '74': ['Puebla', 'Izúcar de Matamoros'],
  '75': ['Puebla', 'Teziutlán'],
  '76': ['Querétaro', 'Querétaro'],
  '77': ['Quintana Roo', 'Chetumal'],
  '78': ['San Luis Potosí', 'San Luis Potosí'],
  '79': ['San Luis Potosí', 'Ciudad Valles'],
  '80': ['Sinaloa', 'Culiacán'],
  '81': ['Sinaloa', 'Los Mochis'],
  '82': ['Sinaloa', 'Mazatlán'],
  '83': ['Sonora', 'Hermosillo'],
  '84': ['Sonora', 'Nogales'],
  '85': ['Sonora', 'Ciudad Obregón'],
  '86': ['Tabasco', 'Villahermosa'],
  '87': ['Tamaulipas', 'Ciudad Victoria'],
  '88': ['Tamaulipas', 'Nuevo Laredo'],
  '89': ['Tamaulipas', 'Tampico'],
  '90': ['Tlaxcala', 'Tlaxcala de Xicohténcatl'],
  '91': ['Veracruz de Ignacio de la Llave', 'Xalapa-Enríquez'],
  '92': ['Veracruz de Ignacio de la Llave', 'Tuxpan'],
  '93': ['Veracruz de Ignacio de la Llave', 'Poza Rica'],
  '94': ['Veracruz de Ignacio de la Llave', 'Orizaba'],
  '95': ['Veracruz de Ignacio de la Llave', 'San Andrés Tuxtla'],
  '96': ['Veracruz de Ignacio de la Llave', 'Coatzacoalcos'],
  '97': ['Yucatán', 'Mérida'],
  '98': ['Zacatecas', 'Zacatecas'],
  '99': ['Zacatecas', 'Fresnillo'],
};

export async function GET(req: NextRequest) {
  const cp = req.nextUrl.searchParams.get('cp')?.trim() ?? '';
  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json({ error: 'Código postal inválido.' }, { status: 400 });
  }

  // 1. Datos locales exactos
  const loc = LOCAL[cp];
  if (loc) {
    return ok(loc[0], loc[1], loc[2].map(n => ({ nombre: n, tipo: 'Colonia' })));
  }

  // 2. Deducción por prefijo (cubre todo México)
  const pref = PREFIJOS[cp.substring(0, 2)];
  if (pref) {
    // Intentar obtener colonias de APIs externas de forma no-bloqueante
    try {
      const res = await fetch(
        `https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const json = await res.json();
        const items: any[] = json?.zip_codes || [];
        if (items.length > 0) {
          const estado = String(items[0].d_estado || pref[0]).trim();
          const municipio = String(items[0].d_mnpio || pref[1]).trim();
          const map = new Map<string, Colonia>();
          for (const it of items) {
            const n = String(it.d_asenta || '').trim();
            const t = String(it.d_tipo_asenta || '').trim();
            if (n) map.set(n, { nombre: n, tipo: t });
          }
          return ok(estado, municipio, [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        }
      }
    } catch { /* usar prefijo */ }
    return ok(pref[0], pref[1], []);
  }

  return NextResponse.json(
    { error: `CP ${cp} no encontrado. Llena los campos manualmente.` },
    { status: 404 }
  );
}
