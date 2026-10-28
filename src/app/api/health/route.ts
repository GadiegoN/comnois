import { NextResponse } from "next/server";
import { getOptionalCurrentUser, requireCurrentUser, handleApiError } from "@/server/http";
import { getSystemHealthAndBackupIntegrity } from "@/server/services/observability";
import { runSearchAndRagEvaluationBenchmark } from "@/server/search/evaluator";

export async function GET() {
  try {
    const user = await getOptionalCurrentUser();
    const health = await getSystemHealthAndBackupIntegrity(user?.id);
    return NextResponse.json(health);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST() {
  try {
    const user = await requireCurrentUser("read");
    const benchmark = await runSearchAndRagEvaluationBenchmark(user.id);
    return NextResponse.json({ benchmark });
  } catch (err) {
    return handleApiError(err);
  }
}

