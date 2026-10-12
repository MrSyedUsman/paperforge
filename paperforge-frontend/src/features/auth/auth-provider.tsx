"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, type ApiUser } from "./api-client";

const TOKEN_KEY = "paperforge-auth-token";

type AuthState = {
  user: ApiUser | null;
  loading: boolean;
  accessToken: string | null;
  login: (username: string, password: string) => Promise<string>;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable: session lasts until refresh */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // Restore the session after a refresh.
    const token = readToken();
    (token ? authApi.me(token).then(user => { setAccessToken(token); setUser(user); }).catch(() => writeToken(null)) : Promise.resolve())
      .finally(() => setLoading(false));
  }, []);

  /** Resolves to an error message, or "" on success. */
  const login = useCallback(async (username: string, password: string) => {
    try {
      const result = await authApi.login(username, password);
      writeToken(result.token);
      setAccessToken(result.token);
      setUser(result.user);
      return "";
    } catch (cause) {
      return cause instanceof TypeError ? "Could not reach the PaperForge server." : (cause as Error).message;
    }
  }, []);

  const signOut = useCallback(() => {
    writeToken(null);
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, accessToken, login, signOut }), [user, loading, accessToken, login, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
