import { useState, useCallback, useEffect } from "react";
import { authApi, getToken, clearToken, ApiError } from "./api";

const EMAIL_KEY = "studyai_email";

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  email: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

function isTokenValid(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  return payload.exp * 1000 > Date.now();
}

export function useAuth(): AuthState {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (token && isTokenValid(token)) {
      setIsAuthenticated(true);
      setEmail(localStorage.getItem(EMAIL_KEY));
    } else if (token) {
      clearToken();
      localStorage.removeItem(EMAIL_KEY);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.login(email, password);
      localStorage.setItem(EMAIL_KEY, email);
      setEmail(email);
      setIsAuthenticated(true);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail
          : "Network error. Please try again.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await authApi.signup(email, password);
      localStorage.setItem(EMAIL_KEY, email);
      setEmail(email);
      setIsAuthenticated(true);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.detail
          : "Network error. Please try again.";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    localStorage.removeItem(EMAIL_KEY);
    setIsAuthenticated(false);
    setEmail(null);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    error,
    email,
    login,
    signup,
    logout,
    clearError,
  };
}
