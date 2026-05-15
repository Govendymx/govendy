// Tipos para respuestas de API

export interface ApiResponse<T = any> {
  ok: boolean;
  data?: T;
  error?: string;
  debug?: any;
}

export interface PaginatedResponse<T> {
  ok: boolean;
  data: T[];
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

export interface ErrorResponse {
  ok: false;
  error: string;
  code?: string;
  details?: any;
}
