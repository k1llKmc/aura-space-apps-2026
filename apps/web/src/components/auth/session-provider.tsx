'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { AuthUser, LoginResponse } from '@aura/shared-types';
import { apiClient, setAccessToken } from '@/services/api/client';
interface Session {
  user?: AuthUser;
  expiresAt?: number;
  message: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>();
  const [expiresAt, setExpiresAt] = useState<number>();
  const [message, setMessage] = useState('');
  const clear = useCallback(() => {
    setAccessToken();
    setUser(undefined);
    setExpiresAt(undefined);
  }, []);
  useEffect(() => {
    const expired = () => {
      clear();
      setMessage('Your session has expired. Sign in again.');
    };
    window.addEventListener('aura:unauthorized', expired);
    return () => window.removeEventListener('aura:unauthorized', expired);
  }, [clear]);
  async function login(username: string, password: string) {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', {
      username,
      password,
    });
    setAccessToken(data.accessToken);
    setExpiresAt(Date.now() + data.expiresIn * 1000);
    setUser(data.user);
    setMessage('');
  }
  async function logout() {
    try {
      await apiClient.post('/auth/logout');
      setMessage('You have signed out.');
    } catch {
      setMessage(
        'Signed out locally. The server session could not be revoked; it expires automatically.',
      );
    } finally {
      clear();
    }
  }
  async function refreshUser() {
    const { data } = await apiClient.get<AuthUser>('/auth/me');
    setUser(data);
  }
  return (
    <Context.Provider
      value={{ user, expiresAt, message, login, logout, refreshUser }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider is required.');
  return value;
}
