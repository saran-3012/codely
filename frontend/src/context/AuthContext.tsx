import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import api, { setAccessToken } from '../api';
import { AuthContextType, User } from '../types';

export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Attempt to restore session via refresh token cookie on app load
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const { data } = await axios.post(
          '/api/auth/refresh',
          {},
          { withCredentials: true }
        );
        setToken(data.accessToken);
        setAccessToken(data.accessToken);

        const meRes = await api.get('/auth/me');
        setUser(meRes.data.user);
      } catch {
        setUser(null);
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setToken(data.accessToken);
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await api.post('/auth/register', { email, password });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Continue logout even if request fails
    }
    setUser(null);
    setToken(null);
    setAccessToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, accessToken, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
