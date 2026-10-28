import { NextRequest, NextResponse } from "next/server";
import { loginUser } from "@/server/services/auth";
import { attachSessionCookie, handleApiError } from "@/server/http";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ipAddress = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const userAgent = req.headers.get("user-agent") ?? undefined;

    const result = await loginUser(body, { ipAddress, userAgent });
    const res = NextResponse.json({ user: result.user }, { status: 200 });
    return attachSessionCookie(res, result.sessionToken, result.expiresAt);
  } catch (err) {
    return handleApiError(err);
  }
}

