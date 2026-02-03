"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface User {
  email: string;
  name: string;
  picture: string;
}

interface SessionState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Custom auth hook for GIS-based authentication
 * Checks session via /api/auth/session endpoint
 */
export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<SessionState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check session on mount and periodically
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();

      if (data.authenticated && data.user) {
        setState({
          user: data.user,
          isLoading: false,
          isAuthenticated: true,
        });

        // Sync with localStorage for backwards compatibility
        localStorage.setItem("userEmail", data.user.email);
        localStorage.setItem("userName", data.user.name || "");
        localStorage.setItem("userPicture", data.user.picture || "");
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch (error) {
      console.error("Session check failed:", error);
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const handleSignOut = useCallback(async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch (error) {
      console.error("Sign out error:", error);
    }

    // Clear localStorage
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("userPicture");

    // Update state
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });

    // Redirect to home
    router.push("/");
  }, [router]);

  const handleSignIn = useCallback(() => {
    router.push("/login");
  }, [router]);

  return {
    userEmail: state.user?.email || null,
    userName: state.user?.name || null,
    userPicture: state.user?.picture || null,
    isLoading: state.isLoading,
    isAuthenticated: state.isAuthenticated,
    session: state.user ? { user: state.user } : null,
    signIn: handleSignIn,
    signOut: handleSignOut,
    refreshSession: checkSession,
  };
}

/**
 * Redirect to sign in if not authenticated
 */
export function useRequireAuth() {
  const router = useRouter();
  const { isAuthenticated, isLoading, userEmail } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  return { userEmail, isLoading: isLoading || !isAuthenticated };
}
