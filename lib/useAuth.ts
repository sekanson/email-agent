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
  isVerified: boolean; // True once we've confirmed with the server
}

// Initialize from localStorage to prevent flash of "not signed in"
function getInitialState(): SessionState {
  if (typeof window === 'undefined') {
    return { user: null, isLoading: true, isAuthenticated: false, isVerified: false };
  }
  
  const email = localStorage.getItem("userEmail");
  const name = localStorage.getItem("userName");
  const picture = localStorage.getItem("userPicture");
  
  if (email) {
    // Optimistically show as authenticated based on localStorage
    return {
      user: { email, name: name || "", picture: picture || "" },
      isLoading: true, // Still loading until server confirms
      isAuthenticated: true, // Optimistic
      isVerified: false,
    };
  }
  
  return { user: null, isLoading: true, isAuthenticated: false, isVerified: false };
}

/**
 * Custom auth hook for GIS-based authentication
 * Checks session via /api/auth/session endpoint
 */
export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<SessionState>(getInitialState);

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
          isVerified: true,
        });

        // Sync with localStorage for backwards compatibility
        localStorage.setItem("userEmail", data.user.email);
        localStorage.setItem("userName", data.user.name || "");
        localStorage.setItem("userPicture", data.user.picture || "");
      } else {
        // Clear localStorage if server says not authenticated
        localStorage.removeItem("userEmail");
        localStorage.removeItem("userName");
        localStorage.removeItem("userPicture");
        
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          isVerified: true,
        });
      }
    } catch (error) {
      console.error("Session check failed:", error);
      // On error, don't immediately show "not signed in" - keep optimistic state
      // but mark as verified so we don't keep retrying
      setState(prev => ({
        ...prev,
        isLoading: false,
        isVerified: true,
      }));
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
      isVerified: true,
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
    isVerified: state.isVerified,
    session: state.user ? { user: state.user } : null,
    signIn: handleSignIn,
    signOut: handleSignOut,
    refreshSession: checkSession,
  };
}

/**
 * Redirect to sign in if not authenticated
 * Only redirects after server verification to prevent flash
 */
export function useRequireAuth() {
  const router = useRouter();
  const auth = useAuth();
  const { isAuthenticated, isLoading, userEmail, isVerified } = auth;

  useEffect(() => {
    // Only redirect after server has verified the session
    if (isVerified && !isAuthenticated) {
      router.push("/login");
    }
  }, [isVerified, isAuthenticated, router]);

  // Show loading until verified AND authenticated
  // This prevents the flash of "not signed in" during verification
  return { 
    userEmail, 
    isLoading: isLoading || !isVerified,
    isVerified,
  };
}
