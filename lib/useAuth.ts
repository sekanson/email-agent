"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect } from "react";

/**
 * Custom auth hook that bridges NextAuth with the app
 * Returns user info from NextAuth session
 */
export function useAuth() {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated";
  const userEmail = session?.user?.email || null;
  const userName = session?.user?.name || null;
  const userPicture = session?.user?.image || null;

  // Sync with localStorage for backwards compatibility with Sidebar and other components
  useEffect(() => {
    if (userEmail) {
      localStorage.setItem("userEmail", userEmail);
    }
    if (userName) {
      localStorage.setItem("userName", userName);
    }
    if (userPicture) {
      localStorage.setItem("userPicture", userPicture);
    }
  }, [userEmail, userName, userPicture]);

  const handleSignOut = () => {
    // Clear localStorage on sign out
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userName");
    localStorage.removeItem("userPicture");
    signOut({ callbackUrl: "/" });
  };

  return {
    userEmail,
    userName,
    userPicture,
    isLoading,
    isAuthenticated,
    session,
    signIn: () => signIn("google"),
    signOut: handleSignOut,
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
