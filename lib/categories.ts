export type AttributeType = 'text' | 'number' | 'select' | 'boolean' | 'textarea';

export interface AttributeConfig {
  id: string;
  label: string;
  type: AttributeType;
  options?: string[]; // For select type
  min?: number; // For number type
  max?: number;
  suffix?: string; // e.g., "cm", "kg"
  required?: boolean;
  placeholder?: string;
  helpText?: string; // Contextual guidance
  section?: string; // To group attributes in UI if needed
}

export interface SubCategory {
  id: string;
  label: string;
  attributes?: AttributeConfig[];
  restricted?: boolean; // Only for official stores
}

export interface Category {
  id: string;
  label: string;
  subcategories: SubCategory[];
  attributes?: AttributeConfig[]; // Attributes that apply to the whole category
}

export interface GenderCategory {
  label: 'Mujeres' | 'Hombre' | 'Niños' | 'Niñas';
  categories: Category[];
}

// Helper to create simple category without special attributes
const simpleCategory = (label: string): Category => ({
  id: label,
  label,
  subcategories: [],
});

// --- Attribute Definitions ---

export const UNIVERSAL_ATTRIBUTES: AttributeConfig[] = [
  { id: 'brand', label: 'Marca', type: 'text', required: false, section: 'General', helpText: 'Marca del fabricante (ej: Zara, Nike, Sony).' },
  { id: 'model', label: 'Modelo', type: 'text', required: false, section: 'General', helpText: 'Modelo específico (ej: Air Max 90, iPhone 12).' },
  { id: 'color', label: 'Color', type: 'text', required: false, section: 'General', helpText: 'Color principal del artículo.' },
  { id: 'country_of_origin', label: 'País de Origen', type: 'text', required: false, section: 'General', helpText: 'País donde fue fabricado.' },
  { id: 'main_material', label: 'Material Principal', type: 'text', required: false, section: 'General', helpText: 'Material predominante (ej: Algodón, Cuero, Plástico).' },
  { id: 'condition', label: 'Condición', type: 'select', options: ['Nuevo', 'Usado', 'Como nuevo'], required: true, section: 'General', helpText: 'Estado actual del producto.' },
  { id: 'warranty', label: 'Garantía', type: 'text', required: false, placeholder: 'Ej: 30 días con vendedor', section: 'General', helpText: 'Ofrecer garantía aumenta la confianza del comprador.' },
];

const CLOTHING_ATTRIBUTES: AttributeConfig[] = [
  // Size attribute removed in favor of chips (size_variants)
  { id: 'measurements', label: 'Medidas (pecho, cintura, cadera, largo)', type: 'text', required: false, placeholder: 'Ej: 90-60-90, 100cm largo', helpText: 'Proporcionar medidas exactas en cm ayuda a reducir devoluciones.' },
  { id: 'fabric_composition', label: 'Composición de telas', type: 'text', required: false, helpText: 'Ej: 100% Algodón, 50% Poliéster / 50% Algodón.' },
  { id: 'care_instructions', label: 'Instrucciones de cuidado', type: 'text', required: false, helpText: 'Menciona si requiere lavado en seco o cuidados especiales.' },
];

const SHOE_ATTRIBUTES: AttributeConfig[] = [
  { id: 'type', label: 'Tipo', type: 'select', options: ['Tenis', 'Zapato', 'Bota', 'Sandalia', 'Tacón', 'Otro'], required: true, helpText: 'Estilo del calzado.' },
  { id: 'heel_height', label: 'Altura de Tacón', type: 'number', suffix: 'cm', required: false, helpText: 'Mide desde la base del talón hasta el suelo.' },
  { id: 'material_exterior', label: 'Material Exterior', type: 'text', required: false, helpText: 'Ej: Piel, Sintético, Lona.' },
  { id: 'material_interior', label: 'Material Interior', type: 'text', required: false, helpText: 'Ej: Piel, Tela, Sintético.' },
];

const HAT_ATTRIBUTES: AttributeConfig[] = [
  { id: 'head_size', label: 'Talla de cabeza', type: 'text', required: false, helpText: 'Medida de la circunferencia de la cabeza en cm.' },
  { id: 'brim_type', label: 'Tipo de ala', type: 'text', required: false, helpText: 'Ej: Ala ancha, Ala corta, Plana.' },
  { id: 'material', label: 'Material', type: 'text', required: false, helpText: 'Ej: Fieltro, Paja, Lana.' },
  { id: 'style', label: 'Estilo', type: 'text', required: false, helpText: 'Estilo visual del sombrero.' },
  { id: 'type', label: 'Tipo', type: 'select', options: ['Gorras (Snapback)', 'Gorras (Trucker)', 'Gorras (Planas)', 'Sombreros (Panamá)', 'Sombreros (Fedora)', 'Beanies', 'Viseras'], required: true, helpText: 'Categoría específica del sombrero.' },
];

const GLASSES_ATTRIBUTES: AttributeConfig[] = [
  { id: 'frame_type', label: 'Tipo de montura', type: 'text', required: false, helpText: 'Ej: Aviador, Cat-eye, Redondos.' },
  { id: 'lens_material', label: 'Material del lente', type: 'text', required: false, helpText: 'Ej: Policarbonato, Cristal, Orgánico.' },
  { id: 'prescription', label: 'Graduación', type: 'text', required: false, helpText: 'Si aplica, especifica las dioptrías.' },
  { id: 'uv_protection', label: 'Protección UV', type: 'boolean', required: false, helpText: '¿Cuentan con filtro de protección ultravioleta?' },
  { id: 'type', label: 'Tipo', type: 'select', options: ['Lentes de Sol', 'Lentes Oftálmicos'], required: true, helpText: 'Uso principal de los lentes.' },
];

const COMPLEMENTS_ATTRIBUTES: AttributeConfig[] = [
  { id: 'type', label: 'Tipo', type: 'select', options: ['Relojes', 'Carteras', 'Cinturones', 'Corbatas', 'Joyería', 'Bolsos', 'Mochilas', 'Maletines'], required: true, helpText: 'Tipo de accesorio.' },
  { id: 'material', label: 'Material', type: 'text', required: false },
];

const JEWELRY_ATTRIBUTES: AttributeConfig[] = [
  { id: 'material', label: 'Material Metal', type: 'text', required: true, helpText: 'Ej: Oro 14k, Plata .925, Acero Inoxidable.' },
  { id: 'gemstone', label: 'Piedra', type: 'text', required: false, helpText: 'Ej: Diamante, Zirconia, Perla.' },
  { id: 'type', label: 'Tipo de Joya', type: 'text', required: true, helpText: 'Ej: Collar, Anillo, Pulsera.' },
];

const WATCH_ATTRIBUTES: AttributeConfig[] = [
  { id: 'movement', label: 'Movimiento', type: 'select', options: ['Cuarzo', 'Automático', 'Mecánico', 'Digital'], required: false },
  { id: 'case_size', label: 'Tamaño de Caja', type: 'text', suffix: 'mm', required: false },
  { id: 'strap_material', label: 'Material de Correa', type: 'text', required: false },
  { id: 'water_resistance', label: 'Resistencia al Agua', type: 'text', required: false },
];

const BEDDING_ATTRIBUTES: AttributeConfig[] = [
  { id: 'size', label: 'Tamaño', type: 'select', options: ['Individual', 'Matrimonial', 'Queen', 'King Size'], required: true, helpText: 'Tamaño del colchón para el que está diseñado.' },
  { id: 'material', label: 'Material', type: 'text', required: true, helpText: 'Ej: Algodón, Microfibra, Lana, Poliéster.' },
  { id: 'weight', label: 'Peso', type: 'text', required: false, helpText: 'Sugerencia: Incluye el peso (ligero/pesado) para indicar si es apto para clima cálido o frío.' },
  { id: 'weave_technique', label: 'Técnica de tejido', type: 'text', required: false, helpText: 'Ej: Tejido de punto, Percal, Satén.' },
  { id: 'type', label: 'Tipo', type: 'select', options: ['Cobijas (Térmicas)', 'Cobijas (Ligeras)', 'Edredones', 'Cobertores', 'Sábanas', 'Fundas'], required: true, helpText: 'Tipo de ropa de cama.' },
];

const TABLE_ATTRIBUTES: AttributeConfig[] = [
  { id: 'type', label: 'Tipo', type: 'select', options: ['Manteles (Redondos)', 'Manteles (Rectangulares)', 'Manteles (Cuadrados)', 'Caminos de Mesa', 'Individuales', 'Servilletas de Tela'], required: true, helpText: 'Forma o tipo de textil de mesa.' },
  { id: 'dimensions', label: 'Dimensiones (Largo x Ancho)', type: 'text', suffix: 'cm', required: true, helpText: 'Medidas exactas en centímetros para asegurar el ajuste.' },
];

const BATH_ATTRIBUTES: AttributeConfig[] = [
  { id: 'type', label: 'Tipo', type: 'select', options: ['Toallas (Cuerpo)', 'Toallas (Manos)', 'Toallas (Facial)', 'Batas de Baño', 'Tapetes absorbentes'], required: true, helpText: 'Uso específico del textil de baño.' },
];

const DECOR_ATTRIBUTES: AttributeConfig[] = [
  { id: 'type', label: 'Tipo', type: 'select', options: ['Cojines (Decorativos)', 'Cojines (para Silla)', 'Alfombras', 'Cortinas'], required: true, helpText: 'Categoría de decoración.' },
  { id: 'dimensions', label: 'Dimensiones', type: 'text', required: false, helpText: 'Largo x Ancho (y Alto si aplica) en cm.' },
];

