/**
 * Google Identity Services (GIS) - Popup Auth
 * 
 * Replaces NextAuth redirect flow with clean popup experience.
 * Supports incremental authorization:
 * 1. Login: Just email + profile (identify user)
 * 2. Gmail: Full email scopes (when they need labels/email features)
 * 3. Calendar: Calendar scopes (when they access calendar)
 */

// Scopes for each auth phase
export const SCOPES = {
  // Phase 1: Basic login (just to identify user)
  LOGIN: [
    'email',
    'profile',
    'openid',
  ],
  
  // Phase 2: Gmail integration (when they want email features)
  GMAIL: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.labels',
    'https://www.googleapis.com/auth/gmail.settings.basic', // For Focus Mode filters
  ],
  
  // Phase 3: Calendar integration (optional)
  CALENDAR: [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events',
  ],
};

export interface GISConfig {
  clientId: string;
  onSuccess: (response: GISAuthResponse) => void;
  onError?: (error: Error) => void;
}

export interface GISAuthResponse {
  code: string;  // Authorization code to exchange for tokens
  scope: string; // Granted scopes
}

/**
 * Initialize GIS code client for popup auth
 * Returns a function to trigger the popup
 */
export function createGISClient(
  scopes: string[],
  config: GISConfig
): () => void {
  // Check if google.accounts is loaded
  if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
    console.warn('GIS library not loaded yet');
    return () => {
      console.error('GIS library not available');
      config.onError?.(new Error('Google Identity Services not loaded'));
    };
  }

  const client = window.google.accounts.oauth2.initCodeClient({
    client_id: config.clientId,
    scope: scopes.join(' '),
    ux_mode: 'popup',
    include_granted_scopes: true,
    select_account: false,
    callback: (response: { code?: string; error?: string; scope?: string }) => {
      if (response.error) {
        config.onError?.(new Error(response.error));
        return;
      }
      
      if (response.code) {
        config.onSuccess({
          code: response.code,
          scope: response.scope || scopes.join(' '),
        });
      }
    },
  });

  return () => client.requestCode();
}

/**
 * Load GIS library script
 */
export function loadGISScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Already loaded
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load GIS script'));
    document.head.appendChild(script);
  });
}

// Type declarations for GIS
declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient: (config: {
            client_id: string;
            scope: string;
            ux_mode: 'popup' | 'redirect';
            include_granted_scopes?: boolean;
            select_account?: boolean;
            callback: (response: { code?: string; error?: string; scope?: string }) => void;
          }) => {
            requestCode: () => void;
          };
        };
      };
    };
  }
}
