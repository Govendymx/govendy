/**
 * Rate Limiting básico usando memoria (para desarrollo y pequeña escala)
 * Para producción a gran escala, usar Redis o un servicio dedicado
 */

type RateLimitStore = {
  [key: string]: {
    count: number;
    resetAt: number;
  };
};

const store: RateLimitStore = {};

// Limpiar entradas expiradas cada 5 minutos
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const key in store) {
      if (store[key].resetAt < now) {
        delete store[key];
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Verifica si una solicitud excede el límite de rate
 * @param identifier Identificador único (IP, user ID, etc.)
 * @param maxRequests Número máximo de requests
 * @param windowMs Ventana de tiempo en milisegundos
 * @returns true si está dentro del límite, false si excedió
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000, // 1 minuto por defecto
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = identifier;

  if (!store[key] || store[key].resetAt < now) {
    // Nueva ventana o ventana expirada
    store[key] = {
      count: 1,
      resetAt: now + windowMs,
    };
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: store[key].resetAt,
    };
  }

  if (store[key].count >= maxRequests) {
    // Límite excedido
    return {
      allowed: false,
      remaining: 0,
      resetAt: store[key].resetAt,
    };
  }

  // Incrementar contador
  store[key].count++;
  return {
    allowed: true,
    remaining: maxRequests - store[key].count,
    resetAt: store[key].resetAt,
  };
}

/**
 * Obtiene el identificador de rate limiting desde la request
 */
export function getRateLimitIdentifier(req: Request): string {
  // Intentar obtener user ID del token si está disponible
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    // En producción, extraer user ID del JWT token
    // Por ahora, usar IP como fallback
  }

  // Usar IP como identificador (puede ser mejorado con user ID)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || 'unknown';
  return ip;
}