const DRINK_ATTRIBUTES: AttributeConfig[] = [
  { id: 'type', label: 'Tipo de Bebida', type: 'text', required: true, helpText: 'Ej: Tequila, Whisky, Vodka, Cerveza Lager, IPA.' },
  { id: 'volume', label: 'Volumen Neto', type: 'text', suffix: 'ml', required: true, helpText: 'Ej: 750ml, 355ml.' },
  { id: 'alcohol_percentage', label: 'Grados de Alcohol', type: 'number', suffix: '%', required: false, helpText: 'Ej: 40%, 5.5%.' },
  { id: 'pack_size', label: 'Unidades por Pack', type: 'number', required: false, helpText: 'Cantidad de botellas/latas si es un paquete.' },
];

const TECH_ATTRIBUTES: AttributeConfig[] = [
  { id: 'brand', label: 'Marca', type: 'text', required: true, helpText: 'Ej: Samsung, Apple, Sony.' },
  { id: 'model', label: 'Modelo', type: 'text', required: true, helpText: 'Ej: Galaxy S21, iPhone 13.' },
  { id: 'specs', label: 'Especificaciones', type: 'textarea', required: false, helpText: 'Detalles técnicos (RAM, Almacenamiento, Procesador).' },
  { id: 'condition', label: 'Condición', type: 'select', options: ['Nuevo', 'Usado', 'Reacondicionado'], required: true },
];

const FURNITURE_ATTRIBUTES: AttributeConfig[] = [
  { id: 'material', label: 'Material', type: 'text', required: true, helpText: 'Ej: Madera, Metal, MDF, Melamina.' },
  { id: 'dimensions', label: 'Dimensiones (Largo x Ancho x Alto)', type: 'text', suffix: 'cm', required: true },
  { id: 'assembly_required', label: 'Requiere Ensamblaje', type: 'boolean', required: false },
  { id: 'color', label: 'Color', type: 'text', required: false }
];

const KITCHEN_ATTRIBUTES: AttributeConfig[] = [
  { id: 'material', label: 'Material', type: 'text', required: true, helpText: 'Ej: Acero Inoxidable, Cerámica, Plástico.' },
  { id: 'pieces', label: 'Piezas en el Set', type: 'number', required: false },
  { id: 'capacity', label: 'Capacidad/Volumen', type: 'text', required: false, helpText: 'Ej: 1 Litro, 500ml.' }
];

const TOOLS_ATTRIBUTES: AttributeConfig[] = [
  { id: 'power_source', label: 'Fuente de Energía', type: 'select', options: ['Eléctrico', 'Inalámbrico (Batería)', 'Gasolina', 'Manual', 'Neumático'], required: false },
  { id: 'voltage', label: 'Voltaje', type: 'text', required: false, suffix: 'V', helpText: 'Ej: 110V, 12V, 20V.' },
  { id: 'power', label: 'Potencia', type: 'text', required: false, helpText: 'Ej: 1500W, 2HP.' },
  { id: 'model', label: 'Modelo', type: 'text', required: false },
  { id: 'dimensions', label: 'Medidas/Dimensiones', type: 'text', required: false, helpText: 'Ej: 1/2 pulgada, 10mm.' }
];

const GARDEN_ATTRIBUTES: AttributeConfig[] = [
   { id: 'material', label: 'Material', type: 'text', required: false },
   { id: 'dimensions', label: 'Dimensiones', type: 'text', required: false },
   { id: 'power_source', label: 'Fuente de Energía', type: 'select', options: ['Gasolina', 'Eléctrico', 'Manual'], required: false }
];

const BEAUTY_ATTRIBUTES: AttributeConfig[] = [
  { id: 'brand', label: 'Marca', type: 'text', required: true },
  { id: 'type', label: 'Tipo de Producto', type: 'text', required: true },
  { id: 'skin_type', label: 'Tipo de Piel', type: 'select', options: ['Todo tipo', 'Grasa', 'Seca', 'Mixta', 'Sensible'], required: false },
  { id: 'volume', label: 'Contenido', type: 'text', required: false, suffix: 'ml/g' },
];

const TOY_ATTRIBUTES: AttributeConfig[] = [
  { id: 'brand', label: 'Marca', type: 'text', required: true },
  { id: 'age_range', label: 'Rango de Edad', type: 'text', required: true, helpText: 'Ej: 3+ años, 6-12 meses.' },
  { id: 'material', label: 'Material', type: 'text', required: false },
];

const BABY_GEAR_ATTRIBUTES: AttributeConfig[] = [
  { id: 'brand', label: 'Marca', type: 'text', required: true },
  { id: 'type', label: 'Tipo', type: 'text', required: true },
  { id: 'max_weight', label: 'Peso Máximo Soportado', type: 'text', required: false, suffix: 'kg' },
];

const DIAPER_ATTRIBUTES: AttributeConfig[] = [
  { id: 'brand', label: 'Marca', type: 'text', required: true },
  { id: 'size', label: 'Etapa/Talla', type: 'text', required: true, helpText: 'Ej: Etapa 1, Recién Nacido, XG.' },
  { id: 'quantity', label: 'Cantidad de Piezas', type: 'number', required: true },
];

const SPORTS_ATTRIBUTES: AttributeConfig[] = [
  { id: 'sport', label: 'Deporte', type: 'text', required: true, helpText: 'Ej: Fútbol, Yoga, Ciclismo.' },
  { id: 'brand', label: 'Marca', type: 'text', required: true },
  { id: 'size', label: 'Talla/Tamaño', type: 'text', required: false },
];

const AUTO_ATTRIBUTES: AttributeConfig[] = [
  { id: 'brand', label: 'Marca', type: 'text', required: true },
  { id: 'part_number', label: 'Número de Parte', type: 'text', required: false },
  { id: 'vehicle_compatibility', label: 'Compatibilidad', type: 'textarea', required: false, helpText: 'Modelos de autos compatibles.' },
];

const MEDIA_ATTRIBUTES: AttributeConfig[] = [
  { id: 'title', label: 'Título', type: 'text', required: true },
  { id: 'author', label: 'Autor/Artista', type: 'text', required: true },
  { id: 'format', label: 'Formato', type: 'text', required: true, helpText: 'Ej: Tapa dura, Vinilo, Blu-ray.' },
  { id: 'genre', label: 'Género', type: 'text', required: false },
];

const PET_ATTRIBUTES: AttributeConfig[] = [
  { id: 'animal', label: 'Animal', type: 'select', options: ['Perro', 'Gato', 'Peces', 'Aves', 'Reptiles', 'Pequeños Mamíferos'], required: true },
  { id: 'brand', label: 'Marca', type: 'text', required: false },
  { id: 'size', label: 'Tamaño/Raza', type: 'text', required: false },
];

const INDUSTRY_ATTRIBUTES: AttributeConfig[] = [
  { id: 'type', label: 'Tipo de Suministro', type: 'text', required: true },
  { id: 'quantity', label: 'Cantidad', type: 'number', required: false },
];

const GENERIC_ATTRIBUTES: AttributeConfig[] = [
  { id: 'description', label: 'Descripción', type: 'textarea', required: true },
];

const INSTRUMENT_ATTRIBUTES: AttributeConfig[] = [
  { id: 'brand', label: 'Marca', type: 'text', required: true },
  { id: 'model', label: 'Modelo', type: 'text', required: true },
  { id: 'type', label: 'Tipo de Instrumento', type: 'text', required: true },
  { id: 'condition', label: 'Condición', type: 'select', options: ['Nuevo', 'Usado', 'Vintage'], required: true },
];

const BOOK_ATTRIBUTES: AttributeConfig[] = [
  { id: 'title', label: 'Título', type: 'text', required: true },
  { id: 'author', label: 'Autor', type: 'text', required: true },
  { id: 'format', label: 'Formato', type: 'select', options: ['Tapa Blanda', 'Tapa Dura', 'Bolsillo', 'Digital'], required: true },
  { id: 'language', label: 'Idioma', type: 'text', required: true },
  { id: 'publisher', label: 'Editorial', type: 'text', required: false },
  { id: 'year', label: 'Año de Publicación', type: 'number', required: false },
];

const ART_ATTRIBUTES: AttributeConfig[] = [
  { id: 'artist', label: 'Artista/Creador', type: 'text', required: true },
  { id: 'technique', label: 'Técnica/Material', type: 'text', required: true },
  { id: 'dimensions', label: 'Dimensiones', type: 'text', required: true },
  { id: 'year', label: 'Año', type: 'number', required: false },
  { id: 'certified', label: 'Certificado de Autenticidad', type: 'boolean', required: false },
];

const FOOD_ATTRIBUTES: AttributeConfig[] = [
  { id: 'brand', label: 'Marca', type: 'text', required: true },
  { id: 'net_content', label: 'Contenido Neto', type: 'text', suffix: 'g/ml', required: true, helpText: 'Ej: 500g, 1L, 12 pack.' },
  { id: 'expiration', label: 'Fecha de Caducidad', type: 'text', required: false, placeholder: 'MM/AAAA' },
  { id: 'dietary', label: 'Información Dietética', type: 'select', options: ['Regular', 'Sin Gluten', 'Vegano', 'Keto', 'Orgánico', 'Sin Azúcar'], required: false },
];


// --- Category Structure ---

// Helper to apply clothing attributes to simple categories
const clothingCategory = (label: string): SubCategory => ({
  id: label,
  label,
  attributes: CLOTHING_ATTRIBUTES
});

