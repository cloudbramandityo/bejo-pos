import { useState, useEffect, useCallback } from 'react';
import { getPB } from '../lib/pocketbase';
import type { RecordModel } from 'pocketbase';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'developer' | 'admin' | 'kasir' | 'agen' | 'spk';
  isActive: boolean;
  avatar?: string;
  created: string;
  updated: string;
}

export interface AuthState {
  user: RecordModel | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAnonymous: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<RecordModel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pb = getPB();

    // Sesi awal
    const checkAuth = async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh();
          setUser(pb.authStore.model);
        } catch (e) {
          console.warn('[Auth] Sesi kedaluwarsa');
          pb.authStore.clear();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    checkAuth();

    // Pantau perubahan session
    const unsubscribe = pb.authStore.onChange((_token, model) => {
      setUser(model);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const pb = getPB();
    const authData = await pb.collection('users').authWithPassword(email, password);
    return authData.record;
  }, []);

  const signOut = useCallback(() => {
    getPB().authStore.clear();
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading: loading,
    login,
    logout: signOut,
    signOut,
  };
}
