"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { authApi, getToken, setToken, type User } from "./api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  loginGoogle: (credential: string) => Promise<void>;
  loginFacebook: (accessToken: string) => Promise<void>;
  register: (username: string, email: string, password: string, captchaToken: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Guests should reach /login immediately — do not block on /auth/me when
        // there is no token (also avoids a long hang when BACKEND_URL is wrong).
        if (!getToken()) {
          setUser(null);
          return;
        }
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(
    async (username: string, password: string) => {
      const { token } = await authApi.login(username, password);
      setToken(token);
      await refresh();
    },
    [refresh],
  );

  const loginGoogle = useCallback(
    async (credential: string) => {
      const { token } = await authApi.loginGoogle(credential);
      setToken(token);
      await refresh();
    },
    [refresh],
  );

  const loginFacebook = useCallback(
    async (accessToken: string) => {
      const { token } = await authApi.loginFacebook(accessToken);
      setToken(token);
      await refresh();
    },
    [refresh],
  );

  const register = useCallback(
    async (username: string, email: string, password: string, captchaToken: string) => {
      await authApi.register(username, email, password, captchaToken);
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, loginGoogle, loginFacebook, register, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
