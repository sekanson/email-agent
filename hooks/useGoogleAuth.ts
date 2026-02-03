"use client";

import { useCallback, useEffect, useState } from 'react';
import { loadGISScript, createGISClient, SCOPES, GISAuthResponse } from '@/lib/google-identity';

interface UseGoogleAuthOptions {
  onLoginSuccess?: (response: GISAuthResponse) => Promise<void>;
  onGmailSuccess?: (response: GISAuthResponse) => Promise<void>;
  onCalendarSuccess?: (response: GISAuthResponse) => Promise<void>;
  onError?: (error: Error) => void;
}

export function useGoogleAuth(options: UseGoogleAuthOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGISReady, setIsGISReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;

  // Load GIS script on mount
  useEffect(() => {
    loadGISScript()
      .then(() => setIsGISReady(true))
      .catch((err) => {
        console.error('Failed to load GIS:', err);
        setError(err);
      });
  }, []);

  /**
   * Phase 1: Login with Google (just email + profile)
   * Use this for initial sign-in
   */
  const loginWithGoogle = useCallback(async () => {
    if (!isGISReady) {
      setError(new Error('Google Identity Services not ready'));
      return;
    }

    setIsLoading(true);
    setError(null);

    const triggerAuth = createGISClient(SCOPES.LOGIN, {
      clientId,
      onSuccess: async (response) => {
        try {
          // Exchange code for tokens via our backend
          const res = await fetch('/api/auth/gis/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: response.code }),
          });

          if (!res.ok) {
            throw new Error('Failed to complete login');
          }

          await options.onLoginSuccess?.(response);
        } catch (err) {
          setError(err as Error);
          options.onError?.(err as Error);
        } finally {
          setIsLoading(false);
        }
      },
      onError: (err) => {
        setError(err);
        setIsLoading(false);
        options.onError?.(err);
      },
    });

    triggerAuth();
  }, [isGISReady, clientId, options]);

  /**
   * Phase 2: Connect Gmail (for labels, email features)
   * Use this after login when user wants email features
   */
  const connectGmail = useCallback(async () => {
    if (!isGISReady) {
      setError(new Error('Google Identity Services not ready'));
      return;
    }

    setIsLoading(true);
    setError(null);

    const triggerAuth = createGISClient(SCOPES.GMAIL, {
      clientId,
      onSuccess: async (response) => {
        try {
          // Exchange code for tokens via our backend
          const res = await fetch('/api/auth/gis/gmail', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: response.code }),
          });

          if (!res.ok) {
            throw new Error('Failed to connect Gmail');
          }

          await options.onGmailSuccess?.(response);
        } catch (err) {
          setError(err as Error);
          options.onError?.(err as Error);
        } finally {
          setIsLoading(false);
        }
      },
      onError: (err) => {
        setError(err);
        setIsLoading(false);
        options.onError?.(err);
      },
    });

    triggerAuth();
  }, [isGISReady, clientId, options]);

  /**
   * Phase 3: Connect Calendar (optional)
   * Use this when user wants calendar features
   */
  const connectCalendar = useCallback(async () => {
    if (!isGISReady) {
      setError(new Error('Google Identity Services not ready'));
      return;
    }

    setIsLoading(true);
    setError(null);

    const triggerAuth = createGISClient(SCOPES.CALENDAR, {
      clientId,
      onSuccess: async (response) => {
        try {
          // Exchange code for tokens via our backend
          const res = await fetch('/api/auth/gis/calendar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: response.code }),
          });

          if (!res.ok) {
            throw new Error('Failed to connect Calendar');
          }

          await options.onCalendarSuccess?.(response);
        } catch (err) {
          setError(err as Error);
          options.onError?.(err as Error);
        } finally {
          setIsLoading(false);
        }
      },
      onError: (err) => {
        setError(err);
        setIsLoading(false);
        options.onError?.(err);
      },
    });

    triggerAuth();
  }, [isGISReady, clientId, options]);

  return {
    loginWithGoogle,
    connectGmail,
    connectCalendar,
    isLoading,
    isGISReady,
    error,
  };
}
