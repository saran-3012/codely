export interface AdminUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'USER';
}

export interface AdminAuthContextType {
  user: AdminUser | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

export interface AccessLog {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  responseTimeMs: number;
  ip: string | null;
  userId: string | null;
  createdAt: string;
}

export interface AppLog {
  id: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
