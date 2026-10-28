import { NextRequest, NextResponse } from "next/server";
import { getOptionalCurrentUser, requireCurrentUser, handleApiError } from "@/server/http";
import { getSystemHealthAndBackupIntegrity } from "@/server/services/observability";
import { runSearchAndRagEvaluationBenchmark } from "@/server/search/evaluator";
import { runCliCommand } from "@/cli";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get("normalizeDocs") === "1") {
      await runCliCommand(["ingest-docs"]);
    }
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

