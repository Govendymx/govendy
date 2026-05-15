/**
 * Utilidades para paginación en APIs
 */

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Parsea y valida parámetros de paginación desde query params
 */
export function parsePaginationParams(req: { nextUrl: { searchParams: URLSearchParams } }): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') || 1) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.nextUrl.searchParams.get('limit') || 20) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Crea respuesta paginada
 */
export function createPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginationResult<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
