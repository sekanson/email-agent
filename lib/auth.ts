import { getServerSession } from "next-auth";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase";

/**
 * NextAuth configuration
 * Requests FULL Gmail scopes during sign-in for single-click onboarding
 * No separate "connect Gmail" step needed
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent", // Always show consent to ensure we get refresh token
          access_type: "offline", // Get refresh token
          scope: [
            "openid",
            "email",
            "profile",
            // Gmail scopes - full access for email processing
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.labels",
            "https://www.googleapis.com/auth/gmail.settings.basic",
            // Calendar scopes
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
          ].join(" "),
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account) return false;

      const supabase = createClient();

      // Upsert user with Gmail tokens from OAuth
      const userData: Record<string, unknown> = {
        email: user.email,
        name: user.name,
        picture: user.image,
        // Store OAuth tokens for Gmail API access
        access_token: account.access_token,
        refresh_token: account.refresh_token,
        token_expiry: account.expires_at ? account.expires_at * 1000 : null,
        // Mark integrations as connected
        gmail_connected: true,
        gmail_connected_at: new Date().toISOString(),
        calendar_connected: true,
        calendar_connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Check if user exists
      const { data: existingUser } = await supabase
        .from("users")
        .select("email, created_at")
        .eq("email", user.email)
        .single();

      if (!existingUser) {
        // New user
        userData.subscription_status = "trial";
        userData.subscription_tier = "free";
        userData.drafts_created_count = 0;
        userData.created_at = new Date().toISOString();
      }

      // Upsert (insert or update)
      const { error } = await supabase.from("users").upsert(userData, {
        onConflict: "email",
      });

      if (error) {
        console.error("[NextAuth] Error storing user:", error);
        return false;
      }

      console.log("[NextAuth] User signed in with Gmail access:", user.email);
      return true;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.image = token.picture as string;
      }
      return session;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      // Store access token in JWT for potential client-side use
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * Get the authenticated user's email from the session
 * Returns null if not authenticated
 */
export async function getAuthenticatedUser(): Promise<string | null> {
  // First, check our new cookie-based session (GIS flow)
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('zeno_session');
    
    if (sessionCookie) {
      const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
      if (sessionData.email && sessionData.exp > Date.now()) {
        console.log("[getAuthenticatedUser] Cookie session:", sessionData.email);
        return sessionData.email;
      }
    }
  } catch (error) {
    console.log("[getAuthenticatedUser] Cookie check failed:", error);
  }

  // Fall back to NextAuth session (legacy flow)
  const session = await getServerSession(authOptions);
  console.log("[getAuthenticatedUser] NextAuth session:", session?.user?.email);
  return session?.user?.email || null;
}

/**
 * Verify that the authenticated user matches the requested userEmail
 * Use this in API routes to prevent unauthorized access
 */
export async function verifyUserAccess(requestedEmail: string): Promise<{
  authorized: boolean;
  userEmail: string | null;
  error?: string;
}> {
  const authenticatedEmail = await getAuthenticatedUser();

  if (!authenticatedEmail) {
    return {
      authorized: false,
      userEmail: null,
      error: "Not authenticated. Please sign in.",
    };
  }

  if (authenticatedEmail.toLowerCase() !== requestedEmail.toLowerCase()) {
    return {
      authorized: false,
      userEmail: authenticatedEmail,
      error: "You are not authorized to access this resource.",
    };
  }

  return {
    authorized: true,
    userEmail: authenticatedEmail,
  };
}

/**
 * Check if user is an admin
 */
export async function isAdmin(email: string): Promise<boolean> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("users")
    .select("is_admin")
    .eq("email", email)
    .single();

  console.log("[isAdmin] Checking admin status for:", email, "Result:", data, "Error:", error);
  return data?.is_admin === true;
}

/**
 * Verify admin access - must be authenticated AND be an admin
 */
export async function verifyAdminAccess(): Promise<{
  authorized: boolean;
  userEmail: string | null;
  error?: string;
}> {
  const authenticatedEmail = await getAuthenticatedUser();

  if (!authenticatedEmail) {
    return {
      authorized: false,
      userEmail: null,
      error: "Not authenticated. Please sign in.",
    };
  }

  const adminStatus = await isAdmin(authenticatedEmail);
  if (!adminStatus) {
    return {
      authorized: false,
      userEmail: authenticatedEmail,
      error: "Admin access required.",
    };
  }

  return {
    authorized: true,
    userEmail: authenticatedEmail,
  };
}
