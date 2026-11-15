import axios, { AxiosError } from 'axios';
import type { ApiErrorResponse } from '@/types';
import { DEMO_MODE } from '@/demo/config';
import { demoAdapter } from '@/demo/adapter';

const baseURL = '/api/v1';

export class ApiClientError extends Error {
  constructor(
    public readonly response: ApiErrorResponse,
    public readonly cause?: unknown,
  ) {
    super(response.message.join(' '));
    this.name = 'ApiClientError';
  }
}

export const apiClient = axios.create({
  baseURL,
  ...(DEMO_MODE ? { adapter: demoAdapter } : {}),
  timeout: 10_000,
  headers: { Accept: 'application/json' },
});
// Session stays in memory; reload requires login and tokens are never persisted.
export function setAccessToken(token?: string) {
  if (token)
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete apiClient.defaults.headers.common.Authorization;
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<unknown>) => {
    if (
      error.response?.status === 401 &&
      apiClient.defaults.headers.common.Authorization
    ) {
      setAccessToken();
      if (typeof window !== 'undefined')
        window.dispatchEvent(new Event('aura:unauthorized'));
    }
    const body = error.response?.data;
    const details =
      body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const messages = Array.isArray(details.message)
      ? details.message.filter(
          (message): message is string => typeof message === 'string',
        )
      : typeof details.message === 'string'
        ? [details.message]
        : [];
    const fallback: ApiErrorResponse = {
      statusCode: error.response?.status ?? 0,
      error:
        typeof details.error === 'string'
          ? details.error
          : error.code === 'ECONNABORTED'
            ? 'Request Timeout'
            : 'API Unavailable',
      message: messages.length ? messages : ['Unable to reach the AURA API.'],
      timestamp: new Date().toISOString(),
    };
    return Promise.reject(new ApiClientError(fallback, error));
  },
);