export const NEW_CATEGORIES_CONFIG: Record<string, Category[]> = {
  'Mujer': [
    {
      id: 'Ropa',
      label: 'Ropa',
      subcategories: [
        clothingCategory('Vestidos'),
        clothingCategory('Blusas y Tops'),
        clothingCategory('Pantalones y Jeans'),
        clothingCategory('Faldas y Shorts'),
        clothingCategory('Abrigos y Chamarras'),
        clothingCategory('Suéteres y Sudaderas'),
        clothingCategory('Lencería y Ropa Interior'),
        clothingCategory('Trajes de Baño'),
        clothingCategory('Ropa Deportiva'),
        clothingCategory('Overoles y Jumpers'),
        clothingCategory('Pijamas'),
      ]
    },
    {
      id: 'Calzado',
      label: 'Zapatos',
      subcategories: [
        { id: 'Tenis', label: 'Tenis (Sneakers/Deportivos)', attributes: SHOE_ATTRIBUTES },
        { id: 'Botas', label: 'Botas y Botines', attributes: SHOE_ATTRIBUTES },
        { id: 'Sandalias', label: 'Sandalias y Alpargatas', attributes: SHOE_ATTRIBUTES },
        { id: 'Tacones', label: 'Zapatos de Tacón', attributes: SHOE_ATTRIBUTES },
        { id: 'Flats', label: 'Flats y Balerinas', attributes: SHOE_ATTRIBUTES },
      ]
    },
    {
      id: 'Bolsas',
      label: 'Bolsas y Carteras',
      subcategories: [
        { id: 'Bolsas', label: 'Bolsas (Tote, Crossbody)', attributes: COMPLEMENTS_ATTRIBUTES },
        { id: 'Mochilas', label: 'Mochilas de Moda', attributes: COMPLEMENTS_ATTRIBUTES },
        { id: 'Carteras', label: 'Carteras y Monederos', attributes: COMPLEMENTS_ATTRIBUTES },
        { id: 'Clutches', label: 'Clutches y Fiesta', attributes: COMPLEMENTS_ATTRIBUTES },
      ]
    }
  ],
  'Hombre': [
    {
      id: 'Ropa',
      label: 'Ropa',
      subcategories: [
        clothingCategory('Playeras y Polos'),
        clothingCategory('Camisas'),
        clothingCategory('Pantalones y Jeans'),
        clothingCategory('Shorts y Bermudas'),
        clothingCategory('Sudaderas y Suéteres'),
        clothingCategory('Chamarras y Abrigos'),
        clothingCategory('Trajes y Sacos'),
        clothingCategory('Ropa Interior y Calcetas'),
        clothingCategory('Trajes de Baño'),
        clothingCategory('Ropa Deportiva'),
      ]
    },
    {
      id: 'Calzado',
      label: 'Zapatos',
      subcategories: [
        { id: 'Tenis', label: 'Tenis (Sneakers/Deportivos)', attributes: SHOE_ATTRIBUTES },
        { id: 'Zapatos Vestir', label: 'Zapatos de Vestir', attributes: SHOE_ATTRIBUTES },
        { id: 'Botas', label: 'Botas', attributes: SHOE_ATTRIBUTES },
        { id: 'Sandalias', label: 'Sandalias y Chanclas', attributes: SHOE_ATTRIBUTES },
      ]
    }
  ],
  'Niños, Niñas y Bebés': [
    {
      id: 'Bebés',
      label: 'Bebés (0 - 24 Meses)',
      subcategories: [
        clothingCategory('Ropa de Bebé'),
        { id: 'Zapatos Bebé', label: 'Zapatos (Suela blanda)', attributes: SHOE_ATTRIBUTES },
        { id: 'Accesorios Bebé', label: 'Accesorios (Baberos, Gorritos)', attributes: COMPLEMENTS_ATTRIBUTES },
      ]
    },
    {
      id: 'Niñas',
      label: 'Niñas (2 - 16 Años)',
      subcategories: [
        clothingCategory('Vestidos'),
        clothingCategory('Conjuntos'),
        clothingCategory('Playeras'),
        clothingCategory('Faldas'),
        { id: 'Zapatos Niña', label: 'Zapatos Escolares/Casual', attributes: SHOE_ATTRIBUTES },
      ]
    },
    {
      id: 'Niños',
      label: 'Niños (2 - 16 Años)',
      subcategories: [
        clothingCategory('Conjuntos'),
        clothingCategory('Playeras'),
        clothingCategory('Pantalones'),
        clothingCategory('Sudaderas'),
        { id: 'Zapatos Niño', label: 'Zapatos Escolares/Casual', attributes: SHOE_ATTRIBUTES },
      ]
    }
  ],
  'Accesorios de Moda': [
    {
      id: 'Relojes',
      label: 'Relojes',
      subcategories: [
        { id: 'Analogicos', label: 'Relojes Analógicos', attributes: WATCH_ATTRIBUTES },
        { id: 'Digitales', label: 'Relojes Digitales', attributes: WATCH_ATTRIBUTES },
        { id: 'Lujo', label: 'Relojes de Lujo', attributes: WATCH_ATTRIBUTES },
      ]
    },
    {
      id: 'Joyería',
      label: 'Joyería y Bisutería',
      subcategories: [
        { id: 'Collares', label: 'Collares y Dijes', attributes: JEWELRY_ATTRIBUTES },
        { id: 'Aretes', label: 'Aretes y Broqueles', attributes: JEWELRY_ATTRIBUTES },
        { id: 'Pulseras', label: 'Pulseras y Brazaletes', attributes: JEWELRY_ATTRIBUTES },
        { id: 'Anillos', label: 'Anillos', attributes: JEWELRY_ATTRIBUTES },
        { id: 'Fina', label: 'Joyería Fina (Oro/Plata)', attributes: JEWELRY_ATTRIBUTES },
        { id: 'Fantasia', label: 'Bisutería / Fantasía', attributes: JEWELRY_ATTRIBUTES },
      ]
    },
    {
      id: 'Lentes',
      label: 'Lentes',
      subcategories: [
        { id: 'Sol', label: 'Lentes de Sol', attributes: GLASSES_ATTRIBUTES },
        { id: 'Oftalmicos', label: 'Armazones Oftálmicos', attributes: GLASSES_ATTRIBUTES },
      ]
    },
    {
      id: 'Equipaje',
      label: 'Equipaje y Mochilas',
      subcategories: [
        { id: 'Maletas', label: 'Maletas de Viaje', attributes: COMPLEMENTS_ATTRIBUTES },
        { id: 'Mochilas', label: 'Mochilas (Escolares/Laptop)', attributes: COMPLEMENTS_ATTRIBUTES },
        { id: 'Bolsas Viaje', label: 'Bolsas de Viaje', attributes: COMPLEMENTS_ATTRIBUTES },
        { id: 'Cangureras', label: 'Cangureras', attributes: COMPLEMENTS_ATTRIBUTES },
      ]
    },
    {
      id: 'Varios',
      label: 'Accesorios Varios',
      subcategories: [
        { id: 'Cinturones', label: 'Cinturones', attributes: COMPLEMENTS_ATTRIBUTES },
        { id: 'Gorras', label: 'Gorras y Sombreros', attributes: HAT_ATTRIBUTES },
        { id: 'Bufandas', label: 'Bufandas y Pañuelos', attributes: COMPLEMENTS_ATTRIBUTES },
        { id: 'Paraguas', label: 'Paraguas', attributes: COMPLEMENTS_ATTRIBUTES },
      ]
    }
  ],
  'Ropa Especializada / Otros': [
    {
      id: 'Especializada',
      label: 'Ropa Especializada',
      subcategories: [
        clothingCategory('Disfraces y Cosplay'),
        clothingCategory('Ropa de Trabajo Industrial'),
        clothingCategory('Ropa de Maternidad'),
        clothingCategory('Tallas Extra (Plus Size)'),
      ]
    }
  ],
  'Electrónica y Tecnología': [
    {
      id: 'Celulares y Telefonía',
      label: 'Celulares y Telefonía',
      subcategories: [
        { id: 'Smartphones', label: 'Smartphones (Android / iOS)', attributes: TECH_ATTRIBUTES },
        { id: 'Celulares básicos', label: 'Celulares básicos (Feature phones)', attributes: TECH_ATTRIBUTES },
        { id: 'Celulares Reacondicionados', label: 'Celulares Reacondicionados', attributes: TECH_ATTRIBUTES },
        { id: 'Fundas y Carcasas', label: 'Fundas y Carcasas', attributes: TECH_ATTRIBUTES },
        { id: 'Micas y Protectores', label: 'Micas y Protectores de Pantalla', attributes: TECH_ATTRIBUTES },
        { id: 'Cargadores y Cables', label: 'Cargadores y Cables', attributes: TECH_ATTRIBUTES },
        { id: 'Power Banks', label: 'Power Banks (Baterías externas)', attributes: TECH_ATTRIBUTES },
        { id: 'Soportes', label: 'Soportes (Auto, Escritorio)', attributes: TECH_ATTRIBUTES },
        { id: 'Relojes Inteligentes', label: 'Relojes Inteligentes', attributes: TECH_ATTRIBUTES },
        { id: 'Pulseras de Actividad', label: 'Pulseras de Actividad (Smartbands)', attributes: TECH_ATTRIBUTES },
        { id: 'Correas y Cargadores Smartwatch', label: 'Correas y Cargadores para Smartwatch', attributes: TECH_ATTRIBUTES }
      ]
    },
    {
      id: 'Computación',
      label: 'Computación (Informática)',
      subcategories: [
        { id: 'Laptops Tradicionales', label: 'Laptops Tradicionales', attributes: TECH_ATTRIBUTES },
        { id: 'Laptops Gamer', label: 'Laptops Gamer', attributes: TECH_ATTRIBUTES },
        { id: 'Ultrabooks', label: 'Ultrabooks / 2 en 1', attributes: TECH_ATTRIBUTES },
        { id: 'MacBooks', label: 'MacBooks', attributes: TECH_ATTRIBUTES },
        { id: 'All-in-One', label: 'All-in-One (Todo en uno)', attributes: TECH_ATTRIBUTES },
        { id: 'PC Gamer', label: 'PC Gamer (Torres armadas)', attributes: TECH_ATTRIBUTES },
        { id: 'Mini PCs', label: 'Mini PCs', attributes: TECH_ATTRIBUTES },
        { id: 'Discos Duros y SSD', label: 'Discos Duros y SSD Internos', attributes: TECH_ATTRIBUTES },
        { id: 'Memorias RAM', label: 'Memorias RAM', attributes: TECH_ATTRIBUTES },
        { id: 'Procesadores', label: 'Procesadores (CPU)', attributes: TECH_ATTRIBUTES },
        { id: 'Tarjetas de Video', label: 'Tarjetas de Video (GPU)', attributes: TECH_ATTRIBUTES },
        { id: 'Tarjetas Madre', label: 'Tarjetas Madre (Motherboards)', attributes: TECH_ATTRIBUTES },
        { id: 'Fuentes de Poder', label: 'Fuentes de Poder', attributes: TECH_ATTRIBUTES },
        { id: 'Gabinetes y Enfriamiento', label: 'Gabinetes y Enfriamiento', attributes: TECH_ATTRIBUTES },
        { id: 'Monitores', label: 'Monitores', attributes: TECH_ATTRIBUTES },
        { id: 'Teclados y Mouses', label: 'Teclados y Mouses', attributes: TECH_ATTRIBUTES },
        { id: 'Webcams', label: 'Webcams', attributes: TECH_ATTRIBUTES },
        { id: 'Hubs USB y Adaptadores', label: 'Hubs USB y Adaptadores', attributes: TECH_ATTRIBUTES },
        { id: 'Almacenamiento Externo', label: 'Discos duros externos', attributes: TECH_ATTRIBUTES },
        { id: 'Memorias USB', label: 'Memorias USB (Pendrives)', attributes: TECH_ATTRIBUTES },
        { id: 'Tarjetas de Memoria', label: 'Tarjetas de Memoria (SD, MicroSD)', attributes: TECH_ATTRIBUTES },
        { id: 'Routers y Módems', label: 'Routers y Módems', attributes: TECH_ATTRIBUTES },
        { id: 'Repetidores de Señal', label: 'Repetidores de Señal WiFi / Mesh', attributes: TECH_ATTRIBUTES },
        { id: 'Cables de Red', label: 'Cables de Red (Ethernet)', attributes: TECH_ATTRIBUTES }
      ]
    },
    {
      id: 'TV, Audio y Video',
      label: 'TV, Audio y Video',
      subcategories: [
        { id: 'Smart TVs', label: 'Smart TVs (4K, 8K, OLED)', attributes: TECH_ATTRIBUTES },
        { id: 'Soportes para TV', label: 'Soportes para TV', attributes: TECH_ATTRIBUTES },
        { id: 'Dispositivos de Streaming', label: 'Dispositivos de Streaming (Roku, etc.)', attributes: TECH_ATTRIBUTES },
        { id: 'Audífonos', label: 'Audífonos', attributes: TECH_ATTRIBUTES },
        { id: 'Bocinas Portátiles', label: 'Bocinas Portátiles (Bluetooth)', attributes: TECH_ATTRIBUTES },
        { id: 'Barras de Sonido', label: 'Barras de Sonido', attributes: TECH_ATTRIBUTES },
        { id: 'Home Theater', label: 'Home Theater', attributes: TECH_ATTRIBUTES },
        { id: 'Asistentes de Voz', label: 'Asistentes de Voz', attributes: TECH_ATTRIBUTES },
        { id: 'Proyectores', label: 'Proyectores de Cine en Casa', attributes: TECH_ATTRIBUTES },
        { id: 'Mini Proyectores', label: 'Mini Proyectores Portátiles', attributes: TECH_ATTRIBUTES }
      ]
    },
    {
      id: 'Cámaras y Fotografía',
      label: 'Cámaras y Fotografía',
      subcategories: [
        { id: 'Cámaras DSLR', label: 'Cámaras DSLR (Réflex)', attributes: TECH_ATTRIBUTES },
        { id: 'Cámaras Mirrorless', label: 'Cámaras Mirrorless (Sin espejo)', attributes: TECH_ATTRIBUTES },
        { id: 'Cámaras de Acción', label: 'Cámaras de Acción (GoPro)', attributes: TECH_ATTRIBUTES },
        { id: 'Cámaras Instantáneas', label: 'Cámaras Instantáneas', attributes: TECH_ATTRIBUTES },
        { id: 'Drones con cámara', label: 'Drones con cámara', attributes: TECH_ATTRIBUTES },
        { id: 'Refacciones para drones', label: 'Refacciones para drones', attributes: TECH_ATTRIBUTES },
        { id: 'Objetivos', label: 'Objetivos / Lentes', attributes: TECH_ATTRIBUTES },
        { id: 'Tripiés y Estabilizadores', label: 'Tripiés y Estabilizadores', attributes: TECH_ATTRIBUTES },
        { id: 'Iluminación de Estudio', label: 'Iluminación de Estudio', attributes: TECH_ATTRIBUTES },
        { id: 'Mochilas y Estuches', label: 'Mochilas y Estuches para Cámara', attributes: TECH_ATTRIBUTES }
      ]
    },
    {
      id: 'Videojuegos',
      label: 'Videojuegos (Gaming)',
      subcategories: [
        { id: 'PlayStation', label: 'PlayStation (PS5, PS4)', attributes: TECH_ATTRIBUTES },
        { id: 'Xbox', label: 'Xbox (Series X/S, One)', attributes: TECH_ATTRIBUTES },
        { id: 'Nintendo', label: 'Nintendo (Switch)', attributes: TECH_ATTRIBUTES },
        { id: 'Consolas Retro', label: 'Consolas Retro / Arcade', attributes: TECH_ATTRIBUTES },
        { id: 'Juegos Físicos', label: 'Juegos Físicos', attributes: TECH_ATTRIBUTES },
        { id: 'Tarjetas de Regalo', label: 'Tarjetas de Regalo / Digitales', attributes: TECH_ATTRIBUTES },
        { id: 'Controles', label: 'Controles (Mandos)', attributes: TECH_ATTRIBUTES },
        { id: 'Headsets Gamer', label: 'Headsets Gamer', attributes: TECH_ATTRIBUTES },
        { id: 'Sillas Gamer', label: 'Sillas Gamer', attributes: TECH_ATTRIBUTES },
        { id: 'Volantes y Pedales', label: 'Volantes y Pedales', attributes: TECH_ATTRIBUTES }
      ]
    },
    {
      id: 'Electrónica de Oficina',
      label: 'Electrónica de Oficina',
      subcategories: [
        { id: 'Impresoras', label: 'Impresoras', attributes: TECH_ATTRIBUTES },
        { id: 'Multifuncionales', label: 'Multifuncionales', attributes: TECH_ATTRIBUTES },
        { id: 'Escáneres', label: 'Escáneres', attributes: TECH_ATTRIBUTES },
        { id: 'Impresoras 3D', label: 'Impresoras 3D', attributes: TECH_ATTRIBUTES },
        { id: 'Cartuchos de Tinta', label: 'Cartuchos de Tinta', attributes: TECH_ATTRIBUTES },
        { id: 'Tóners', label: 'Tóners', attributes: TECH_ATTRIBUTES },
        { id: 'Filamentos 3D', label: 'Filamentos para 3D', attributes: TECH_ATTRIBUTES },
        { id: 'Calculadoras', label: 'Calculadoras Científicas/Financieras', attributes: TECH_ATTRIBUTES },
        { id: 'Trituradoras', label: 'Trituradoras de Papel', attributes: TECH_ATTRIBUTES },
        { id: 'Teléfonos Fijos', label: 'Teléfonos Fijos / IP', attributes: TECH_ATTRIBUTES }
      ]
    }
  ],
  'Hogar, Jardín y Herramientas': [
    {
      id: 'Muebles y Organización',
      label: 'Muebles y Organización (Hogar)',
      subcategories: [
        { id: 'Sofás y Sillones', label: 'Sala: Sofás y Sillones', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Mesas de Centro', label: 'Sala: Mesas de Centro y Laterales', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Muebles TV', label: 'Sala: Muebles para TV', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Puffs', label: 'Sala: Puffs y Taburetes', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Camas y Bases', label: 'Recámara: Camas y Bases', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Colchones', label: 'Recámara: Colchones', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Cabeceras', label: 'Recámara: Cabeceras', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Burós y Cómodas', label: 'Recámara: Burós y Cómodas', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Armarios', label: 'Recámara: Armarios y Roperos', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Juegos de Comedor', label: 'Comedor: Juegos de Comedor', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Mesas y Sillas', label: 'Comedor: Mesas y Sillas', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Bufeteras', label: 'Comedor: Bufeteras', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Bancos Barra', label: 'Comedor: Bancos para Barra', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Escritorios', label: 'Oficina: Escritorios', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Sillas Oficina', label: 'Oficina: Sillas', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Archiveros', label: 'Oficina: Archiveros y Libreros', attributes: FURNITURE_ATTRIBUTES }
      ]
    },
    {
      id: 'Cocina y Mesa',
      label: 'Cocina y Mesa (Bazar)',
      subcategories: [
        { id: 'Ollas y Cacerolas', label: 'Ollas y Cacerolas', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Sartenes y Woks', label: 'Sartenes y Woks', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Ollas Presión', label: 'Ollas de Presión', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Moldes Hornear', label: 'Moldes para Hornear', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Juegos Vajilla', label: 'Juegos de Vajilla', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Vasos y Copas', label: 'Vasos, Copas y Jarras', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Cubiertos', label: 'Cubiertos', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Servilletas Manteles', label: 'Servilletas y Manteles', attributes: TABLE_ATTRIBUTES },
        { id: 'Cuchillos Tablas', label: 'Cuchillos y Tablas', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Recipientes', label: 'Recipientes y Tuppers', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Organizadores Cocina', label: 'Organizadores de Cocina', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Termos', label: 'Termos y Botellas', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Cafeteras', label: 'Cafeteras (Manuales/Goteo)', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Teteras', label: 'Teteras y Hervidores', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Molinillos', label: 'Molinillos de Café', attributes: KITCHEN_ATTRIBUTES }
      ]
    },
    {
      id: 'Decoración e Iluminación',
      label: 'Decoración e Iluminación',
      subcategories: [
        { id: 'Lámparas Techo', label: 'Lámparas de Techo/Colgantes', attributes: DECOR_ATTRIBUTES },
        { id: 'Lámparas Mesa', label: 'Lámparas de Pie y Mesa', attributes: DECOR_ATTRIBUTES },
        { id: 'Focos', label: 'Focos y Bombillas', attributes: DECOR_ATTRIBUTES },
        { id: 'Tiras LED', label: 'Tiras LED', attributes: DECOR_ATTRIBUTES },
        { id: 'Espejos', label: 'Espejos Decorativos', attributes: DECOR_ATTRIBUTES },
        { id: 'Cuadros', label: 'Cuadros y Marcos', attributes: DECOR_ATTRIBUTES },
        { id: 'Relojes Pared', label: 'Relojes de Pared', attributes: DECOR_ATTRIBUTES },
        { id: 'Vinilos', label: 'Vinilos y Papel Tapiz', attributes: DECOR_ATTRIBUTES },
        { id: 'Cortinas', label: 'Cortinas y Persianas', attributes: DECOR_ATTRIBUTES },
        { id: 'Alfombras', label: 'Alfombras y Tapetes', attributes: DECOR_ATTRIBUTES },
        { id: 'Cojines', label: 'Cojines Decorativos', attributes: DECOR_ATTRIBUTES },
        { id: 'Difusores', label: 'Difusores de Aroma', attributes: DECOR_ATTRIBUTES },
        { id: 'Velas', label: 'Velas y Candelabros', attributes: DECOR_ATTRIBUTES }
      ]
    },
    {
      id: 'Cama, Baño y Limpieza',
      label: 'Cama, Baño y Limpieza',
      subcategories: [
        { id: 'Sábanas', label: 'Juegos de Sábanas', attributes: BEDDING_ATTRIBUTES },
        { id: 'Edredones', label: 'Edredones y Duvets', attributes: BEDDING_ATTRIBUTES },
        { id: 'Almohadas', label: 'Almohadas y Protectores', attributes: BEDDING_ATTRIBUTES },
        { id: 'Toallas', label: 'Toallas', attributes: BATH_ATTRIBUTES },
        { id: 'Cortinas Baño', label: 'Cortinas de Baño', attributes: BATH_ATTRIBUTES },
        { id: 'Accesorios Baño', label: 'Accesorios de Baño', attributes: BATH_ATTRIBUTES },
        { id: 'Tapetes Baño', label: 'Tapetes de Baño', attributes: BATH_ATTRIBUTES },
        { id: 'Cestos', label: 'Cestos de Ropa', attributes: DECOR_ATTRIBUTES },
        { id: 'Tendederos', label: 'Tendederos y Ganchos', attributes: GENERIC_ATTRIBUTES },
        { id: 'Tablas Planchar', label: 'Tablas de Planchar', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Artículos Limpieza', label: 'Artículos de Limpieza', attributes: GENERIC_ATTRIBUTES }
      ]
    },
    {
      id: 'Jardín y Aire Libre',
      label: 'Jardín y Aire Libre',
      subcategories: [
        { id: 'Salas Exterior', label: 'Salas de Exterior', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Comedores Jardín', label: 'Comedores de Jardín', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Hamacas', label: 'Hamacas y Tumbonas', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Sombrillas', label: 'Sombrillas y Toldos', attributes: FURNITURE_ATTRIBUTES },
        { id: 'Asadores Carbón', label: 'Asadores de Carbón/Leña', attributes: GARDEN_ATTRIBUTES },
        { id: 'Asadores Gas', label: 'Asadores de Gas', attributes: GARDEN_ATTRIBUTES },
        { id: 'Ahumadores', label: 'Ahumadores', attributes: GARDEN_ATTRIBUTES },
        { id: 'Utensilios Asar', label: 'Utensilios para Asar', attributes: KITCHEN_ATTRIBUTES },
        { id: 'Macetas', label: 'Macetas y Jardineras', attributes: GARDEN_ATTRIBUTES },
        { id: 'Plantas', label: 'Plantas (Naturales/Artificiales)', attributes: GARDEN_ATTRIBUTES },
        { id: 'Sustratos', label: 'Sustratos y Fertilizantes', attributes: GARDEN_ATTRIBUTES },
        { id: 'Semillas', label: 'Semillas', attributes: GARDEN_ATTRIBUTES },
        { id: 'Riego', label: 'Mangueras y Riego', attributes: GARDEN_ATTRIBUTES },
        { id: 'Cortadoras', label: 'Cortadoras de Césped', attributes: TOOLS_ATTRIBUTES },
        { id: 'Desbrozadoras', label: 'Desbrozadoras', attributes: TOOLS_ATTRIBUTES },
        { id: 'Sopladoras', label: 'Sopladoras de Hojas', attributes: TOOLS_ATTRIBUTES },
        { id: 'Motosierras', label: 'Motosierras', attributes: TOOLS_ATTRIBUTES },
        { id: 'Albercas', label: 'Albercas Inflables/Estructurales', attributes: GARDEN_ATTRIBUTES },
        { id: 'Inflables Agua', label: 'Inflables y Juguetes de Agua', attributes: TOY_ATTRIBUTES },
        { id: 'Químicos Alberca', label: 'Químicos y Limpieza de Piscinas', attributes: GARDEN_ATTRIBUTES }
      ]
    },
    {
      id: 'Herramientas y Mejoras',
      label: 'Herramientas y Mejoras del Hogar',
      subcategories: [
        { id: 'Taladros', label: 'Taladros y Atornilladores', attributes: TOOLS_ATTRIBUTES },
        { id: 'Esmeriladoras', label: 'Esmeriladoras', attributes: TOOLS_ATTRIBUTES },
        { id: 'Sierras', label: 'Sierras', attributes: TOOLS_ATTRIBUTES },
        { id: 'Lijadoras', label: 'Lijadoras', attributes: TOOLS_ATTRIBUTES },
        { id: 'Soldadoras', label: 'Soldadoras', attributes: TOOLS_ATTRIBUTES },
        { id: 'Compresores', label: 'Compresores de Aire', attributes: TOOLS_ATTRIBUTES },
        { id: 'Kits Herramientas', label: 'Juegos de Herramientas', attributes: TOOLS_ATTRIBUTES },
        { id: 'Desarmadores', label: 'Desarmadores y Llaves', attributes: TOOLS_ATTRIBUTES },
        { id: 'Martillos', label: 'Martillos y Mazos', attributes: TOOLS_ATTRIBUTES },
        { id: 'Alicates', label: 'Alicates y Pinzas', attributes: TOOLS_ATTRIBUTES },
        { id: 'Medición', label: 'Instrumentos de Medición', attributes: TOOLS_ATTRIBUTES },
        { id: 'Tornillos', label: 'Tornillos y Fijaciones', attributes: TOOLS_ATTRIBUTES },
        { id: 'Pegamentos', label: 'Cintas y Pegamentos', attributes: GENERIC_ATTRIBUTES },
        { id: 'Cerraduras', label: 'Cerraduras y Herrajes', attributes: TOOLS_ATTRIBUTES },
        { id: 'Grifería', label: 'Grifería', attributes: TOOLS_ATTRIBUTES },
        { id: 'Regaderas', label: 'Regaderas y Duchas', attributes: TOOLS_ATTRIBUTES },
        { id: 'Bombas Agua', label: 'Bombas de Agua', attributes: TOOLS_ATTRIBUTES },
        { id: 'Calentadores', label: 'Calentadores de Agua (Boilers)', attributes: TOOLS_ATTRIBUTES },
        { id: 'Extensiones', label: 'Extensiones y Multicontactos', attributes: TOOLS_ATTRIBUTES },
        { id: 'Interruptores', label: 'Interruptores y Enchufes', attributes: TOOLS_ATTRIBUTES },
        { id: 'Cableado', label: 'Cableado Eléctrico', attributes: TOOLS_ATTRIBUTES },
        { id: 'Fusibles', label: 'Fusibles y Centros de Carga', attributes: TOOLS_ATTRIBUTES },
        { id: 'Zapatos Seguridad', label: 'Zapatos de Seguridad', attributes: CLOTHING_ATTRIBUTES },
        { id: 'Cascos Lentes', label: 'Cascos, Lentes y Guantes', attributes: COMPLEMENTS_ATTRIBUTES },
        { id: 'Chalecos', label: 'Chalecos Reflejantes', attributes: CLOTHING_ATTRIBUTES }
      ]
    }
  ],
  'Belleza y Salud': [
    { 
      id: 'Cuidado de la Piel', 
      label: 'Cuidado de la Piel (Skincare)', 
      subcategories: [
        { id: 'Limpiadores', label: 'Limpiadores y Desmaquillantes', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Tonicos', label: 'Tónicos y Brumas', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Serums', label: 'Serums y Tratamientos', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Cremas', label: 'Cremas Hidratantes', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Ojos', label: 'Contorno de Ojos', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Mascarillas', label: 'Mascarillas', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Exfoliantes', label: 'Exfoliantes Faciales', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Proteccion Solar', label: 'Protección Solar', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Cuerpo', label: 'Cuidado Corporal (Cremas/Aceites)', attributes: BEAUTY_ATTRIBUTES },
      ]
    },
    { 
      id: 'Maquillaje', 
      label: 'Maquillaje', 
      subcategories: [
        { id: 'Bases', label: 'Bases y Correctores', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Polvos', label: 'Polvos y Rubores', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Iluminadores', label: 'Iluminadores y Bronzers', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Ojos', label: 'Ojos (Sombras, Delineadores, Rímel)', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Cejas', label: 'Cejas', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Labios', label: 'Labiales y Bálsamos', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Brochas', label: 'Herramientas y Brochas', attributes: BEAUTY_ATTRIBUTES },
      ]
    },
    { 
      id: 'Cabello', 
      label: 'Cuidado del Cabello', 
      subcategories: [
        { id: 'Shampoo', label: 'Shampoo y Acondicionador', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Tratamientos', label: 'Tratamientos y Mascarillas', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Coloracion', label: 'Tintes y Coloración', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Peinado', label: 'Peinado (Gel, Spray)', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Herramientas', label: 'Aparatos (Secadoras, Planchas)', attributes: TECH_ATTRIBUTES },
      ]
    },
    { 
      id: 'Perfumes', 
      label: 'Perfumes y Fragancias', 
      subcategories: [
        { id: 'Mujer', label: 'Perfumes Mujer', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Hombre', label: 'Perfumes Hombre', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Unisex', label: 'Perfumes Unisex', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Body Mists', label: 'Body Mists', attributes: BEAUTY_ATTRIBUTES },
      ]
    },
    { 
      id: 'Cuidado Personal', 
      label: 'Cuidado Personal e Higiene', 
      subcategories: [
        { id: 'Bucal', label: 'Cuidado Bucal', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Desodorantes', label: 'Desodorantes', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Afeitado', label: 'Afeitado y Depilación', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Higiene Fem', label: 'Higiene Femenina', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Uñas', label: 'Manicure y Pedicure', attributes: BEAUTY_ATTRIBUTES },
      ]
    },
    { 
      id: 'Salud', 
      label: 'Salud y Bienestar', 
      subcategories: [
        { id: 'Vitaminas', label: 'Vitaminas y Suplementos', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Botiquin', label: 'Botiquín y Primeros Auxilios', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Equipo Medico', label: 'Equipamiento Médico Hogar', attributes: TECH_ATTRIBUTES },
        { id: 'Sexual', label: 'Bienestar Sexual', attributes: BEAUTY_ATTRIBUTES },
        { id: 'Ortopedia', label: 'Ortopedia y Rehabilitación', attributes: BEAUTY_ATTRIBUTES },
      ]
    }
  ],
  'Bebé y Juguetes': [
    {
      id: 'Bebé',
      label: 'Bebés (Mundo Bebé / Puericultura)',
      subcategories: [
        { id: 'Paseo', label: 'Paseo y Viaje (Carriolas, Autoasientos)', attributes: BABY_GEAR_ATTRIBUTES },
        { id: 'Lactancia', label: 'Lactancia y Alimentación', attributes: BABY_GEAR_ATTRIBUTES },
        { id: 'Pañales', label: 'Pañales y Cambio', attributes: DIAPER_ATTRIBUTES },
        { id: 'Baño', label: 'Hora del Baño', attributes: BABY_GEAR_ATTRIBUTES },
        { id: 'Salud Bebe', label: 'Salud y Cuidado', attributes: BABY_GEAR_ATTRIBUTES },
        { id: 'Cuarto', label: 'Cuarto del Bebé (Cunas, Monitores)', attributes: FURNITURE_ATTRIBUTES },
      ]
    },
    {
      id: 'Juguetes',
      label: 'Juguetes y Juegos',
      subcategories: [
        { id: 'Construccion', label: 'Construcción y Bloques', attributes: TOY_ATTRIBUTES },
        { id: 'Muñecas', label: 'Muñecas y Peluches', attributes: TOY_ATTRIBUTES },
        { id: 'Figuras', label: 'Figuras de Acción', attributes: TOY_ATTRIBUTES },
        { id: 'Vehiculos', label: 'Vehículos y Pistas', attributes: TOY_ATTRIBUTES },
        { id: 'Juegos Mesa', label: 'Juegos de Mesa y Rompecabezas', attributes: TOY_ATTRIBUTES },
        { id: 'Aire Libre', label: 'Aire Libre y Montables', attributes: TOY_ATTRIBUTES },
        { id: 'Arte', label: 'Arte, Manualidades y Educativos', attributes: TOY_ATTRIBUTES },
        { id: 'Primera Infancia', label: 'Primera Infancia (0-3 años)', attributes: TOY_ATTRIBUTES },
      ]
    }
  ],

  'Entretenimiento, Arte y Cultura': [
    {
      id: 'Libros',
      label: 'Libros y Revistas',
      subcategories: [
        { id: 'Literatura', label: 'Literatura y Ficción', attributes: BOOK_ATTRIBUTES },
        { id: 'Infantil', label: 'Infantil y Juvenil', attributes: BOOK_ATTRIBUTES },
        { id: 'Comics', label: 'Cómics y Manga', attributes: BOOK_ATTRIBUTES },
        { id: 'Academicos', label: 'Académicos y Texto', attributes: BOOK_ATTRIBUTES },
        { id: 'Arte', label: 'Arte y Fotografía', attributes: BOOK_ATTRIBUTES },
        { id: 'Revistas', label: 'Revistas y Periódicos', attributes: BOOK_ATTRIBUTES },
      ]
    },
    {
      id: 'Instrumentos',
      label: 'Instrumentos Musicales',
      subcategories: [
        { id: 'Guitarras', label: 'Guitarras y Bajos', attributes: INSTRUMENT_ATTRIBUTES },
        { id: 'Teclados', label: 'Teclados y Pianos', attributes: INSTRUMENT_ATTRIBUTES },
        { id: 'Baterias', label: 'Baterías y Percusión', attributes: INSTRUMENT_ATTRIBUTES },
        { id: 'Audio Pro', label: 'Audio Profesional y Grabación', attributes: INSTRUMENT_ATTRIBUTES },
        { id: 'Viento', label: 'Instrumentos de Viento y Orquesta', attributes: INSTRUMENT_ATTRIBUTES },
      ]
    },
    {
      id: 'Arte y Manualidades',
      label: 'Arte, Manualidades y Costura',
      subcategories: [
        { id: 'Pintura', label: 'Pintura y Dibujo', attributes: GENERIC_ATTRIBUTES },
        { id: 'Costura', label: 'Costura y Tejido', attributes: GENERIC_ATTRIBUTES },
        { id: 'Manualidades', label: 'Manualidades y Scrapbooking', attributes: GENERIC_ATTRIBUTES },
        { id: 'Joyeria Insumos', label: 'Insumos para Joyería', attributes: GENERIC_ATTRIBUTES },
      ]
    },
    {
      id: 'Musica y Peliculas',
      label: 'Música y Películas (Físico)',
      subcategories: [
        { id: 'Vinilos', label: 'Vinilos (LPs)', attributes: MEDIA_ATTRIBUTES },
        { id: 'CDs', label: 'CDs y Cassettes', attributes: MEDIA_ATTRIBUTES },
        { id: 'Peliculas', label: 'Películas (Blu-ray / 4K / DVD)', attributes: MEDIA_ATTRIBUTES },
      ]
    },
    {
      id: 'Coleccionables',
      label: 'Arte y Coleccionables',
      subcategories: [
        { id: 'Arte Original', label: 'Arte Original (Pinturas/Esculturas)', attributes: ART_ATTRIBUTES },
        { id: 'Antiguedades', label: 'Antigüedades', attributes: GENERIC_ATTRIBUTES },
        { id: 'Numismatica', label: 'Numismática y Filatelia', attributes: GENERIC_ATTRIBUTES },
        { id: 'Memorabilia', label: 'Memorabilia y Utilería', attributes: GENERIC_ATTRIBUTES },
      ]
    }
  ],
  'Industria y Empresas': [
    {
      id: 'Gastronomia',
      label: 'Gastronomía y Hotelería',
      subcategories: [
        { id: 'Coccion', label: 'Cocción Industrial', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Refrigeracion', label: 'Refrigeración Comercial', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Preparacion', label: 'Preparación de Alimentos', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Mobiliario Inox', label: 'Mobiliario Acero Inoxidable', attributes: INDUSTRY_ATTRIBUTES },
      ]
    },
    {
      id: 'Embalaje',
      label: 'Embalaje y Logística',
      subcategories: [
        { id: 'Material Empaque', label: 'Material de Empaque', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Etiquetado', label: 'Etiquetado', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Manejo Materiales', label: 'Manejo de Materiales', attributes: INDUSTRY_ATTRIBUTES },
      ]
    },
    {
      id: 'Oficina',
      label: 'Suministros de Oficina',
      subcategories: [
        { id: 'Papel', label: 'Papel y Consumibles', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Equipamiento', label: 'Equipamiento de Oficina', attributes: INDUSTRY_ATTRIBUTES },
      ]
    },
    {
      id: 'Seguridad',
      label: 'Seguridad Industrial',
      subcategories: [
        { id: 'Proteccion', label: 'Protección Personal (EPP)', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Senalizacion', label: 'Señalización y Seguridad Vial', attributes: INDUSTRY_ATTRIBUTES },
      ]
    },
    {
      id: 'Medico',
      label: 'Equipamiento Médico Profesional',
      subcategories: [
        { id: 'Mobiliario Med', label: 'Mobiliario Médico', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Insumos', label: 'Insumos Desechables', attributes: INDUSTRY_ATTRIBUTES },
      ]
    },
    {
      id: 'Comercial',
      label: 'Equipamiento Comercial',
      subcategories: [
        { id: 'POS', label: 'Punto de Venta (POS)', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Exhibicion', label: 'Exhibición y Maniquíes', attributes: INDUSTRY_ATTRIBUTES },
      ]
    },
    {
      id: 'Limpieza',
      label: 'Limpieza Institucional',
      subcategories: [
        { id: 'Quimicos', label: 'Químicos a Granel', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Papel Inst', label: 'Papel Higiénico Institucional', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Maquinaria', label: 'Maquinaria de Limpieza', attributes: INDUSTRY_ATTRIBUTES },
      ]
    },
    {
      id: 'Agroindustria',
      label: 'Agroindustria y Ganadería',
      subcategories: [
        { id: 'Cultivo', label: 'Cultivo', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Maquinaria Agro', label: 'Maquinaria Ligera', attributes: INDUSTRY_ATTRIBUTES },
        { id: 'Ganaderia', label: 'Ganadería', attributes: INDUSTRY_ATTRIBUTES },
      ]
    }
  ],
  'Mascotas': [
    {
      id: 'Perros',
      label: 'Perros (Artículos y Alimento)',
      subcategories: [
        { id: 'Alimento', label: 'Alimento y Premios', attributes: PET_ATTRIBUTES },
        { id: 'Paseo', label: 'Paseo y Viaje', attributes: PET_ATTRIBUTES },
        { id: 'Camas', label: 'Camas y Muebles', attributes: PET_ATTRIBUTES },
        { id: 'Higiene', label: 'Higiene y Estética', attributes: PET_ATTRIBUTES },
        { id: 'Juguetes', label: 'Juguetes', attributes: PET_ATTRIBUTES },
        { id: 'Ropa', label: 'Ropa y Accesorios', attributes: CLOTHING_ATTRIBUTES },
      ]
    },
    {
      id: 'Gatos',
      label: 'Gatos (Artículos y Alimento)',
      subcategories: [
        { id: 'Alimento Gato', label: 'Alimento', attributes: PET_ATTRIBUTES },
        { id: 'Arena', label: 'Arena y Limpieza', attributes: PET_ATTRIBUTES },
        { id: 'Muebles Gato', label: 'Muebles y Rascadores', attributes: PET_ATTRIBUTES },
        { id: 'Juguetes Gato', label: 'Juguetes', attributes: PET_ATTRIBUTES },
        { id: 'Higiene Gato', label: 'Higiene y Salud', attributes: PET_ATTRIBUTES },
      ]
    },
    {
      id: 'Acuarios',
      label: 'Acuarios y Terrarios',
      subcategories: [
        { id: 'Peces Accesorios', label: 'Acuarios y Filtros', attributes: PET_ATTRIBUTES },
        { id: 'Reptiles Accesorios', label: 'Terrarios y Calefacción', attributes: PET_ATTRIBUTES },
      ]
    }
  ],
  'Deportes y Aire Libre': [
    {
      id: 'Fitness',
      label: 'Fitness y Musculación (Gym en Casa)',
      subcategories: [
        { id: 'Cardio', label: 'Máquinas de Cardio', attributes: SPORTS_ATTRIBUTES },
        { id: 'Pesas', label: 'Pesas y Fuerza', attributes: SPORTS_ATTRIBUTES },
        { id: 'Funcional', label: 'Accesorios Funcionales / Crossfit', attributes: SPORTS_ATTRIBUTES },
      ]
    },
    {
      id: 'Ciclismo',
      label: 'Ciclismo',
      subcategories: [
        { id: 'Bicicletas', label: 'Bicicletas', attributes: SPORTS_ATTRIBUTES },
        { id: 'Componentes Bici', label: 'Componentes y Refacciones', attributes: SPORTS_ATTRIBUTES },
        { id: 'Accesorios Bici', label: 'Accesorios para Ciclista', attributes: SPORTS_ATTRIBUTES },
      ]
    },
    {
      id: 'Deportes Equipo',
      label: 'Deportes de Equipo',
      subcategories: [
        { id: 'Futbol', label: 'Fútbol', attributes: SPORTS_ATTRIBUTES },
        { id: 'Basket', label: 'Básquetbol', attributes: SPORTS_ATTRIBUTES },
        { id: 'Beisbol', label: 'Béisbol y Softbol', attributes: SPORTS_ATTRIBUTES },
        { id: 'Voleibol', label: 'Voleibol', attributes: SPORTS_ATTRIBUTES },
        { id: 'Fut Americano', label: 'Fútbol Americano', attributes: SPORTS_ATTRIBUTES },
      ]
    },
    {
      id: 'Camping',
      label: 'Camping, Caza y Pesca',
      subcategories: [
        { id: 'Camping', label: 'Camping y Senderismo', attributes: SPORTS_ATTRIBUTES },
        { id: 'Pesca', label: 'Pesca', attributes: SPORTS_ATTRIBUTES },
      ]
    },
    {
      id: 'Raqueta',
      label: 'Deportes de Raqueta',
      subcategories: [
        { id: 'Tenis', label: 'Tenis', attributes: SPORTS_ATTRIBUTES },
        { id: 'Padel', label: 'Pádel', attributes: SPORTS_ATTRIBUTES },
        { id: 'Ping Pong', label: 'Ping Pong', attributes: SPORTS_ATTRIBUTES },
        { id: 'Squash', label: 'Squash / Frontón', attributes: SPORTS_ATTRIBUTES },
      ]
    },
    {
      id: 'Acuaticos',
      label: 'Deportes Acuáticos',
      subcategories: [
        { id: 'Natacion', label: 'Natación', attributes: SPORTS_ATTRIBUTES },
        { id: 'Surf', label: 'Surf y Bodyboard', attributes: SPORTS_ATTRIBUTES },
        { id: 'Buceo', label: 'Buceo y Snorkel', attributes: SPORTS_ATTRIBUTES },
        { id: 'Kayaks', label: 'Kayaks e Inflables', attributes: SPORTS_ATTRIBUTES },
      ]
    },
    {
      id: 'Patines',
      label: 'Patines, Skate y Scooters',
      subcategories: [
        { id: 'Skate', label: 'Skateboarding', attributes: SPORTS_ATTRIBUTES },
        { id: 'Patines', label: 'Patines', attributes: SPORTS_ATTRIBUTES },
        { id: 'Scooters', label: 'Scooters', attributes: SPORTS_ATTRIBUTES },
        { id: 'Proteccion Skate', label: 'Protección', attributes: SPORTS_ATTRIBUTES },
      ]
    },
    {
      id: 'Golf',
      label: 'Golf',
      subcategories: [
        { id: 'Palos', label: 'Palos de Golf', attributes: SPORTS_ATTRIBUTES },
        { id: 'Bolsas Golf', label: 'Bolsas de Golf', attributes: SPORTS_ATTRIBUTES },
        { id: 'Accesorios Golf', label: 'Pelotas y Accesorios', attributes: SPORTS_ATTRIBUTES },
      ]
    },
    {
      id: 'Artes Marciales',
      label: 'Artes Marciales y Boxeo',
      subcategories: [
        { id: 'Boxeo', label: 'Boxeo', attributes: SPORTS_ATTRIBUTES },
        { id: 'MMA', label: 'Artes Marciales (MMA, Karate, Judo)', attributes: SPORTS_ATTRIBUTES },
      ]
    }
  ],
  'Automotriz y Motocicletas': [
    {
      id: 'Refacciones Auto',
      label: 'Refacciones Autos y Camionetas',
      subcategories: [
        { id: 'Motor', label: 'Motor', attributes: AUTO_ATTRIBUTES },
        { id: 'Frenos', label: 'Frenos', attributes: AUTO_ATTRIBUTES },
        { id: 'Suspension', label: 'Suspensión y Dirección', attributes: AUTO_ATTRIBUTES },
        { id: 'Carroceria', label: 'Carrocería', attributes: AUTO_ATTRIBUTES },
        { id: 'Electrico', label: 'Sistema Eléctrico', attributes: AUTO_ATTRIBUTES },
        { id: 'Transmision', label: 'Transmisión', attributes: AUTO_ATTRIBUTES },
      ]
    },
    {
      id: 'Accesorios Auto',
      label: 'Accesorios para Autos',
      subcategories: [
        { id: 'Interior', label: 'Accesorios de Interior', attributes: AUTO_ATTRIBUTES },
        { id: 'Exterior', label: 'Accesorios de Exterior', attributes: AUTO_ATTRIBUTES },
        { id: 'Car Audio', label: 'Audio y Electrónica', attributes: AUTO_ATTRIBUTES },
      ]
    },
    {
      id: 'Llantas',
      label: 'Llantas y Rines',
      subcategories: [
        { id: 'Llantas', label: 'Llantas', attributes: AUTO_ATTRIBUTES },
        { id: 'Rines', label: 'Rines', attributes: AUTO_ATTRIBUTES },
        { id: 'Accesorios Llantas', label: 'Accesorios de Llantas', attributes: AUTO_ATTRIBUTES },
      ]
    },
    {
      id: 'Motos',
      label: 'Motociclismo',
      subcategories: [
        { id: 'Equipamiento Moto', label: 'Equipamiento para Motociclista', attributes: CLOTHING_ATTRIBUTES },
        { id: 'Refacciones Moto', label: 'Refacciones para Moto', attributes: AUTO_ATTRIBUTES },
        { id: 'Accesorios Moto', label: 'Accesorios para Moto', attributes: AUTO_ATTRIBUTES },
      ]
    },
    {
      id: 'Herramientas Auto',
      label: 'Herramientas y Cuidado del Vehículo',
      subcategories: [
        { id: 'Aceites', label: 'Aceites y Fluidos', attributes: AUTO_ATTRIBUTES },
        { id: 'Detailing', label: 'Estética Automotriz', attributes: GENERIC_ATTRIBUTES },
        { id: 'Herramientas Mec', label: 'Herramientas Automotrices', attributes: TOOLS_ATTRIBUTES },
      ]
    }
  ],
  'Alimentos y Bebidas': [
    {
      id: 'Despensa',
      label: 'Despensa y Abarrotes',
      subcategories: [
        { id: 'Arroz y Granos', label: 'Arroz, Frijol y Semillas', attributes: FOOD_ATTRIBUTES },
        { id: 'Pastas', label: 'Pastas y Salsas para Pasta', attributes: FOOD_ATTRIBUTES },
        { id: 'Enlatados', label: 'Enlatados y Conservas', attributes: FOOD_ATTRIBUTES },
        { id: 'Aceites', label: 'Aceites y Vinagres', attributes: FOOD_ATTRIBUTES },
        { id: 'Especias', label: 'Especias y Condimentos', attributes: FOOD_ATTRIBUTES },
        { id: 'Harinas', label: 'Harinas y Repostería', attributes: FOOD_ATTRIBUTES },
        { id: 'Sopas', label: 'Sopas, Cremas y Purés', attributes: FOOD_ATTRIBUTES },
        { id: 'Instantaneos', label: 'Comida Instantánea', attributes: FOOD_ATTRIBUTES },
        { id: 'Salsas', label: 'Salsas, Chiles y Moles', attributes: FOOD_ATTRIBUTES },
        { id: 'Untables', label: 'Mermeladas, Miel y Untables', attributes: FOOD_ATTRIBUTES },
        { id: 'Aderezos', label: 'Mayonesas y Aderezos', attributes: FOOD_ATTRIBUTES },
      ]
    },
    {
      id: 'Desayuno',
      label: 'Desayuno y Panadería',
      subcategories: [
        { id: 'Cereales', label: 'Cereales y Barras', attributes: FOOD_ATTRIBUTES },
        { id: 'Panaderia', label: 'Panadería y Galletas', attributes: FOOD_ATTRIBUTES },
        { id: 'Untables', label: 'Untables (Mermeladas, Cremas)', attributes: FOOD_ATTRIBUTES },
      ]
    },
    {
      id: 'Bebidas',
      label: 'Bebidas (Sin Alcohol)',
      subcategories: [
        { id: 'Aguas', label: 'Aguas y Refrescos', attributes: DRINK_ATTRIBUTES },
        { id: 'Jugos', label: 'Jugos y Néctares', attributes: DRINK_ATTRIBUTES },
        { id: 'Cafe y Te', label: 'Café y Té', attributes: FOOD_ATTRIBUTES },
        { id: 'Energizantes', label: 'Energizantes e Isotónicos', attributes: DRINK_ATTRIBUTES },
      ]
    },
    {
      id: 'Vinos y Licores',
      label: 'Vinos, Licores y Cervezas',
      subcategories: [
        { id: 'Tequila y Mezcal', label: 'Tequila y Mezcal', attributes: DRINK_ATTRIBUTES },
        { id: 'Cervezas', label: 'Cervezas (Artesanales y Comerciales)', attributes: DRINK_ATTRIBUTES },
        { id: 'Vinos', label: 'Vinos (Tinto, Blanco, Rosado)', attributes: DRINK_ATTRIBUTES },
        { id: 'Whisky y Vodka', label: 'Whisky, Vodka y Ginebra', attributes: DRINK_ATTRIBUTES },
        { id: 'Ron y Brandy', label: 'Ron, Brandy y Cognac', attributes: DRINK_ATTRIBUTES },
        { id: 'Licores y Cremas', label: 'Licores, Cremas y Digestivos', attributes: DRINK_ATTRIBUTES },
        { id: 'Mixers', label: 'Mixers y Coctelería', attributes: DRINK_ATTRIBUTES },
      ]
    },
    {
      id: 'Snacks',
      label: 'Snacks y Dulces',
      subcategories: [
        { id: 'Botanas', label: 'Botanas Saladas (Papas, Frituras)', attributes: FOOD_ATTRIBUTES },
        { id: 'Dulces', label: 'Dulces y Golosinas', attributes: FOOD_ATTRIBUTES },
        { id: 'Chocolates', label: 'Chocolates y Bombones', attributes: FOOD_ATTRIBUTES },
        { id: 'Galletas', label: 'Galletas y Barquillos', attributes: FOOD_ATTRIBUTES },
        { id: 'Frutos Secos', label: 'Frutos Secos y Semillas', attributes: FOOD_ATTRIBUTES },
        { id: 'Palomitas', label: 'Palomitas de Maíz', attributes: FOOD_ATTRIBUTES },
        { id: 'Gomitas', label: 'Gomitas y Masmelos', attributes: FOOD_ATTRIBUTES },
        { id: 'Chicles', label: 'Chicles y Pastillas', attributes: FOOD_ATTRIBUTES },
        { id: 'Snacks Saludables', label: 'Snacks Saludables', attributes: FOOD_ATTRIBUTES },
        { id: 'Dulces Tipicos', label: 'Dulces Típicos Mexicanos', attributes: FOOD_ATTRIBUTES },
      ]
    },
    {
      id: 'Saludable',
      label: 'Mundo Saludable',
      subcategories: [
        { id: 'Organico', label: 'Orgánico y Superfoods', attributes: FOOD_ATTRIBUTES },
        { id: 'Sin Gluten', label: 'Sin Gluten (Gluten Free)', attributes: FOOD_ATTRIBUTES },
        { id: 'Keto', label: 'Keto y Low Carb', attributes: FOOD_ATTRIBUTES },
        { id: 'Vegano', label: 'Vegano y Plant-Based', attributes: FOOD_ATTRIBUTES },
      ]
    }
  ],
  'Otros': [
    {
      id: 'Adultos',
      label: 'Adultos (+18 / Bienestar Sexual)',
      subcategories: [
        { id: 'Juguetes', label: 'Juguetes Eróticos', attributes: GENERIC_ATTRIBUTES },
        { id: 'Lenceria', label: 'Lencería Erótica y Disfraces', attributes: CLOTHING_ATTRIBUTES },
        { id: 'Lubricantes', label: 'Lubricantes y Aceites', attributes: GENERIC_ATTRIBUTES },
        { id: 'Fetiche', label: 'Fetiche y Bondage', attributes: GENERIC_ATTRIBUTES },
      ]
    },
    {
      id: 'Restringidos',
      label: 'Exclusivos Tiendas Oficiales',
      subcategories: [
        { id: 'Guias', label: 'Guías Prepagadas', attributes: GENERIC_ATTRIBUTES, restricted: true },
        { id: 'Software', label: 'Software y Licencias', attributes: GENERIC_ATTRIBUTES, restricted: true },
        { id: 'Suscripciones', label: 'Suscripciones Digitales', attributes: GENERIC_ATTRIBUTES, restricted: true },
      ]
    }
  ]
};

export function generateTags(gender: string, category: string, subcategory: string | null, attributes: Record<string, any>): string[] {
  const tags = new Set<string>();
  
  if (gender) tags.add(gender);
  if (category) tags.add(category);
  if (subcategory) tags.add(subcategory);
  
  // Semantic mapping for Winter
  const winterCategories = ['Sudaderas', 'Chamarras', 'Abrigos', 'Sueteres', 'Botas', 'Beanies', 'Cobijas', 'Cobertores', 'Gorras de lana'];
  if (winterCategories.some(c => category.includes(c) || (subcategory && subcategory.includes(c)))) {
    tags.add('Ropa de invierno');
    tags.add('Invierno');
    tags.add('Frio');
  }

  // Attributes to tags
  Object.entries(attributes).forEach(([key, value]) => {
    if (value && typeof value === 'string') {
      // Exclude long descriptions or irrelevant values
      if (value.length < 20) {
        tags.add(value);
      }
    }
  });

  return Array.from(tags);
}

// Helper to get all root categories (Departments)
export const ROOT_CATEGORIES = Object.keys(NEW_CATEGORIES_CONFIG);

// Helper to check if a root category is Fashion/Clothing related
export const IS_FASHION_ROOT = (root: string) => ['Mujer', 'Hombre', 'Niños, Niñas y Bebés', 'Accesorios de Moda', 'Ropa Especializada / Otros'].includes(root);
