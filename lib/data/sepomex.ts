
export interface SepomexLocation {
  state: string;
  municipalities: {
    name: string;
    latitude: number;
    longitude: number;
  }[];
}

export const SEPOMEX_DATA: SepomexLocation[] = [
  {
    state: 'Veracruz',
    municipalities: [
      { name: 'Xalapa', latitude: 19.5438, longitude: -96.9102 },
      { name: 'Veracruz', latitude: 19.1738, longitude: -96.1342 },
      { name: 'Coatzacoalcos', latitude: 18.1500, longitude: -94.4333 },
      { name: 'Córdoba', latitude: 18.8833, longitude: -96.9333 },
      { name: 'Poza Rica', latitude: 20.5333, longitude: -97.4333 }
    ]
  },
  {
    state: 'Ciudad de México',
    municipalities: [
      { name: 'Cuauhtémoc', latitude: 19.4326, longitude: -99.1332 },
      { name: 'Gustavo A. Madero', latitude: 19.4833, longitude: -99.1167 },
      { name: 'Iztapalapa', latitude: 19.3553, longitude: -99.0622 },
      { name: 'Benito Juárez', latitude: 19.3700, longitude: -99.1600 },
      { name: 'Miguel Hidalgo', latitude: 19.4236, longitude: -99.2000 }
    ]
  },
  {
    state: 'Jalisco',
    municipalities: [
      { name: 'Guadalajara', latitude: 20.6597, longitude: -103.3496 },
      { name: 'Zapopan', latitude: 20.7233, longitude: -103.3919 },
      { name: 'Puerto Vallarta', latitude: 20.6534, longitude: -105.2253 }
    ]
  },
  {
    state: 'Nuevo León',
    municipalities: [
      { name: 'Monterrey', latitude: 25.6866, longitude: -100.3161 },
      { name: 'San Pedro Garza García', latitude: 25.6575, longitude: -100.4025 },
      { name: 'Guadalupe', latitude: 25.6763, longitude: -100.2564 }
    ]
  },
  {
    state: 'Puebla',
    municipalities: [
      { name: 'Puebla', latitude: 19.0414, longitude: -98.2063 },
      { name: 'Cholula', latitude: 19.0617, longitude: -98.3042 }
    ]
  }
];

export const getAllStates = () => SEPOMEX_DATA.map(d => d.state).sort();

export const getMunicipalitiesByState = (state: string) => {
  const data = SEPOMEX_DATA.find(d => d.state === state);
  return data ? data.municipalities.sort((a, b) => a.name.localeCompare(b.name)) : [];
};
