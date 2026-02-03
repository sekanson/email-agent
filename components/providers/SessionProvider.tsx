"use client";

/**
 * Session Provider
 * 
 * Previously wrapped NextAuth's SessionProvider.
 * Now using cookie-based sessions with GIS, so this is a simple pass-through.
 * Kept for backwards compatibility with existing component tree.
 */
export default function SessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
