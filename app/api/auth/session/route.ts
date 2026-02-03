import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/session
 * 
 * Returns current session info from our cookie
 * Used by useAuth hook to check authentication state
 */
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('zeno_session');
  
  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
    
    // Check if expired
    if (sessionData.exp < Date.now()) {
      return NextResponse.json({ authenticated: false, reason: 'expired' });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        email: sessionData.email,
        name: sessionData.name,
        picture: sessionData.picture,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false, reason: 'invalid' });
  }
}

/**
 * DELETE /api/auth/session
 * 
 * Signs out - clears the session cookie
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  
  // Clear the session cookie
  response.cookies.set('zeno_session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
    path: '/',
  });

  return response;
}
