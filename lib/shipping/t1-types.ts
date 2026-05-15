/**
 * Tipos TypeScript para la API T1 Envíos
 * Adaptado de APP ENVIOS para Pocket-App (GoVendy Premium)
 */

// ─── Auth ───────────────────────────────────────────────

export interface T1AuthCredentials {
    username: string;
    password: string;
}

export interface T1AuthResponse {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
    token_type: string;
    'not-before-policy': number;
    session_state: string;
    scope: string;
}

// ─── Config (from DB app_settings.t1_envios_config) ─────

export interface T1Config {
    enabled: boolean;
    api_url: string;       // e.g. https://apiv2.t1envios.com
    auth_url: string;      // e.g. https://id.t1.com/auth/realms/T1/protocol/openid-connect/token
    shop_id: string;       // e.g. 316909
    username: string;      // e.g. tuenvio.cdmx@gmail.com
    password: string;
    test_mode: boolean;
    // Markup por plan (pesos MXN que se suman al costo T1)
    markup_basic: number;     // e.g. 60
    markup_pro: number;       // e.g. 50
    markup_platinum: number;  // e.g. 40
}

export const DEFAULT_T1_CONFIG: T1Config = {
    enabled: false,
    api_url: 'https://apiv2.t1envios.com',
    auth_url: 'https://id.t1.com/auth/realms/T1/protocol/openid-connect/token',
    shop_id: '',
    username: '',
    password: '',
    test_mode: true,
    markup_basic: 60,
    markup_pro: 50,
    markup_platinum: 40,
};

// ─── Quote ──────────────────────────────────────────────

export interface T1QuoteRequest {
    codigo_postal_origen: string;
    codigo_postal_destino: string;
    peso: number;
    largo: number;
    ancho: number;
    alto: number;
    dias_embarque: number;
    seguro: boolean;
    valor_paquete: number;
    tipo_paquete: number;   // 1=sobre, 2=paquete
    comercio_id: string;
    paquetes?: number;
    generar_recoleccion?: boolean;
}

export interface T1QuoteServiceInfo {
    servicio: string;
    tipo_servicio: string;
    total_paquetes: number;
    costo_total: number;
    fecha_claro_entrega: string;
    fecha_mensajeria_entrega: string;
    dias_entrega: number;
    negociacion_id: number;
    porcentaje_negociacion: number;
    moneda: string;
    peso: number;
    peso_volumetrico: number;
    peso_unidades: string;
    largo: number;
    ancho: number;
    alto: number;
    dimensiones: string;
    token: string;          // Token to generate the guide
}

export interface T1QuoteResponse {
    success: boolean;
    message: string;
    result: Array<{
        id: number;
        clave: string;        // Carrier name (DHL, FEDEX, etc.)
        comercio: string;
        seguro: boolean;
        cotizacion: {
            success: boolean;
            message: string;
            code_response: number;
            servicios: Record<string, T1QuoteServiceInfo>;
        };
    }>;
}

// ─── Unified Quote (returned to frontend) ───────────────

export interface T1UnifiedQuote {
    carrier_name: string;   // Human-readable: "DHL", "FedEx", "UPS", "Paquete Express"
    carrier_id: string;     // Lowercase: "dhl", "fedex", "ups", "paquete_express"
    service_level: string;
    cost: number;           // Cost in MXN pesos (already includes markup)
    base_cost: number;      // T1 original cost
    markup: number;         // Markup applied
    delivery_days: number;
    estimated_delivery: string | null;
    token: string;          // Token for guide generation
}

// ─── Label ──────────────────────────────────────────────

export interface T1CreateLabelWithQuoteRequest {
    contenido: string;
    nombre_origen: string;
    apellidos_origen: string;
    email_origen: string;
    calle_origen: string;
    numero_origen: string;
    colonia_origen: string;
    telefono_origen: string;
    estado_origen: string;
    municipio_origen: string;
    referencias_origen: string;
    nombre_destino: string;
    apellidos_destino: string;
    email_destino: string;
    calle_destino: string;
    numero_destino: string;
    colonia_destino: string;
    telefono_destino: string;
    estado_destino: string;
    municipio_destino: string;
    referencias_destino: string;
    generar_recoleccion: boolean;
    tiene_notificacion: boolean;
    origen_guia: string;
    comercio_id: string;
    token_quote: string;
}

export interface T1CreateLabelResponse {
    success: boolean;
    message: string;
    location: string;
    detail: {
        paquetes?: number;
        num_orden: string;
        paqueteria?: string;
        fecha_creacion?: string;
        costo?: number;
        destino?: string;
        pedido_comercio?: string;
        guia: string;           // Tracking number
        file: string;           // PDF base64 encoded
        link_guia: string;      // PDF URL
        pick_up?: string;
    };
}

// ─── Tracking ───────────────────────────────────────────

export interface T1TrackingResponse {
    success: boolean;
    message: string;
    detail: {
        num_guia: string;
        estado_externo?: string;
        estado_interno?: string;
        historial?: Array<{
            fecha: string;
            ubicacion?: string;
            descripcion?: string;
            estado?: string;
        }>;
        receptor?: {
            nombre?: string;
            telefono?: string;
            direccion?: string;
        };
        [key: string]: unknown;
    };
}

// ─── Error ──────────────────────────────────────────────

export interface T1ApiError {
    success?: boolean;
    message: string;
    error?: {
        name: string;
        message: string;
        details?: Record<string, unknown> | string[];
    };
}
