"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Lock,
  Mail,
  User,
  KeyRound,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "reset">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      if (mode === "login") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Falha ao autenticar.");
        }
        router.push("/?view=workspace");
        router.refresh();
        return;
      }

      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, displayName, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Falha ao criar conta.");
        }
        router.push("/?view=workspace");
        router.refresh();
        return;
      }

      if (mode === "reset") {
        if (!resetToken) {
          const res = await fetch("/api/auth/reset-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error?.message || "Erro ao solicitar recuperação.");
          }
          setInfoMessage(
            data.devResetToken
              ? `${data.message} (Token de ambiente local: ${data.devResetToken})`
              : data.message
          );
          if (data.devResetToken) {
            setResetToken(data.devResetToken);
          }
        } else {
          const res = await fetch("/api/auth/reset-password", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: resetToken, newPassword }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error?.message || "Erro ao redefinir senha.");
          }
          setInfoMessage(data.message);
          setResetToken("");
          setMode("login");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col justify-between px-4 py-8 bg-canvas text-fg theme-hero-glow">
      {/* Top Bar */}
      <div className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/welcome"
          className="inline-flex items-center gap-2 text-xs font-medium text-fg-secondary hover:text-fg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para a Landing Page
        </Link>
        <ThemeSwitcher />
      </div>

      {/* Centered Card */}
      <div className="w-full max-w-md mx-auto my-8">
        <Card padding="lg" className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-fg">Comnois Knowledge</h1>
              <p className="text-xs text-fg-secondary">
                Biblioteca híbrida e assistente RAG com citações verificáveis
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 p-1 bg-inset rounded-xl border border-border-subtle text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`py-2 rounded-lg transition cursor-pointer ${
                mode === "login"
                  ? "bg-brand text-white shadow-sm"
                  : "text-fg-secondary hover:text-fg"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`py-2 rounded-lg transition cursor-pointer ${
                mode === "register"
                  ? "bg-brand text-white shadow-sm"
                  : "text-fg-secondary hover:text-fg"
              }`}
            >
              Criar Conta
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("reset");
                setError(null);
              }}
              className={`py-2 rounded-lg transition cursor-pointer ${
                mode === "reset"
                  ? "bg-brand text-white shadow-sm"
                  : "text-fg-secondary hover:text-fg"
              }`}
            >
              Recuperar
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 text-xs flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs flex items-start gap-2 break-all"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-fg-secondary mb-1">
                  Nome de exibição
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-fg-muted absolute left-3.5 top-2.5" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ex: Maria Oliveira"
                    className="w-full pl-10 pr-3.5 py-2 text-sm bg-inset border border-border-subtle rounded-xl text-fg placeholder:text-fg-muted focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-fg-secondary mb-1">
                E-mail
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-fg-muted absolute left-3.5 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full pl-10 pr-3.5 py-2 text-sm bg-inset border border-border-subtle rounded-xl text-fg placeholder:text-fg-muted focus:outline-none focus:border-brand"
                />
              </div>
            </div>

            {mode !== "reset" && (
              <div>
                <label className="block text-xs font-medium text-fg-secondary mb-1">
                  Senha (mín. 8 caracteres, letras e números)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-fg-muted absolute left-3.5 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2 text-sm bg-inset border border-border-subtle rounded-xl text-fg placeholder:text-fg-muted focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
            )}

            {mode === "reset" && resetToken && (
              <>
                <div>
                  <label className="block text-xs font-medium text-fg-secondary mb-1">
                    Token de uso único
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-fg-muted absolute left-3.5 top-2.5" />
                    <input
                      type="text"
                      required
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2 text-sm bg-inset border border-border-subtle rounded-xl text-fg focus:outline-none focus:border-brand"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-secondary mb-1">
                    Nova senha
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nova senha segura"
                    className="w-full px-3.5 py-2 text-sm bg-inset border border-border-subtle rounded-xl text-fg focus:outline-none focus:border-brand"
                  />
                </div>
              </>
            )}

            <Button type="submit" disabled={loading} className="w-full py-2.5">
              {loading
                ? "Processando..."
                : mode === "login"
                  ? "Entrar na Plataforma"
                  : mode === "register"
                    ? "Criar Conta Privada"
                    : resetToken
                      ? "Confirmar Nova Senha"
                      : "Gerar Token de Recuperação"}
            </Button>
          </form>
        </Card>
      </div>

      {/* Bottom info */}
      <div className="text-center text-xs text-fg-muted">
        Protegido por sessão HTTP-only, rate limiting e conformidade LGPD.
      </div>
    </main>
  );
}
