import { NextResponse } from "next/server";

/**
 * Standard unauthorized response
 */
export function unauthorizedResponse(message: string = "Unauthorized") {
  return NextResponse.json(
    { error: message },
    { status: 401 }
  );
}

/**
 * Standard forbidden response (authenticated but not allowed)
 */
export function forbiddenResponse(message: string = "Forbidden") {
  return NextResponse.json(
    { error: message },
    { status: 403 }
  );
}

/**
 * Standard bad request response
 */
export function badRequestResponse(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 400 }
  );
}

/**
 * Standard not found response
 */
export function notFoundResponse(message: string = "Not found") {
  return NextResponse.json(
    { error: message },
    { status: 404 }
  );
}

/**
 * Standard server error response
 */
export function serverErrorResponse(message: string = "Internal server error") {
  return NextResponse.json(
    { error: message },
    { status: 500 }
  );
}
