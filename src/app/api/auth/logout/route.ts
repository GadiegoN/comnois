import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { revokeSessionToken, SESSION_COOKIE_NAME } from "@/server/services/auth";
import { clearSessionCookie, handleApiError } from "@/server/http";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const rawToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    await revokeSessionToken(rawToken);
    const res = NextResponse.json({ ok: true });
    return clearSessionCookie(res);
  } catch (err) {
    return handleApiError(err);
  }
}

