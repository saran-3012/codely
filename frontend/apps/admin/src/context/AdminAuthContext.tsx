import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import adminApi, { setAccessToken, setSessionExpiredHandler } from '../api';
import { AdminAuthContextType, AdminUser } from '../types';

export const AdminAuthContext = createContext<AdminAuthContextType | null>(null);

export const AdminAuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [accessToken, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setToken(null);
    });

    const restoreSession = async () => {
      try {
        const { data } = await axios.post(
          '/api/v1/auth/refresh',
          {},
          { withCredentials: true }
        );
        setToken(data.accessToken);
        setAccessToken(data.accessToken);

        const meRes = await adminApi.get('/auth/me');
        const fetchedUser: AdminUser = meRes.data.user;

        if (fetchedUser.role !== 'ADMIN') {
          // Logged-in user is not an admin — clear the session silently
          await axios.post('/api/v1/auth/logout', {}, { withCredentials: true });
          setUser(null);
          setToken(null);
          setAccessToken(null);
        } else {
          setUser(fetchedUser);
        }
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
    const { data } = await adminApi.post('/auth/login', { email, password });
    setToken(data.accessToken);
    setAccessToken(data.accessToken);

    const meRes = await adminApi.get('/auth/me');
    const fetchedUser: AdminUser = meRes.data.user;

    if (fetchedUser.role !== 'ADMIN') {
      // Revoke the newly-issued session — user is not an admin
      await adminApi.post('/auth/logout');
      setToken(null);
      setAccessToken(null);
      throw new Error('Access denied: admin privileges required.');
    }

    setUser(fetchedUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi.post('/auth/logout');
    } catch {
      // Continue logout even if request fails
    }
    setUser(null);
    setToken(null);
    setAccessToken(null);
  }, []);

  return (
    <AdminAuthContext.Provider value={{ user, accessToken, login, logout, loading }}>
      {children}
    </AdminAuthContext.Provider>
  );
};
