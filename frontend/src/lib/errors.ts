import axios from 'axios';

export interface ApiErrorBody {
  code: string;
  message: string;
}

export function getApiError(err: unknown, fallback = 'Something went wrong'): ApiErrorBody {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Partial<ApiErrorBody> | undefined;
    if (data?.message) return { code: data.code ?? 'ERROR', message: data.message };
    if (!err.response) return { code: 'NETWORK_ERROR', message: 'No connection — check your network' };
    if (err.response.status === 429) return { code: 'RATE_LIMITED', message: 'Too many attempts, please wait a moment' };
    if (err.response.status >= 500) return { code: 'SERVER_ERROR', message: 'Server error, please try again' };
  }
  return { code: 'ERROR', message: fallback };
}

export function getApiMessage(err: unknown, fallback = 'Something went wrong'): string {
  return getApiError(err, fallback).message;
}
