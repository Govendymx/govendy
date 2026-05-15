/**
 * T1 Envíos API Service — GoVendy Premium
 * 
 * Handles quoting, label generation, and tracking via T1 API.
 * Credentials are loaded from DB (app_settings.t1_envios_config).
 */

import { getT1ConfigFromDB, getT1AccessToken } from './t1-auth';
import type {
    T1Config,
    T1QuoteRequest,
    T1QuoteResponse,
    T1UnifiedQuote,
    T1CreateLabelWithQuoteRequest,
    T1CreateLabelResponse,
    T1TrackingResponse,
    T1ApiError,
} from './t1-types';

// ─── HTTP Helper ────────────────────────────────────────

async function makeT1Request<T>(
    config: T1Config,
    endpoint: string,
    options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<T> {
    const baseUrl = config.api_url.replace(/\/$/, '');
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${path}`;

    const accessToken = await getT1AccessToken();

    const response = await fetch(url, {
        method: options.method || 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'shop_id': config.shop_id,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let data: any;
    try {
        const text = await response.text();
        data = JSON.parse(text);
    } catch {
        data = {};
    }

    if (!response.ok) {
        const err: T1ApiError = {
            success: false,
            message: data.message || data.error?.message || `Error ${response.status}`,
            error: data.error,
        };
        throw err;
    }

    return data as T;
}

// ─── String Helpers ─────────────────────────────────────

function truncate(str: string, max: number, min = 0): string {
    const trimmed = str.trim();
    if (trimmed.length < min) return trimmed.padEnd(min, 'X').substring(0, max);
    return trimmed.substring(0, max);
}

function cleanPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return digits.padEnd(8, '0').substring(0, 10);
    return digits.substring(0, 10);
}

function parseStreet(street: string): { calle: string; numero: string } {
    const trimmed = street.trim();
    if (trimmed.includes(',')) {
        const parts = trimmed.split(',');
        return { calle: truncate(parts[0].trim(), 35, 3), numero: truncate(parts[1]?.trim() || 'S/N', 15, 1) };
    }
    const m = trimmed.match(/(.+?)\s+(\d+.*)$/);
    if (m) return { calle: truncate(m[1].trim(), 35, 3), numero: truncate(m[2].trim(), 15, 1) };
    return { calle: truncate(trimmed, 35, 3), numero: 'S/N' };
}

function generateEmail(name: string): string {
    const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    return truncate(`${clean}@gopocket.com`, 35, 3);
}

// ─── Get Quotes ─────────────────────────────────────────

export interface QuoteInput {
    origin_zip: string;
    dest_zip: string;
    weight_kg: number;
    length_cm: number;
    width_cm: number;
    height_cm: number;
    package_value?: number;
    seller_plan?: 'basic' | 'pro' | 'platinum';
}

export async function getT1Quotes(input: QuoteInput): Promise<T1UnifiedQuote[]> {
    const config = await getT1ConfigFromDB();
    if (!config.enabled) throw new Error('T1 Envíos no está habilitado');

    const t1Req: T1QuoteRequest = {
        codigo_postal_origen: input.origin_zip,
        codigo_postal_destino: input.dest_zip,
        peso: Math.max(1, Math.ceil(input.weight_kg)),
        largo: Math.max(1, Math.ceil(input.length_cm)),
        ancho: Math.max(1, Math.ceil(input.width_cm)),
        alto: Math.max(1, Math.ceil(input.height_cm)),
        dias_embarque: 1,
        seguro: false,
        valor_paquete: input.package_value || 0,
        tipo_paquete: 2,
        comercio_id: config.shop_id,
        paquetes: 1,
        generar_recoleccion: false,
    };

    const response = await makeT1Request<T1QuoteResponse>(config, '/quote/create', {
        method: 'POST',
        body: t1Req,
    });

    if (!response?.success || !Array.isArray(response.result)) return [];

    // Determine markup based on seller plan
    const markup = input.seller_plan === 'platinum' ? config.markup_platinum
        : input.seller_plan === 'pro' ? config.markup_pro
            : config.markup_basic;

    const quotes: T1UnifiedQuote[] = [];

    for (const result of response.result) {
        if (!result?.clave || !result.cotizacion?.servicios) continue;

        const servicios = result.cotizacion.servicios;
        if (typeof servicios !== 'object' || Array.isArray(servicios)) continue;

        for (const [, service] of Object.entries(servicios)) {
            if (!service || typeof service !== 'object') continue;

            const baseCost = Number(service.costo_total) || 0;
            const totalCost = Math.round((baseCost + markup) * 100) / 100;

            // Friendly carrier names
            const carrierKey = (result.clave || '').toUpperCase();
            const carrierNames: Record<string, string> = {
                'DHL': 'DHL Express',
                'FEDEX': 'FedEx',
                'UPS': 'UPS',
                'PAQUETEXPRESS': 'Paquete Express',
                'EXPRESS': 'Paquete Express',
                '99MIN': '99 Minutos',
                'AMPM': 'AM/PM',
                'JTEXT': 'JT Express',
            };

            quotes.push({
                carrier_name: carrierNames[carrierKey] || result.clave,
                carrier_id: (result.clave || 'unknown').toLowerCase().replace(/\s+/g, '_'),
                service_level: service.tipo_servicio || service.servicio || 'Estándar',
                cost: totalCost,
                base_cost: baseCost,
                markup,
                delivery_days: service.dias_entrega || 0,
                estimated_delivery: service.fecha_mensajeria_entrega || null,
                token: service.token,
            });
        }
    }

    // Sort by cost ascending
    quotes.sort((a, b) => a.cost - b.cost);
    return quotes;
}

// ─── Generate Label ─────────────────────────────────────

export interface LabelInput {
    quote_token: string;
    // Origin (seller)
    origin_name: string;
    origin_email: string;
    origin_phone: string;
    origin_street: string;
    origin_colonia: string;
    origin_city: string;
    origin_state: string;
    origin_zip: string;
    origin_references?: string;
    // Destination (buyer)
    dest_name: string;
    dest_email: string;
    dest_phone: string;
    dest_street: string;
    dest_colonia: string;
    dest_city: string;
    dest_state: string;
    dest_zip: string;
    dest_references?: string;
    // Content
    content_description?: string;
}

export interface LabelResult {
    tracking_number: string;
    label_url: string;
    cost: number;
    order_number: string;
    carrier: string;
}

export async function generateT1Label(input: LabelInput): Promise<LabelResult> {
    const config = await getT1ConfigFromDB();
    if (!config.enabled) throw new Error('T1 Envíos no está habilitado');

    const originNameParts = input.origin_name.trim().split(/\s+/);
    const destNameParts = input.dest_name.trim().split(/\s+/);
    const originStreet = parseStreet(input.origin_street);
    const destStreet = parseStreet(input.dest_street);

    const t1Req: T1CreateLabelWithQuoteRequest = {
        contenido: truncate(input.content_description || 'Paquete GoVendy', 25),
        nombre_origen: truncate(originNameParts[0] || 'Remitente', 25, 3),
        apellidos_origen: truncate(originNameParts.slice(1).join(' ') || 'GoVendy', 25, 3),
        email_origen: truncate(input.origin_email || generateEmail(input.origin_name), 35, 3),
        calle_origen: originStreet.calle,
        numero_origen: originStreet.numero,
        colonia_origen: truncate(input.origin_colonia || input.origin_city, 35, 3),
        telefono_origen: cleanPhone(input.origin_phone),
        estado_origen: truncate(input.origin_state, 35, 3),
        municipio_origen: truncate(input.origin_city, 35, 3),
        referencias_origen: truncate(input.origin_references || input.origin_street, 35, 3),
        nombre_destino: truncate(destNameParts[0] || 'Destinatario', 25, 3),
        apellidos_destino: truncate(destNameParts.slice(1).join(' ') || 'Cliente', 25, 3),
        email_destino: truncate(input.dest_email || generateEmail(input.dest_name), 35, 3),
        calle_destino: destStreet.calle,
        numero_destino: destStreet.numero,
        colonia_destino: truncate(input.dest_colonia || input.dest_city, 35, 3),
        telefono_destino: cleanPhone(input.dest_phone),
        estado_destino: truncate(input.dest_state, 35, 3),
        municipio_destino: truncate(input.dest_city, 35, 3),
        referencias_destino: truncate(input.dest_references || input.dest_street, 35, 3),
        generar_recoleccion: false,
        tiene_notificacion: true,
        origen_guia: 't1envios',
        comercio_id: config.shop_id,
        token_quote: input.quote_token,
    };

    const response = await makeT1Request<T1CreateLabelResponse>(config, '/guide/create', {
        method: 'POST',
        body: t1Req,
    });

    if (!response.success || !response.detail) {
        throw new Error(response.message || 'Error al generar guía T1');
    }

    return {
        tracking_number: response.detail.guia,
        label_url: response.detail.link_guia || '',
        cost: response.detail.costo || 0,
        order_number: response.detail.num_orden || '',
        carrier: response.detail.paqueteria || '',
    };
}

// ─── Tracking ───────────────────────────────────────────

export interface TrackingResult {
    tracking_number: string;
    status: 'pending' | 'collected' | 'in_transit' | 'delivered' | 'exception' | 'cancelled';
    status_label: string;
    description: string;
    location?: string;
    history: Array<{
        date: string;
        description: string;
        location?: string;
    }>;
}

export async function getT1Tracking(trackingNumber: string): Promise<TrackingResult> {
    const config = await getT1ConfigFromDB();
    if (!config.enabled) throw new Error('T1 Envíos no está habilitado');

    // Tracking uses a different base URL (enapi instead of apiv2)
    let trackingUrl = config.api_url;
    if (trackingUrl.includes('apiv2')) {
        trackingUrl = trackingUrl.replace('apiv2', 'enapi');
    }

    const accessToken = await getT1AccessToken();
    const url = `${trackingUrl.replace(/\/$/, '')}/webhook-maestro/query/estado-guia/${trackingNumber}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'shop_id': config.shop_id,
        },
    });

    const data: T1TrackingResponse = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.message || `Tracking error ${response.status}`);
    }

    // Map T1 status to internal
    const ext = (data.detail?.estado_externo || '').toLowerCase();
    const int = (data.detail?.estado_interno || '').toLowerCase();

    let status: TrackingResult['status'] = 'pending';
    let statusLabel = 'Guía Generada';
    if (ext.includes('delivered') || int.includes('entregado')) { status = 'delivered'; statusLabel = 'Entregado'; }
    else if (ext.includes('transit') || int.includes('camino')) { status = 'in_transit'; statusLabel = 'En Tránsito'; }
    else if (ext.includes('collected') || int.includes('recolectado')) { status = 'collected'; statusLabel = 'Recolectado'; }
    else if (ext.includes('exception') || int.includes('excepcion')) { status = 'exception'; statusLabel = 'Excepción'; }
    else if (ext.includes('cancelled') || int.includes('cancelado')) { status = 'cancelled'; statusLabel = 'Cancelado'; }

    const history = (data.detail?.historial || []).map(h => ({
        date: h.fecha || '',
        description: h.descripcion || h.estado || '',
        location: h.ubicacion,
    }));

    return {
        tracking_number: data.detail?.num_guia || trackingNumber,
        status,
        status_label: statusLabel,
        description: history[0]?.description || data.message || '',
        location: history[0]?.location || data.detail?.receptor?.direccion,
        history,
    };
}

// ─── Test Connection ────────────────────────────────────

export async function testT1Connection(): Promise<{ success: boolean; message: string; balance?: number }> {
    try {
        const config = await getT1ConfigFromDB();
        if (!config.enabled) return { success: false, message: 'T1 Envíos está deshabilitado' };
        if (!config.username || !config.password) return { success: false, message: 'Credenciales no configuradas' };

        // Test auth
        await getT1AccessToken(true);

        return { success: true, message: 'Conexión exitosa con T1 Envíos' };
    } catch (err: any) {
        return { success: false, message: err?.message || 'Error de conexión' };
    }
}
