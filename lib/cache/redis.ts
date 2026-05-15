/**
 * Preparación para Redis Cache
 * 
 * Para usar Redis en producción:
 * 1. Instalar: npm install ioredis
 * 2. Configurar REDIS_URL en .env
 * 3. Descomentar el código y usar las funciones
 */

// import Redis from 'ioredis';

// let redis: Redis | null = null;

// export function getRedisClient(): Redis | null {
//   if (redis) return redis;
  
//   const redisUrl = process.env.REDIS_URL;
//   if (!redisUrl) {
//     console.warn('[REDIS] REDIS_URL no configurada, usando caché en memoria');
//     return null;
//   }

//   try {
//     redis = new Redis(redisUrl, {
//       maxRetriesPerRequest: 3,
//       enableReadyCheck: true,
//       lazyConnect: true,
//     });
//     return redis;
//   } catch (err) {
//     console.error('[REDIS] Error al conectar:', err);
//     return null;
//   }
// }

// export async function getCached<T>(
//   key: string,
//   fetcher: () => Promise<T>,
//   ttlSeconds: number = 300
// ): Promise<T> {
//   const client = getRedisClient();
//   if (!client) {
//     // Fallback: ejecutar fetcher directamente
//     return await fetcher();
//   }

//   try {
//     const cached = await client.get(key);
//     if (cached) {
//       return JSON.parse(cached) as T;
//     }

//     const data = await fetcher();
//     await client.setex(key, ttlSeconds, JSON.stringify(data));
//     return data;
//   } catch (err) {
//     console.error('[REDIS] Error en getCached:', err);
//     return await fetcher();
//   }
// }

// export async function invalidateCache(pattern: string): Promise<void> {
//   const client = getRedisClient();
//   if (!client) return;

//   try {
//     const keys = await client.keys(pattern);
//     if (keys.length > 0) {
//       await client.del(...keys);
//     }
//   } catch (err) {
//     console.error('[REDIS] Error al invalidar caché:', err);
//   }
// }

// Placeholder para uso futuro
export function getRedisClient() {
  return null;
}

export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  return await fetcher();
}

export async function invalidateCache(pattern: string): Promise<void> {
  // No-op por ahora
}
