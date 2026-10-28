import { NextResponse } from "next/server";
import { getOptionalCurrentUser, handleApiError } from "@/server/http";

export async function GET() {
  try {
    const user = await getOptionalCurrentUser();
    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}

