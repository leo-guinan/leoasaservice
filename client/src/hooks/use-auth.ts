import { useState, useEffect } from "react";

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem("auth_token"),
    isAuthenticated: false,
  });

  useEffect(() => {
    // Check if we have a token and validate it
    const token = localStorage.getItem("auth_token");
    if (token) {
      validateToken(token);
    }
  }, []);

  const validateToken = async (token: string) => {
    try {
      const response = await fetch("/api/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const user = await response.json();
        setAuthState({
          user,
          token,
          isAuthenticated: true,
        });
      } else {
        // Token is invalid, clear it
        logout();
      }
    } catch (error) {
      console.error("Token validation failed:", error);
      logout();
    }
  };

  const login = (token: string, username: string) => {
    localStorage.setItem("auth_token", token);
    setAuthState({
      user: { id: 0, username, role: "user" }, // We'll get the real user data from the token
      token,
      isAuthenticated: true,
    });
    // Validate the token to get the full user data
    validateToken(token);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setAuthState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  };

  const getAuthHeaders = () => {
    if (!authState.token) return undefined;
    return {
      Authorization: `Bearer ${authState.token}`,
    };
  };

  return {
    user: authState.user,
    token: authState.token,
    isAuthenticated: authState.isAuthenticated,
    login,
    logout,
    getAuthHeaders,
  };
} 