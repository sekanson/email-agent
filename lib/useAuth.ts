"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect } from "react";

/**
 * Custom auth hook that bridges NextAuth with the app
 * Returns user email from NextAuth session
 */
export function useAuth() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  const userEmail = session?.user?.email || null;

  // Sync with localStorage for backwards compatibility with some components
  useEffect(() => {
    if (userEmail) {
      localStorage.setItem("userEmail", userEmail);
    }
  }, [userEmail]);

  return {
    userEmail,
    isLoading,
    isAuthenticated,
    session,
    signIn: () => signIn("google"),
    signOut: () => signOut({ callbackUrl: "/" }),
  };
}

/**
 * Redirect to sign in if not authenticated
 */
export function useRequireAuth() {
  const { isAuthenticated, isLoading, userEmail } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      signIn("google");
    }
  }, [isLoading, isAuthenticated]);

  return { userEmail, isLoading: isLoading || !isAuthenticated };
}
