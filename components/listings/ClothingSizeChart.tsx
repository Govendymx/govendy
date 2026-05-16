'use client';

import { useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ClothingType =
    | 'tops'
    | 'pants'
    | 'shorts'
    | 'dresses'
    | 'outerwear'
    | 'underwear_boxer'
    | 'underwear_bra'
    | 'footwear'
    | 'activewear'
    | 'kids_tops'
    | 'kids_pants'
    | 'skirts'
    | 'baby_panalero'
    | 'baby_mameluco'
    | 'babies'; // fallback

interface SizeRow {
    size: string;
    measurements: Record<string, string>;
}

interface ChartConfig {
    title: string;
    measurementKeys: { key: string; label: string }[];
    sizes: SizeRow[];
    diagramType: ClothingType;
}

// ─── Default Size Data ────────────────────────────────────────────────────────

const TOPS_CHART: ChartConfig = {
    title: 'Prendas Superiores',
    diagramType: 'tops',
    measurementKeys: [
        { key: 'hombro', label: 'Hombro a Hombro' },
        { key: 'pecho', label: 'Contorno de Pecho' },
        { key: 'manga', label: 'Largo de Manga' },
        { key: 'largo', label: 'Largo Total' },
    ],
    sizes: [
        { size: 'XS', measurements: { hombro: '35', pecho: '80–84', manga: '58', largo: '58' } },
        { size: 'S', measurements: { hombro: '36', pecho: '84–88', manga: '59', largo: '60' } },
        { size: 'M', measurements: { hombro: '37', pecho: '88–92', manga: '60', largo: '62' } },
        { size: 'L', measurements: { hombro: '38', pecho: '92–96', manga: '61', largo: '64' } },
        { size: 'XL', measurements: { hombro: '39', pecho: '96–100', manga: '62', largo: '66' } },
    ],
};

const PANTS_CHART: ChartConfig = {
    title: 'Pantalones y Jeans',
    diagramType: 'pants',
    measurementKeys: [
        { key: 'cintura', label: 'Contorno de Cintura' },
        { key: 'cadera', label: 'Contorno de Cadera' },
        { key: 'tiro', label: 'Tiro Frontal' },
        { key: 'entrepierna', label: 'Entrepierna' },
        { key: 'muslo', label: 'Muslo' },
    ],
    sizes: [
        { size: '24', measurements: { cintura: '60–64', cadera: '84–88', tiro: '26', entrepierna: '70', muslo: '52' } },
        { size: '26', measurements: { cintura: '64–68', cadera: '88–92', tiro: '27', entrepierna: '72', muslo: '54' } },
        { size: '28', measurements: { cintura: '68–72', cadera: '92–96', tiro: '28', entrepierna: '74', muslo: '56' } },
        { size: '30', measurements: { cintura: '72–76', cadera: '96–100', tiro: '29', entrepierna: '76', muslo: '58' } },
    ],
};

const SHORTS_CHART: ChartConfig = {
    title: 'Shorts y Bermudas',
    diagramType: 'shorts',
    measurementKeys: [
        { key: 'cintura', label: 'Contorno de Cintura' },
        { key: 'cadera', label: 'Contorno de Cadera' },
        { key: 'tiro', label: 'Tiro Frontal' },
        { key: 'entrepierna', label: 'Entrepierna' },
        { key: 'muslo', label: 'Muslo' },
    ],
    sizes: [
        { size: 'S', measurements: { cintura: '64', cadera: '88', tiro: '24', entrepierna: '15', muslo: '50' } },
        { size: 'M', measurements: { cintura: '68', cadera: '92', tiro: '25', entrepierna: '16', muslo: '52' } },
    ],
};

const DRESSES_CHART: ChartConfig = {
    title: 'Vestidos',
    diagramType: 'dresses',
    measurementKeys: [
        { key: 'pecho', label: 'Contorno de Pecho' },
        { key: 'cintura', label: 'Contorno de Cintura' },
        { key: 'cadera', label: 'Contorno de Cadera' },
        { key: 'largo', label: 'Largo Total' },
    ],
    sizes: [
        { size: 'XS', measurements: { pecho: '80–84', cintura: '60–64', cadera: '84–88', largo: '90' } },
        { size: 'S', measurements: { pecho: '84–88', cintura: '64–68', cadera: '88–92', largo: '93' } },
        { size: 'M', measurements: { pecho: '88–92', cintura: '68–72', cadera: '92–96', largo: '96' } },
    ],
};

const SKIRTS_CHART: ChartConfig = {
    title: 'Faldas',
    diagramType: 'skirts',
    measurementKeys: [
        { key: 'cintura', label: 'Contorno de Cintura' },
        { key: 'cadera', label: 'Contorno de Cadera' },
        { key: 'largo', label: 'Largo Total' },
    ],
    sizes: [
        { size: 'S', measurements: { cintura: '64', cadera: '90', largo: '45' } },
        { size: 'M', measurements: { cintura: '68', cadera: '94', largo: '47' } },
        { size: 'L', measurements: { cintura: '72', cadera: '98', largo: '49' } },
    ],
};

const OUTERWEAR_CHART: ChartConfig = {
    title: 'Ropa de Abrigo',
    diagramType: 'outerwear',
    measurementKeys: [
        { key: 'hombro', label: 'Hombros (Costura a costura)' },
        { key: 'pecho', label: 'Pecho/Busto (Axila a axila)' },
        { key: 'manga', label: 'Largo Manga (Hombro al puño)' },
        { key: 'largo', label: 'Largo Total' },
    ],
    sizes: [
        { size: 'S', measurements: { hombro: '40', pecho: '90', manga: '62', largo: '68' } },
        { size: 'M', measurements: { hombro: '42', pecho: '94', manga: '63', largo: '70' } },
    ],
};

const FOOTWEAR_CHART: ChartConfig = {
    title: 'Calzado',
    diagramType: 'footwear',
    measurementKeys: [
        { key: 'plantilla', label: 'Largo de Plantilla' },
        { key: 'ancho', label: 'Ancho de Pie (opcional)' },
        { key: 'mx', label: 'Talla MX (cm)' },
    ],
    sizes: [
        { size: '24', measurements: { plantilla: '24.5', ancho: '9.2', mx: '24' } },
        { size: '25', measurements: { plantilla: '25.5', ancho: '9.5', mx: '25' } },
    ],
};

const UNDERWEAR_BOXER_CHART: ChartConfig = {
    title: 'Ropa Interior (Boxers/Trusas)',
    diagramType: 'underwear_boxer',
    measurementKeys: [
        { key: 'cintura_elastica', label: 'Cintura Elástica (Rango)' },
        { key: 'cadera', label: 'Contorno de Cadera' },
    ],
    sizes: [
        { size: 'S', measurements: { cintura_elastica: '60–80', cadera: '86-90' } },
        { size: 'M', measurements: { cintura_elastica: '64–84', cadera: '90-94' } },
    ],
};

const UNDERWEAR_BRA_CHART: ChartConfig = {
    title: 'Ropa Interior (Bra/Bralettes)',
    diagramType: 'underwear_bra',
    measurementKeys: [
        { key: 'copa_banda', label: 'Copa/Banda' },
        { key: 'pecho', label: 'Pecho/Busto' },
    ],
    sizes: [
        { size: '32B', measurements: { copa_banda: '70-75', pecho: '80-84' } },
        { size: '34B', measurements: { copa_banda: '75-80', pecho: '84-88' } },
    ],
};
const KIDS_TOPS_CHART: ChartConfig = {
    title: 'Niños (Prendas Superiores)',
    diagramType: 'kids_tops',
    measurementKeys: [
        { key: 'estatura', label: 'Estatura Niño (Altura total)' },
        { key: 'pecho', label: 'Pecho/Busto' },
        { key: 'largo', label: 'Largo Total' },
    ],
    sizes: [
        { size: '6', measurements: { estatura: '110–116', pecho: '60', largo: '45' } },
        { size: '8', measurements: { estatura: '122–128', pecho: '64', largo: '50' } },
    ],
};

const KIDS_PANTS_CHART: ChartConfig = {
    title: 'Niños (Pantalones)',
    diagramType: 'kids_pants',
    measurementKeys: [
        { key: 'estatura', label: 'Estatura Niño' },
        { key: 'cintura_ajustable', label: 'Cintura Ajustable' },
        { key: 'largo', label: 'Largo de la Prenda' },
    ],
    sizes: [
        { size: '6', measurements: { estatura: '110–116', cintura_ajustable: '50-58', largo: '65' } },
        { size: '8', measurements: { estatura: '122–128', cintura_ajustable: '54-62', largo: '75' } },
    ],
};

const BABY_PANALERO_CHART: ChartConfig = {
    title: 'Bebé (Pañaleros/Bodies)',
    diagramType: 'baby_panalero',
    measurementKeys: [
        { key: 'peso', label: 'Peso (Báscula)' },
        { key: 'altura', label: 'Estatura del Bebé' },
        { key: 'tiro_panalero', label: 'Tiro Pañalero (Hombro a broches)' },
    ],
    sizes: [
        { size: '3m', measurements: { peso: '4-6 kg', altura: '55-61', tiro_panalero: '32' } },
        { size: '6m', measurements: { peso: '6-8 kg', altura: '61-67', tiro_panalero: '35' } },
    ],
};

const BABY_MAMELUCO_CHART: ChartConfig = {
    title: 'Bebé (Mamelucos/Ropa)',
    diagramType: 'baby_mameluco',
    measurementKeys: [
        { key: 'peso', label: 'Peso (Báscula)' },
        { key: 'altura', label: 'Estatura del Bebé' },
        { key: 'pecho', label: 'Pecho/Busto' },
        { key: 'largo', label: 'Largo Total' },
    ],
    sizes: [
        { size: '3m', measurements: { peso: '4-6 kg', altura: '55-61', pecho: '22', largo: '50' } },
        { size: '6m', measurements: { peso: '6-8 kg', altura: '61-67', pecho: '24', largo: '58' } },
    ],
};

// ─── Category Detection ────────────────────────────────────────────────────────

function normalize(str: string): string {
    return (str || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export function detectClothingType(
    category: string | null | undefined,
    subcategory?: string | null,
    mlCategoryId?: string | null
): ClothingType | null {
    const s = normalize(subcategory || '');
    const c = normalize(category || '');
    const full = `${c} ${s}`;

    // 0. ML Category ID Mapping (High Precision)
    if (mlCategoryId) {
        // Footwear (MLM1276)
        if (mlCategoryId === 'MLM1276' || mlCategoryId.startsWith('MLM1276')) return 'footwear';
        // Dresses (MLM5159)
        if (mlCategoryId === 'MLM5159') return 'dresses';
        // Pants (MLM1601)
        if (mlCategoryId === 'MLM1601') return 'pants';
        // Shirts/T-shirts/Blouses
        if (['MLM1574', 'MLM1575', 'MLM1430'].includes(mlCategoryId)) return 'tops';
        // Jackets/Coats
        if (['MLM414251', 'MLM27038'].includes(mlCategoryId)) return 'outerwear';
    }

    // 1. Footwear
    if (
        full.includes('calzado') || full.includes('tenis') || full.includes('zapato') ||
        full.includes('bota') || full.includes('sandalia') || full.includes('tacon') ||
        full.includes('flat') || full.includes('zapatilla') || full.includes('sneaker') ||
        full.includes('calzados') || full.includes('botine') || full.includes('chancla') ||
        full.includes('alpargata') || full.includes('deportivo') || full.includes('pantufla')
    ) return 'footwear';

    // 2. Babies & Kids
    if (full.includes('bebe') || full.includes('meses') || full.includes('panalero') || full.includes('mameluco')) {
        if (full.includes('panalero') || full.includes('body')) return 'baby_panalero';
        return 'baby_mameluco';
    }
    if (full.includes('nino') || full.includes('nina') || full.includes('juvenil') || full.includes('infantil')) {
        if (full.includes('pantalon') || full.includes('short') || full.includes('pants')) return 'kids_pants';
        return 'kids_tops';
    }

    // 3. Underwear & Lingerie
    if (full.includes('lenceria') || full.includes('interior') || full.includes('bralet') || full.includes('calzon') || full.includes('fondo') || full.includes('corset')) {
        if (full.includes('boxer') || full.includes('trusa') || full.includes('calzon')) return 'underwear_boxer';
        if (full.includes('bra') || full.includes('brasiere') || full.includes('top')) return 'underwear_bra';
        return 'underwear_boxer';
    }

    // 4. Specific Garments
    if (full.includes('vestido') || full.includes('maxidress') || full.includes('jumper')) return 'dresses';
    if (full.includes('falda') || full.includes('minifalda')) return 'skirts';
    if (full.includes('short') || full.includes('bermuda') || full.includes('ciclista')) return 'shorts';

    if (
        full.includes('pantalon') || full.includes('jean') || full.includes('overol') ||
        full.includes('legging') || full.includes('pants') || full.includes('denim') ||
        full.includes('pescador') || full.includes('capri') || full.includes('malla')
    ) return 'pants';

    if (
        full.includes('chamarra') || full.includes('abrigo') || full.includes('sueter') ||
        full.includes('sudadera') || full.includes('saco') || full.includes('chaleco') ||
        full.includes('cardigan') || full.includes('chaqueta') || full.includes('gabardina') ||
        full.includes('blazer') || full.includes('capa') || full.includes('poncho') ||
        full.includes('bomber') || full.includes('parka') || full.includes('impermeable')
    ) return 'outerwear';

    // 5. Tops & General Fallback (Shirts, T-shirts, Blouses)
    if (
        full.includes('blusa') || full.includes('top') || full.includes('playera') ||
        full.includes('camisa') || full.includes('polo') || full.includes('traje') ||
        full.includes('ropa') || full.includes('moda') || full.includes('pijama') ||
        full.includes('deportiva') || full.includes('conjunto') || full.includes('guayabera') ||
        full.includes('camiseta') || full.includes('franela') || full.includes('esqueleto') ||
        full.includes('bodysuit') || full.includes('prenda') || full.includes('textil') ||
        full.includes('vestir') || full.includes('outfit') || full.includes('estilo')
    ) return 'tops';

    // 6. Broad Category Fallbacks (Last Resort)
    if (c.includes('ropa')) return 'tops';
    if (c.includes('calzado') || c.includes('zapatos')) return 'footwear';

    return null;
}

function getChartConfig(type: ClothingType): ChartConfig {
    switch (type) {
        case 'pants': return PANTS_CHART;
        case 'shorts': return SHORTS_CHART;
        case 'dresses': return DRESSES_CHART;
        case 'skirts': return SKIRTS_CHART;
        case 'outerwear': return OUTERWEAR_CHART;
        case 'footwear': return FOOTWEAR_CHART;
        case 'underwear_boxer': return UNDERWEAR_BOXER_CHART;
        case 'underwear_bra': return UNDERWEAR_BRA_CHART;
        case 'kids_tops': return KIDS_TOPS_CHART;
        case 'kids_pants': return KIDS_PANTS_CHART;
        case 'baby_panalero': return BABY_PANALERO_CHART;
        case 'baby_mameluco': return BABY_MAMELUCO_CHART;
        case 'babies': return BABY_MAMELUCO_CHART;
        case 'activewear':
        case 'tops':
        default: return TOPS_CHART;
    }
}

// ─── Clean SVG Diagrams ───────────────────────────────────────────────────────
// Strategy: numbers in labeled callouts on the SIDE, never overlapping body lines.
// Colors: body = gray-200, measurement lines = pink (#e3127d)

const PINK = '#e3127d';
const PURPLE = '#7c3aed';
const BODY_FILL = '#f1f5f9';
const BODY_STROKE = '#cbd5e1';

function Callout({ x, y, n, color = PINK }: { x: number; y: number; n: number; color?: string }) {
    return (
        <g>
            <circle cx={x} cy={y} r={8} fill={color} />
            <text x={x} y={y + 3.5} fontSize="9" fontWeight="800" fill="white" textAnchor="middle">{n}</text>
        </g>
    );
}

function MeasLine({ x1, y1, x2, y2, dashed = true }: { x1: number; y1: number; x2: number; y2: number; dashed?: boolean }) {
    return (
        <line
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={PINK} strokeWidth="1.5"
            strokeDasharray={dashed ? '5 3' : undefined}
        />
    );
}

function Arrow({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
    // vertical double-headed arrow
    return (
        <g>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PURPLE} strokeWidth="1.5" />
            <line x1={x1 - 4} y1={y1} x2={x1 + 4} y2={y1} stroke={PURPLE} strokeWidth="1.5" />
            <line x1={x2 - 4} y1={y2} x2={x2 + 4} y2={y2} stroke={PURPLE} strokeWidth="1.5" />
        </g>
    );
}

function TopsDiagram() {
    return (
        <svg viewBox="0 0 200 260" className="w-full max-w-[170px]" aria-label="Diagrama tops">
            <ellipse cx="100" cy="28" rx="18" ry="22" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M68 76 Q68 56 100 54 Q132 56 132 76 L130 170 L70 170 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M68 76 Q54 78 44 130 Q52 133 56 132 Q58 110 70 100" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M132 76 Q146 78 156 130 Q148 133 144 132 Q142 110 130 100" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />

            {/* ④ Hombros */}
            <MeasLine x1={68} y1={76} x2={132} y2={76} />
            <Callout x={22} y={76} n={4} />

            {/* ① Pecho/Busto */}
            <MeasLine x1={68} y1={102} x2={132} y2={102} />
            <Callout x={22} y={102} n={1} />

            {/* ⑤ Largo Manga */}
            <MeasLine x1={132} y1={76} x2={156} y2={130} dashed />
            <Callout x={178} y={103} n={5} />

            {/* ⑥ Largo Total */}
            <Arrow x1={158} y1={76} x2={158} y2={170} />
            <Callout x={178} y={163} n={6} color={PURPLE} />

            <text x="100" y="252" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}

function PantsDiagram() {
    return (
        <svg viewBox="0 0 200 290" className="w-full max-w-[170px]" aria-label="Diagrama pantalones">
            <rect x="58" y="28" width="84" height="14" rx="3" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M58 42 L54 240 L92 240 Q100 135 108 240 L146 240 L142 42 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" strokeLinejoin="round" />

            {/* ② Contorno de Cintura */}
            <MeasLine x1={58} y1={35} x2={142} y2={35} />
            <Callout x={22} y={35} n={2} />
            <line x1={30} y1={35} x2={58} y2={35} stroke={PINK} strokeWidth="1" strokeDasharray="3 3" />

            {/* ③ Contorno de Cadera */}
            <MeasLine x1={58} y1={80} x2={142} y2={80} />
            <Callout x={22} y={80} n={3} />
            <line x1={30} y1={80} x2={58} y2={80} stroke={PINK} strokeWidth="1" strokeDasharray="3 3" />

            {/* Tiro Frontal */}
            <Arrow x1={100} y1={35} x2={100} y2={145} />
            <text x="120" y="90" fontSize="8" fill={PURPLE} fontWeight="bold">Tiro</text>

            <text x="100" y="280" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}

function ShortsDiagram() {
    return (
        <svg viewBox="0 0 200 240" className="w-full max-w-[170px]" aria-label="Diagrama shorts">
            <rect x="58" y="28" width="84" height="14" rx="3" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M58 42 L52 140 L92 140 Q100 100 108 140 L148 140 L142 42 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" strokeLinejoin="round" />

            {/* ② Contorno de Cintura */}
            <MeasLine x1={58} y1={35} x2={142} y2={35} />
            <Callout x={22} y={35} n={2} />

            {/* ③ Contorno de Cadera */}
            <MeasLine x1={58} y1={75} x2={142} y2={75} />
            <Callout x={22} y={75} n={3} />

            <text x="100" y="230" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}

function DressDiagram() {
    return (
        <svg viewBox="0 0 200 290" className="w-full max-w-[170px]" aria-label="Diagrama vestidos">
            {/* Silueta Vestido */}
            <path d="M68 58 Q100 55 132 58 L145 250 L55 250 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />

            {/* ① Pecho/Busto */}
            <MeasLine x1={68} y1={90} x2={132} y2={90} />
            <Callout x={22} y={90} n={1} />

            {/* ② Cintura */}
            <MeasLine x1={72} y1={130} x2={128} y2={130} />
            <Callout x={22} y={130} n={2} />

            {/* ③ Cadera */}
            <MeasLine x1={75} y1={170} x2={125} y2={170} />
            <Callout x={22} y={170} n={3} />

            {/* ⑥ Largo Total */}
            <Arrow x1={162} y1={58} x2={162} y2={250} />
            <Callout x={178} y={154} n={6} color={PURPLE} />

            <text x="100" y="275" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}

function SkirtDiagram() {
    return (
        <svg viewBox="0 0 200 290" className="w-full max-w-[170px]" aria-label="Diagrama faldas">
            {/* Silueta Falda */}
            <path d="M65 40 L135 40 L155 250 L45 250 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />

            {/* ② Cintura */}
            <MeasLine x1={65} y1={40} x2={135} y2={40} />
            <Callout x={22} y={40} n={2} />

            {/* ③ Cadera */}
            <MeasLine x1={75} y1={100} x2={125} y2={100} />
            <Callout x={22} y={100} n={3} />

            {/* ⑥ Largo Total */}
            <Arrow x1={170} y1={40} x2={170} y2={250} />
            <Callout x={185} y={145} n={6} color={PURPLE} />

            <text x="100" y="275" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}

function FootwearDiagram() {
    return (
        <svg viewBox="0 0 220 170" className="w-full max-w-[200px]" aria-label="Diagrama calzado">
            <path
                d="M30 50 C30 28 52 18 78 18 C100 18 118 22 132 34 C148 46 172 54 182 68 C192 82 188 118 174 128 C160 138 28 138 22 116 C12 94 24 68 30 50 Z"
                fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="2"
            />
            {/* ① Largo de Plantilla */}
            <line x1="22" y1="152" x2="174" y2="152" stroke={PINK} strokeWidth="2" />
            <polygon points="174,149 180,152 174,155" fill={PINK} />
            <polygon points="22,149 16,152 22,155" fill={PINK} />
            <Callout x={98} y={152} n={7} />

            {/* ② Ancho de Pie */}
            <line x1="186" y1="68" x2="186" y2="128" stroke={PURPLE} strokeWidth="1.5" />
            <line x1="182" y1="68" x2="190" y2="68" stroke={PURPLE} strokeWidth="1.5" />
            <line x1="182" y1="128" x2="190" y2="128" stroke={PURPLE} strokeWidth="1.5" />
            <Callout x={205} y={98} n={8} color={PURPLE} />

            <text x="110" y="165" fontSize="7" fill="#94a3b8" textAnchor="middle">Mide desde el talón hasta el dedo más largo.</text>
        </svg>
    );
}

function KidsTopsDiagram() {
    return (
        <svg viewBox="0 0 200 280" className="w-full max-w-[170px]" aria-label="Diagrama kids tops">
            <ellipse cx="100" cy="30" rx="21" ry="25" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M72 76 Q100 74 128 76 L126 162 L74 162 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />

            {/* ① Estatura Niño */}
            <Arrow x1={42} y1={5} x2={42} y2={242} />
            <Callout x={22} y={124} n={11} color={PURPLE} />

            {/* ② Pecho/Busto */}
            <MeasLine x1={72} y1={100} x2={128} y2={100} />
            <Callout x={155} y={100} n={1} />

            {/* ③ Largo Total */}
            <Arrow x1={145} y1={76} x2={145} y2={162} />
            <Callout x={165} y={119} n={6} color={PURPLE} />

            <text x="100" y="274" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}

function KidsPantsDiagram() {
    return (
        <svg viewBox="0 0 200 280" className="w-full max-w-[170px]" aria-label="Diagrama kids pants">
            <rect x="70" y="70" width="60" height="15" rx="3" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M70 85 L64 235 L92 235 Q100 145 108 235 L136 235 L130 85 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" strokeLinejoin="round" />

            {/* ① Estatura Niño */}
            <Arrow x1={42} y1={70} x2={42} y2={230} />
            <Callout x={22} y={150} n={11} color={PURPLE} />

            {/* ② Cintura Ajustable */}
            <MeasLine x1={70} y1={78} x2={130} y2={78} />
            <Callout x={155} y={78} n={12} />

            {/* ③ Largo Prenda */}
            <Arrow x1={150} y1={70} x2={150} y2={230} />
            <Callout x={170} y={150} n={6} color={PURPLE} />

            <text x="100" y="274" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}

function BabyPanaleroDiagram() {
    return (
        <svg viewBox="0 0 200 260" className="w-full max-w-[170px]" aria-label="Diagrama pañalero">
            <ellipse cx="100" cy="22" rx="14" ry="18" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M75 55 Q100 50 125 55 L132 140 Q100 165 68 140 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />

            {/* ① Peso (Báscula) */}
            <rect x="25" y="20" width="35" height="25" rx="4" fill="white" stroke={PINK} strokeWidth="1" />
            <text x="42.5" y="38" fontSize="10" fill={PINK} textAnchor="middle" fontWeight="bold">kg</text>
            <Callout x={42.5} y={15} n={13} />

            {/* ② Estatura */}
            <Arrow x1={50} y1={5} x2={50} y2={160} />
            <Callout x={30} y={90} n={11} color={PURPLE} />

            {/* ③ Tiro Pañalero */}
            <Arrow x1={100} y1={55} x2={100} y2={155} />
            <Callout x={125} y={105} n={14} color={PURPLE} />

            <text x="100" y="250" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}

function BabyMamelucoDiagram() {
    return (
        <svg viewBox="0 0 200 280" className="w-full max-w-[170px]" aria-label="Diagrama mameluco">
            <ellipse cx="100" cy="22" rx="14" ry="18" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M75 55 Q100 50 125 55 L132 245 L108 245 Q100 160 92 245 L68 245 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" strokeLinejoin="round" />

            {/* ① Peso (Báscula) */}
            <rect x="25" y="20" width="35" height="25" rx="4" fill="white" stroke={PINK} strokeWidth="1" />
            <text x="42.5" y="38" fontSize="10" fill={PINK} textAnchor="middle" fontWeight="bold">kg</text>
            <Callout x={42.5} y={15} n={13} />

            {/* ② Estatura */}
            <Arrow x1={50} y1={5} x2={50} y2={240} />
            <Callout x={30} y={130} n={11} color={PURPLE} />

            {/* ③ Pecho */}
            <MeasLine x1={75} y1={100} x2={125} y2={100} />
            <Callout x={145} y={100} n={1} />

            {/* ④ Largo */}
            <Arrow x1={140} y1={55} x2={140} y2={240} />
            <Callout x={160} y={145} n={6} color={PURPLE} />

            <text x="100" y="270" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}

function UnderwearBoxerDiagram() {
    return (
        <svg viewBox="0 0 200 180" className="w-full max-w-[170px]" aria-label="Diagrama boxer">
            <path d="M60 40 L140 40 L140 120 L105 120 L100 100 L95 120 L60 120 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />

            {/* ① Cintura Elástica */}
            <MeasLine x1={60} y1={48} x2={140} y2={48} />
            <Callout x={22} y={48} n={9} />

            {/* ② Cadera */}
            <MeasLine x1={60} y1={85} x2={140} y2={85} />
            <Callout x={22} y={85} n={3} />

            <text x="100" y="170" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}

function UnderwearBraDiagram() {
    return (
        <svg viewBox="0 0 200 180" className="w-full max-w-[170px]" aria-label="Diagrama bra">
            <path d="M70 50 Q100 45 130 50 L125 100 Q100 110 75 100 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />

            {/* ① Copa/Banda */}
            <MeasLine x1={70} y1={75} x2={130} y2={75} />
            <Callout x={22} y={75} n={10} />

            {/* ② Pecho/Busto */}
            <MeasLine x1={65} y1={45} x2={135} y2={45} dashed />
            <Callout x={160} y={45} n={1} />

            <text x="100" y="170" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}

function OuterwearDiagram() {
    return (
        <svg viewBox="0 0 200 260" className="w-full max-w-[170px]" aria-label="Diagrama abrigo">
            <ellipse cx="100" cy="28" rx="18" ry="22" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M68 76 Q100 70 132 76 L135 180 L65 180 Z" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M68 76 Q50 80 40 140 Q52 145 58 142 Q60 110 70 100" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <path d="M132 76 Q150 80 160 140 Q148 145 142 142 Q140 110 130 100" fill={BODY_FILL} stroke={BODY_STROKE} strokeWidth="1.5" />
            <line x1="100" y1="76" x2="100" y2="180" stroke={BODY_STROKE} strokeWidth="1" />

            {/* ④ Hombros */}
            <MeasLine x1={68} y1={76} x2={132} y2={76} />
            <Callout x={22} y={76} n={4} />

            {/* ① Pecho/Busto */}
            <MeasLine x1={65} y1={110} x2={135} y2={110} />
            <Callout x={22} y={110} n={1} />

            {/* ⑤ Largo Manga */}
            <MeasLine x1={132} y1={76} x2={160} y2={140} dashed />
            <Callout x={180} y={108} n={5} />

            {/* ⑥ Largo Total */}
            <Arrow x1={160} y1={76} x2={160} y2={180} />
            <Callout x={180} y={170} n={6} color={PURPLE} />

            <text x="100" y="252" fontSize="7" fill="#94a3b8" textAnchor="middle">Medidas en cm</text>
        </svg>
    );
}
export function DiagramForType({ type }: { type: ClothingType }) {
    if (type === 'pants') return <PantsDiagram />;
    if (type === 'shorts') return <ShortsDiagram />;
    if (type === 'dresses') return <DressDiagram />;
    if (type === 'skirts') return <SkirtDiagram />;
    if (type === 'footwear') return <FootwearDiagram />;
    if (type === 'kids_tops') return <KidsTopsDiagram />;
    if (type === 'kids_pants') return <KidsPantsDiagram />;
    if (type === 'baby_panalero') return <BabyPanaleroDiagram />;
    if (type === 'baby_mameluco' || type === 'babies') return <BabyMamelucoDiagram />;
    if (type === 'outerwear') return <OuterwearDiagram />;
    if (type === 'underwear_boxer') return <UnderwearBoxerDiagram />;
    if (type === 'underwear_bra') return <UnderwearBraDiagram />;
    return <TopsDiagram />;
}

// ─── Legend ───────────────────────────────────────────────────────────────────

const NON_UNIT_KEYS = new Set(['edad', 'peso', 'mx', 'usa_w', 'usa_m', 'eur', 'uk', 'pie_cm']);

function unitSuffix(key: string, unit: 'cm' | 'in') {
    if (NON_UNIT_KEYS.has(key)) return '';
    return unit === 'cm' ? ' cm' : '"';
}

function convertVal(val: string, unit: 'cm' | 'in'): string {
    if (unit === 'cm') return val;
    return val.replace(/(\d+(?:\.\d+)?)/g, (m) => (Number(m) / 2.54).toFixed(1));
}

// ─── Public size-chart viewer ─────────────────────────────────────────────────

interface ClothingSizeChartProps {
    /** category from the listing */
    category?: string | null;
    /** subcategory from the listing */
    subcategory?: string | null;
    /** ml_category_id from the listing attributes */
    mlCategoryId?: string | null;
    /** gender from the listing */
    gender?: string | null;
    /** custom size chart saved by the seller (from listing.attributes.custom_size_chart) */
    customChart?: CustomSizeChart | null;
}

export interface CustomSizeChart {
    /** optional title override */
    title?: string;
    /** column keys / labels */
    columns: { key: string; label: string }[];
    /** rows: size label + per-column measurement strings */
    rows: { size: string; values: Record<string, string> }[];
}

export function ClothingSizeChart({ category, subcategory, mlCategoryId, gender, customChart }: ClothingSizeChartProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [unit, setUnit] = useState<'cm' | 'in'>('cm');

    const clothingType = detectClothingType(category, subcategory);
    if (!clothingType && !customChart) return null;

    const defaultConfig = clothingType ? getChartConfig(clothingType) : null;

    // If seller provided a custom chart, use it; otherwise fall back to default
    const displayTitle = customChart?.title || defaultConfig?.title || 'Guía de Tallas';

    return (
        <div className="mt-6 overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-sm">
            {/* Header */}
            <button
                type="button"
                onClick={() => setIsOpen((p) => !p)}
                className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-pink-50/50"
            >
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-[#c0005a] shadow-sm">
                        {/* Ruler icon */}
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12h20M12 2v20M2 6h4M2 18h4M18 2v4M6 2v4M18 18v4M6 18v4" />
                            <rect x="2" y="2" width="20" height="20" rx="2" />
                        </svg>
                    </div>
                    <div>
                        <div className="text-sm font-bold text-gray-900">Guía de Tallas y Medidas</div>
                        <div className="text-xs text-gray-500">{displayTitle}</div>
                    </div>
                </div>
                <svg
                    width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`shrink-0 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {isOpen && (
                <div className="border-t border-pink-100/70 px-5 pb-6 pt-5">
                    {/* Unit + intro */}
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">Mide tu cuerpo y compara con la tabla. Siempre mide sobre ropa interior.</p>
                        <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs font-semibold">
                            <button type="button" onClick={() => setUnit('cm')} className={`px-3 py-1.5 transition-colors ${unit === 'cm' ? 'bg-[#e3127d] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>cm</button>
                            <button type="button" onClick={() => setUnit('in')} className={`px-3 py-1.5 transition-colors ${unit === 'in' ? 'bg-[#e3127d] text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>pulgadas</button>
                        </div>
                    </div>

                    {/* Diagram + Table */}
                    <div className="flex flex-col gap-6 md:flex-row md:items-start">
                        {/* Diagram */}
                        {clothingType && (
                            <div className="flex shrink-0 flex-col items-center md:w-44">
                                <div className="flex w-full items-center justify-center rounded-2xl bg-gradient-to-b from-pink-50/60 to-white p-3 ring-1 ring-pink-100">
                                    <DiagramForType type={clothingType} />
                                </div>
                                {/* Legend pills */}
                                {defaultConfig && !customChart && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {defaultConfig.measurementKeys.map((k, i) => (
                                            <span key={k.key} className="flex items-center gap-1 text-[10px] text-gray-600">
                                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#e3127d] text-[8px] font-black text-white">{i + 1}</span>
                                                {k.label}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Table and Tip */}
                        <div className="min-w-0 flex-1 flex flex-col gap-4">
                            <div className="overflow-x-auto rounded-xl ring-1 ring-pink-100">
                                {customChart ? (
                                    // Custom seller table (transposed)
                                    <table className="w-full border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-gradient-to-r from-[#c0005a] via-[#e3127d] to-[#ff4fa0]">
                                                <th className="px-3 py-2.5 text-left font-bold text-white whitespace-nowrap">Medida</th>
                                                {customChart.rows.map((row, idx) => (
                                                    <th key={idx} className="px-3 py-2.5 text-center font-extrabold text-white whitespace-nowrap">{row.size}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {customChart.columns.map((col, idx) => (
                                                <tr key={col.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-pink-50/40'}>
                                                    <td className="px-3 py-2 font-bold text-gray-700 whitespace-nowrap">{col.label}</td>
                                                    {customChart.rows.map((row, rIdx) => (
                                                        <td key={`${col.key}-${rIdx}`} className="px-3 py-2 text-center tabular-nums text-gray-700 whitespace-nowrap">
                                                            {row.values[col.key] ?? '—'} {!NON_UNIT_KEYS.has(col.key) && row.values[col.key] ? unitSuffix(col.key, unit) : ''}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : defaultConfig ? (
                                    // Default generic table (transposed)
                                    <table className="w-full border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-gradient-to-r from-[#c0005a] via-[#e3127d] to-[#ff4fa0]">
                                                <th className="px-3 py-2.5 text-left font-bold text-white whitespace-nowrap">Medida</th>
                                                {defaultConfig.sizes.map((row, idx) => (
                                                    <th key={`${row.size}-${idx}`} className="px-3 py-2.5 text-center font-extrabold text-white whitespace-nowrap">{row.size}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {defaultConfig.measurementKeys.map((k, idx) => (
                                                <tr key={k.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-pink-50/40'}>
                                                    <td className="px-3 py-2 font-bold text-gray-700 whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#e3127d] text-[8px] font-black text-white">{idx + 1}</span>
                                                            {k.label}
                                                        </div>
                                                    </td>
                                                    {defaultConfig.sizes.map((row, rIdx) => (
                                                        <td key={`${k.key}-${rIdx}`} className="px-3 py-2 text-center tabular-nums text-gray-700 whitespace-nowrap">
                                                            {convertVal(row.measurements[k.key] ?? '—', unit)}{unitSuffix(k.key, unit)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : null}
                            </div>

                            {/* Tip box */}
                            <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                                <div className="flex items-start gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-blue-500" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                    <p className="text-xs text-blue-700">
                                        {clothingType === 'footwear'
                                            ? 'Traza tu pie sobre papel y mide desde el talón hasta el dedo más largo.'
                                            : clothingType === 'babies'
                                                ? 'Si el bebé está entre dos tallas, elige la mayor para mayor comodidad.'
                                                : 'Si estás entre dos tallas, elige la mayor. Las medidas son del cuerpo, no de la prenda.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
