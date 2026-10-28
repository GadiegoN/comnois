import { NextRequest, NextResponse } from "next/server";
import { confirmPasswordReset, requestPasswordReset } from "@/server/services/auth";
import { handleApiError } from "@/server/http";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string };
    const ipAddress = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
    const result = await requestPasswordReset(body.email ?? "", { ipAddress });
    return NextResponse.json({
      message:
        "Se o e-mail informado estiver associado a uma conta ativa, uma instrução de redefinição foi gerada.",
      // Exposed in local/dev environment to allow testing the full flow without external SMTP
      ...(process.env.NODE_ENV !== "production" && result.resetToken
        ? { devResetToken: result.resetToken }
        : {}),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as { token?: string; newPassword?: string };
    await confirmPasswordReset({
      token: body.token ?? "",
      newPassword: body.newPassword ?? "",
    });
    return NextResponse.json({
      ok: true,
      message: "Senha redefinida com sucesso. Faça login com sua nova credencial.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}

