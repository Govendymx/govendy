import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

type Colonia = { nombre: string; tipo: string };
function ok(estado: string, municipio: string, colonias: Colonia[]) {
  return NextResponse.json({ ok: true, estado, municipio, colonias });
}

const LOCAL: Record<string, [string, string, string[]]> = {
  '91180': ['Veracruz de Ignacio de la Llave', 'Xalapa-Enriquez', ['El Encinal', 'Ferrer Guardia', 'El Panorama', 'Casa Blanca', 'Benito Juarez']],
  '91000': ['Veracruz de Ignacio de la Llave', 'Xalapa-Enriquez', ['Centro']],
  '91020': ['Veracruz de Ignacio de la Llave', 'Xalapa-Enriquez', ['Rafael Lucio', 'Badillo']],
  '91900': ['Veracruz de Ignacio de la Llave', 'Veracruz', ['Centro']],
  '64000': ['Nuevo Leon', 'Monterrey', ['Centro']],
  '64100': ['Nuevo Leon', 'Monterrey', ['Colonia del Valle']],
  '64600': ['Nuevo Leon', 'Monterrey', ['San Jeronimo']],
  '66220': ['Nuevo Leon', 'San Pedro Garza Garcia', ['Del Valle']],
  '66000': ['Nuevo Leon', 'San Nicolas de los Garza', ['Centro']],
  '67100': ['Nuevo Leon', 'Guadalupe', ['Centro']],
  '06600': ['Ciudad de Mexico', 'Cuauhtemoc', ['Juarez']],
  '06700': ['Ciudad de Mexico', 'Cuauhtemoc', ['Roma Norte']],
  '06800': ['Ciudad de Mexico', 'Cuauhtemoc', ['Roma Sur']],
  '06100': ['Ciudad de Mexico', 'Cuauhtemoc', ['Centro Historico']],
  '06000': ['Ciudad de Mexico', 'Cuauhtemoc', ['Centro']],
  '11560': ['Ciudad de Mexico', 'Miguel Hidalgo', ['Polanco V Seccion']],
  '11500': ['Ciudad de Mexico', 'Miguel Hidalgo', ['Polanco I Seccion']],
  '02940': ['Ciudad de Mexico', 'Azcapotzalco', ['Reynosa Tamaulipas', 'Porvenir']],
  '02000': ['Ciudad de Mexico', 'Azcapotzalco', ['Centro']],
  '03100': ['Ciudad de Mexico', 'Benito Juarez', ['Narvarte Poniente']],
  '03810': ['Ciudad de Mexico', 'Benito Juarez', ['Del Valle Centro']],
  '04100': ['Ciudad de Mexico', 'Coyoacan', ['Del Carmen']],
  '44100': ['Jalisco', 'Guadalajara', ['Centro']],
  '44200': ['Jalisco', 'Guadalajara', ['Americana']],
  '44600': ['Jalisco', 'Guadalajara', ['Providencia']],
  '45100': ['Jalisco', 'Zapopan', ['Centro']],
  '48300': ['Jalisco', 'Puerto Vallarta', ['Centro']],
  '72000': ['Puebla', 'Puebla', ['Centro']],
  '72140': ['Puebla', 'Puebla', ['Las Animas']],
  '76000': ['Queretaro', 'Queretaro', ['Centro']],
  '76030': ['Queretaro', 'Queretaro', ['Carretas']],
  '37000': ['Guanajuato', 'Leon', ['Centro']],
  '36000': ['Guanajuato', 'Guanajuato', ['Centro']],
  '38000': ['Guanajuato', 'Celaya', ['Centro']],
  '83000': ['Sonora', 'Hermosillo', ['Centro']],
  '84000': ['Sonora', 'Nogales', ['Centro']],
  '85000': ['Sonora', 'Ciudad Obregon', ['Centro']],
  '22000': ['Baja California', 'Tijuana', ['Centro']],
  '21000': ['Baja California', 'Mexicali', ['Centro']],
  '25000': ['Coahuila de Zaragoza', 'Saltillo', ['Centro']],
  '27000': ['Coahuila de Zaragoza', 'Torreon', ['Centro']],
  '97000': ['Yucatan', 'Merida', ['Centro']],
  '77500': ['Quintana Roo', 'Benito Juarez', ['Cancun Centro']],
  '77000': ['Quintana Roo', 'Chetumal', ['Centro']],
  '68000': ['Oaxaca', 'Oaxaca de Juarez', ['Centro']],
  '58000': ['Michoacan de Ocampo', 'Morelia', ['Centro']],
  '59000': ['Michoacan de Ocampo', 'Uruapan', ['Centro']],
  '78000': ['San Luis Potosi', 'San Luis Potosi', ['Centro']],
  '62000': ['Morelos', 'Cuernavaca', ['Centro']],
  '50000': ['Estado de Mexico', 'Toluca', ['Centro']],
  '52000': ['Estado de Mexico', 'Metepec', ['Centro']],
  '55000': ['Estado de Mexico', 'Ecatepec de Morelos', ['Centro']],
  '57000': ['Estado de Mexico', 'Nezahualcoyotl', ['Centro']],
  '80000': ['Sinaloa', 'Culiacan', ['Centro']],
  '82000': ['Sinaloa', 'Mazatlan', ['Centro']],
  '86000': ['Tabasco', 'Villahermosa', ['Centro']],
  '87000': ['Tamaulipas', 'Ciudad Victoria', ['Centro']],
  '88000': ['Tamaulipas', 'Nuevo Laredo', ['Centro']],
  '89000': ['Tamaulipas', 'Tampico', ['Centro']],
  '98000': ['Zacatecas', 'Zacatecas', ['Centro']],
  '20000': ['Aguascalientes', 'Aguascalientes', ['Centro']],
  '23000': ['Baja California Sur', 'La Paz', ['Centro']],
  '24000': ['Campeche', 'Campeche', ['Centro']],
  '28000': ['Colima', 'Colima', ['Centro']],
  '29000': ['Chiapas', 'Tuxtla Gutierrez', ['Centro']],
  '31000': ['Chihuahua', 'Chihuahua', ['Centro']],
  '32000': ['Chihuahua', 'Ciudad Juarez', ['Centro']],
  '34000': ['Durango', 'Durango', ['Centro']],
  '39000': ['Guerrero', 'Acapulco de Juarez', ['Centro']],
  '42000': ['Hidalgo', 'Pachuca de Soto', ['Centro']],
  '63000': ['Nayarit', 'Tepic', ['Centro']],
  '90000': ['Tlaxcala', 'Tlaxcala de Xicohtencatl', ['Centro']],
};

