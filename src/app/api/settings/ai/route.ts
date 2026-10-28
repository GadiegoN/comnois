import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import {
  getUserAiConfig,
  getUserAiUsageSummary,
  updateUserAiConfig,
} from "@/server/ai/providers";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    const fullConfig = await getUserAiConfig(user.id);
    const { _decryptedApiKey: _, ...config } = fullConfig;
    const usage = await getUserAiUsageSummary(user.id);
    return NextResponse.json({ config, usage });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireCurrentUser();
    const body = await req.json();
    const config = await updateUserAiConfig(user.id, body);
    const usage = await getUserAiUsageSummary(user.id);
    return NextResponse.json({ config, usage });
  } catch (err) {
    return handleApiError(err);
  }
}

