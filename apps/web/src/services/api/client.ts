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

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const fallback: ApiErrorResponse = {
      statusCode: error.response?.status ?? 0,
      error: error.code === 'ECONNABORTED' ? 'Request Timeout' : 'Network Error',
      message: error.response?.data?.message ?? ['Unable to reach the AURA API.'],
      timestamp: new Date().toISOString(),
    };
    return Promise.reject(new ApiClientError(error.response?.data ?? fallback, error));
  },
);
