import { getServerSession } from "next-auth";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { createClient } from "@/lib/supabase";

/**
 * NextAuth configuration
 * This handles user authentication and session management
 * Separate from Gmail OAuth which handles email permissions
 */
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // Check if user exists in our database
      const supabase = createClient();
      const { data: existingUser } = await supabase
        .from("users")
        .select("email")
        .eq("email", user.email)
        .single();

      // Allow sign in if user exists, or create a basic record
      if (!existingUser) {
        // Create user record (they'll need to connect Gmail separately for full features)
        await supabase.from("users").insert({
          email: user.email,
          name: user.name,
          picture: user.image,
          gmail_connected: false,
          created_at: new Date().toISOString(),
        });
      }

      return true;
    },
    async session({ session, token }) {
      // Add user email to session for easy access
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.email = user.email;
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
  const session = await getServerSession(authOptions);
  console.log("[getAuthenticatedUser] Session:", session);
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
