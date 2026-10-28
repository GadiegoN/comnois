import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  AuthenticatedUser,
  SESSION_COOKIE_NAME,
  verifyApiToken,
  verifySessionToken,
} from "./services/auth";
import { ForbiddenError, UnauthorizedError, toPublicErrorResponse } from "@/lib/errors";

export async function getOptionalCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionCookie) {
    const user = await verifySessionToken(sessionCookie);
    if (user) return user;
  }

  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const rawToken = authHeader.slice(7).trim();
    const apiUser = await verifyApiToken(rawToken);
    if (apiUser) return apiUser;
    const sessionUser = await verifySessionToken(rawToken);
    if (sessionUser) return sessionUser;
  }

  return null;
}

export async function requireCurrentUser(
  requiredScope?: "read" | "write"
): Promise<AuthenticatedUser> {
  const user = await getOptionalCurrentUser();
  if (!user) {
    throw new UnauthorizedError("Sessão inválida ou expirada. Faça login novamente.");
  }
  if (requiredScope && user.scopes && !user.scopes.includes(requiredScope)) {
    throw new ForbiddenError(
      `O token de API utilizado não possui o escopo necessário ('${requiredScope}').`
    );
  }
  return user;
}

export function attachSessionCookie(
  response: NextResponse,
  sessionToken: string,
  expiresAt: Date
): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return response;
}

export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function handleApiError(err: unknown): NextResponse {
  const { status, body } = toPublicErrorResponse(err);
  return NextResponse.json(body, { status });
}

