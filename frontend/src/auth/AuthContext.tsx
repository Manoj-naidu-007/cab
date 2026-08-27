import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";
import { api, TOKEN_KEY } from "@/src/api";

export type Role = "passenger" | "driver";

export interface User {
  id: string;
  name: string;
  phone: string;
  role: Role;
  home_village_id?: string | null;
  rating: number;
  rides_count: number;
  verified: boolean;
  vehicle_type?: string | null;
  vehicle_number?: string | null;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<User>;
  register: (payload: any) => Promise<User>;
  updateProfile: (payload: any) => Promise<User>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = await storage.secureGet<string | null>(TOKEN_KEY, null);
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
    } catch {
      await storage.secureRemove(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const persist = async (res: { access_token: string; user: User }) => {
    await storage.secureSet(TOKEN_KEY, res.access_token);
    setUser(res.user);
    return res.user;
  };

  const login = async (phone: string, password: string) => {
    const res = await api.post<{ access_token: string; user: User }>(
      "/auth/login",
      { phone, password },
      false,
    );
    return persist(res);
  };

  const register = async (payload: any) => {
    const res = await api.post<{ access_token: string; user: User }>(
      "/auth/register",
      payload,
      false,
    );
    return persist(res);
  };

  const updateProfile = async (payload: any) => {
    const updated = await api.put<User>("/auth/profile", payload);
    setUser(updated);
    return updated;
  };

  const refresh = async () => {
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
    } catch {
      /* ignore */
    }
  };

  const logout = async () => {
    await storage.secureRemove(TOKEN_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, updateProfile, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