const PREFIJOS: Record<string, [string, string]> = {
  '01': ['Ciudad de Mexico', 'Alvaro Obregon'],
  '02': ['Ciudad de Mexico', 'Azcapotzalco'],
  '03': ['Ciudad de Mexico', 'Benito Juarez'],
  '04': ['Ciudad de Mexico', 'Coyoacan'],
  '05': ['Ciudad de Mexico', 'Cuajimalpa'],
  '06': ['Ciudad de Mexico', 'Cuauhtemoc'],
  '07': ['Ciudad de Mexico', 'Gustavo A. Madero'],
  '08': ['Ciudad de Mexico', 'Iztacalco'],
  '09': ['Ciudad de Mexico', 'Iztapalapa'],
  '10': ['Ciudad de Mexico', 'La Magdalena Contreras'],
  '11': ['Ciudad de Mexico', 'Miguel Hidalgo'],
  '12': ['Ciudad de Mexico', 'Milpa Alta'],
  '13': ['Ciudad de Mexico', 'Tlahuac'],
  '14': ['Ciudad de Mexico', 'Tlalpan'],
  '15': ['Ciudad de Mexico', 'Venustiano Carranza'],
  '16': ['Ciudad de Mexico', 'Xochimilco'],
  '20': ['Aguascalientes', 'Aguascalientes'],
  '21': ['Baja California', 'Mexicali'],
  '22': ['Baja California', 'Tijuana'],
  '23': ['Baja California Sur', 'La Paz'],
  '24': ['Campeche', 'Campeche'],
  '25': ['Coahuila de Zaragoza', 'Saltillo'],
  '26': ['Coahuila de Zaragoza', 'Torreon'],
  '27': ['Coahuila de Zaragoza', 'Torreon'],
  '28': ['Colima', 'Colima'],
  '29': ['Chiapas', 'Tuxtla Gutierrez'],
  '30': ['Chiapas', 'Tuxtla Gutierrez'],
  '31': ['Chihuahua', 'Chihuahua'],
  '32': ['Chihuahua', 'Ciudad Juarez'],
  '33': ['Chihuahua', 'Delicias'],
  '34': ['Durango', 'Durango'],
  '35': ['Durango', 'Gomez Palacio'],
  '36': ['Guanajuato', 'Guanajuato'],
  '37': ['Guanajuato', 'Leon'],
  '38': ['Guanajuato', 'Celaya'],
  '39': ['Guerrero', 'Acapulco de Juarez'],
  '40': ['Guerrero', 'Chilpancingo'],
  '41': ['Guerrero', 'Iguala de la Independencia'],
  '42': ['Hidalgo', 'Pachuca de Soto'],
  '43': ['Hidalgo', 'Tula de Allende'],
  '44': ['Jalisco', 'Guadalajara'],
  '45': ['Jalisco', 'Zapopan'],
  '46': ['Jalisco', 'Lagos de Moreno'],
  '47': ['Jalisco', 'Ocotlan'],
  '48': ['Jalisco', 'Puerto Vallarta'],
  '49': ['Jalisco', 'Ciudad Guzman'],
  '50': ['Estado de Mexico', 'Toluca'],
  '51': ['Estado de Mexico', 'Valle de Bravo'],
  '52': ['Estado de Mexico', 'Metepec'],
  '53': ['Estado de Mexico', 'Naucalpan de Juarez'],
  '54': ['Estado de Mexico', 'Tlalnepantla'],
  '55': ['Estado de Mexico', 'Ecatepec de Morelos'],
  '56': ['Estado de Mexico', 'Texcoco'],
  '57': ['Estado de Mexico', 'Nezahualcoyotl'],
  '58': ['Michoacan de Ocampo', 'Morelia'],
  '59': ['Michoacan de Ocampo', 'Uruapan'],
  '60': ['Michoacan de Ocampo', 'Lazaro Cardenas'],
  '61': ['Michoacan de Ocampo', 'Apatzingan'],
  '62': ['Morelos', 'Cuernavaca'],
  '63': ['Nayarit', 'Tepic'],
  '64': ['Nuevo Leon', 'Monterrey'],
  '65': ['Nuevo Leon', 'Monterrey'],
  '66': ['Nuevo Leon', 'San Nicolas de los Garza'],
  '67': ['Nuevo Leon', 'Guadalupe'],
  '68': ['Oaxaca', 'Oaxaca de Juarez'],
  '69': ['Oaxaca', 'Huajuapan de Leon'],
  '70': ['Oaxaca', 'Salina Cruz'],
  '71': ['Oaxaca', 'Oaxaca de Juarez'],
  '72': ['Puebla', 'Puebla'],
  '73': ['Puebla', 'Tehuacan'],
  '74': ['Puebla', 'Izucar de Matamoros'],
  '75': ['Puebla', 'Teziutlan'],
  '76': ['Queretaro', 'Queretaro'],
  '77': ['Quintana Roo', 'Chetumal'],
  '78': ['San Luis Potosi', 'San Luis Potosi'],
  '79': ['San Luis Potosi', 'Ciudad Valles'],
  '80': ['Sinaloa', 'Culiacan'],
  '81': ['Sinaloa', 'Los Mochis'],
  '82': ['Sinaloa', 'Mazatlan'],
  '83': ['Sonora', 'Hermosillo'],
  '84': ['Sonora', 'Nogales'],
  '85': ['Sonora', 'Ciudad Obregon'],
  '86': ['Tabasco', 'Villahermosa'],
  '87': ['Tamaulipas', 'Ciudad Victoria'],
  '88': ['Tamaulipas', 'Nuevo Laredo'],
  '89': ['Tamaulipas', 'Tampico'],
  '90': ['Tlaxcala', 'Tlaxcala de Xicohtencatl'],
  '91': ['Veracruz de Ignacio de la Llave', 'Xalapa-Enriquez'],
  '92': ['Veracruz de Ignacio de la Llave', 'Tuxpan'],
  '93': ['Veracruz de Ignacio de la Llave', 'Poza Rica'],
  '94': ['Veracruz de Ignacio de la Llave', 'Orizaba'],
  '95': ['Veracruz de Ignacio de la Llave', 'San Andres Tuxtla'],
  '96': ['Veracruz de Ignacio de la Llave', 'Coatzacoalcos'],
  '97': ['Yucatan', 'Merida'],
  '98': ['Zacatecas', 'Zacatecas'],
  '99': ['Zacatecas', 'Fresnillo'],
};

