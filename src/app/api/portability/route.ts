import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser, handleApiError } from "@/server/http";
import {
  DuplicatePolicy,
  exportLibraryAsCsv,
  exportLibraryAsNetscapeHtml,
  exportUserLibrary,
  importUserLibrary,
  previewImportLibrary,
} from "@/server/services/portability";

export async function GET(req: NextRequest) {
  try {
    const user = await requireCurrentUser("read");
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") ?? "json";

    const bundle = await exportUserLibrary(user.id);

    if (format === "netscape_html" || format === "html") {
      const html = exportLibraryAsNetscapeHtml(bundle);
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (format === "csv") {
      const csv = exportLibraryAsCsv(bundle);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Cache-Control": "private, no-store",
        },
      });
    }

    return NextResponse.json(bundle, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireCurrentUser("write");
    const body = await req.json();
    const duplicatePolicy = (body.duplicatePolicy as DuplicatePolicy) || "skip";
    const payload = body.rawHtml ?? body.bundle ?? body;

    if (body.dryRun) {
      const preview = await previewImportLibrary(user.id, payload);
      return NextResponse.json({ preview });
    }

    const report = await importUserLibrary(user.id, payload, { duplicatePolicy });
    return NextResponse.json({ report });
  } catch (err) {
    return handleApiError(err);
  }
}
