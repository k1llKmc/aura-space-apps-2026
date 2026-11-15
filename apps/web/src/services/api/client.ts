import axios, { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types';

const baseURL = '/api/v1';

export class ApiClientError extends Error {
  constructor(public readonly response: ApiErrorResponse, public readonly cause?: unknown) {
    super(response.message.join(' '));
    this.name = 'ApiClientError';
  }
}

export const apiClient = axios.create({ baseURL, timeout: 10_000, headers: { Accept: 'application/json' } });
// Session stays in memory; reload requires login and tokens are never persisted.
export function setAccessToken(token?: string) {
  if (token) apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete apiClient.defaults.headers.common.Authorization;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401 && apiClient.defaults.headers.common.Authorization) {
      setAccessToken();
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('aura:unauthorized'));
    }
    const fallback: ApiErrorResponse = {
      statusCode: error.response?.status ?? 0,
      error: error.code === 'ECONNABORTED' ? 'Request Timeout' : 'Network Error',
      message: error.response?.data?.message ?? ['Unable to reach the AURA API.'],
      timestamp: new Date().toISOString(),
    };
    return Promise.reject(new ApiClientError(error.response?.data ?? fallback, error));
  },
);