export async function GET(req: NextRequest) {
  const cp = req.nextUrl.searchParams.get('cp')?.trim() ?? '';
  if (!/^\d{5}$/.test(cp)) {
    return NextResponse.json({ error: 'Codigo postal invalido.' }, { status: 400 });
  }

  const loc = LOCAL[cp];
  if (loc) {
    return ok(loc[0], loc[1], loc[2].map((n) => ({ nombre: n, tipo: 'Colonia' })));
  }

  const pref = PREFIJOS[cp.substring(0, 2)];
  if (pref) {
    try {
      const res = await fetch(
        `https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}`,
        { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const json = await res.json();
        const items: any[] = json?.zip_codes || [];
        if (items.length > 0) {
          const estado = String(items[0].d_estado || pref[0]).trim() || pref[0];
          const municipio = String(items[0].d_mnpio || pref[1]).trim() || pref[1];
          const map = new Map<string, Colonia>();
          for (const it of items) {
            const n = String(it.d_asenta || '').trim();
            const t = String(it.d_tipo_asenta || 'Colonia').trim();
            if (n) map.set(n, { nombre: n, tipo: t });
          }
          return ok(estado, municipio, [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        }
      }
    } catch {
      // usar prefijo
    }
    return ok(pref[0], pref[1], []);
  }

  return NextResponse.json(
    { error: `CP ${cp} no encontrado. Llena los campos manualmente.` },
    { status: 404 }
  );
}