"use client";

import React, { useState, useEffect } from "react";
import {
  Cpu,
  KeyRound,
  Webhook,
  Users,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  Save,
  UserPlus,
  History,
  LogOut,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import type {
  AiConfigData,
  AiUsageData,
  WorkspacesSettingsData,
} from "@/types/platform";

export interface ApiTokenItem {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: string;
}

export interface WebhookItem {
  id: string;
  name: string;
  targetUrl: string;
  events: string[];
  isActive: boolean;
}

interface SettingsAndSecurityTabProps {
  aiConfig: AiConfigData | null;
  aiUsage: AiUsageData | null;
  workspacesData: WorkspacesSettingsData | null;
  apiTokens: ApiTokenItem[];
  webhooks: WebhookItem[];
  activeWorkspaceId?: string;
  onSelectWorkspaceId?: (id: string) => void;
  onRefreshSettings: () => Promise<void>;
  onFeedback: (msg: string, isError?: boolean) => void;
  onAccountDeleted: () => void;
}

export function SettingsAndSecurityTab({
  aiConfig,
  aiUsage,
  workspacesData,
  apiTokens,
  webhooks,
  activeWorkspaceId = "",
  onSelectWorkspaceId,
  onRefreshSettings,
  onFeedback,
  onAccountDeleted,
}: SettingsAndSecurityTabProps) {
  const [provider, setProvider] = useState(
    aiConfig?.provider || aiConfig?.preferredProvider || "extractive"
  );
  const [baseUrl, setBaseUrl] = useState(aiConfig?.baseUrl || "");
  const [apiKey, setApiKey] = useState("");
  const [chatModel, setChatModel] = useState(
    aiConfig?.chatModel || "gpt-4o-mini"
  );
  const [embeddingModel, setEmbeddingModel] = useState(
    aiConfig?.embeddingModel || "text-embedding-3-small"
  );
  const [autoSummarize, setAutoSummarize] = useState(
    aiConfig?.autoSummarize ?? true
  );
  const [autoTagging, setAutoTagging] = useState(
    aiConfig?.autoSuggestTags ?? aiConfig?.autoTaggingEnabled ?? true
  );
  const [dailyLimit, setDailyLimit] = useState(
    String(
      aiUsage?.dailyTokenLimit ?? aiConfig?.dailyTokenLimit ?? 100000
    )
  );

  useEffect(() => {
    if (aiConfig) {
      setProvider(
        aiConfig.provider || aiConfig.preferredProvider || "extractive"
      );
      setBaseUrl(aiConfig.baseUrl || "");
      setChatModel(aiConfig.chatModel || "gpt-4o-mini");
      setEmbeddingModel(aiConfig.embeddingModel || "text-embedding-3-small");
      setAutoSummarize(aiConfig.autoSummarize ?? true);
      setAutoTagging(
        aiConfig.autoSuggestTags ?? aiConfig.autoTaggingEnabled ?? true
      );
    }
    if (aiUsage?.dailyTokenLimit) {
      setDailyLimit(String(aiUsage.dailyTokenLimit));
    }
  }, [aiConfig, aiUsage]);

  // Scoped API Token state
  const [tokenName, setTokenName] = useState("");
  const [tokenScopes, setTokenScopes] = useState("read,write");
  const [newlyGeneratedToken, setNewlyGeneratedToken] = useState<string | null>(
    null
  );

  // Webhook state
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");

  // Workspace & RBAC invite state
  const [wsName, setWsName] = useState("");
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [generatedInviteToken, setGeneratedInviteToken] = useState<
    string | null
  >(null);
  const [acceptInviteToken, setAcceptInviteToken] = useState("");

  // LGPD Delete confirmation
  const [lgpdConfirm, setLgpdConfirm] = useState("");

  const workspaceList = (
    workspacesData?.workspaces ||
    (workspacesData?.owned || []).map((w) => ({
      id: w.id,
      workspaceId: w.id,
      name: w.name,
      slug: w.slug || w.id,
      role: "owner",
    }))
  ).map((w, idx) => ({
    id: w.id || w.workspaceId || `ws-${idx}`,
    name: w.name,
    role: w.role || "owner",
  }));

  const usedTokens = aiUsage?.totalTokensToday ?? 0;
  const maxTokens = aiUsage?.dailyTokenLimit ?? (Number(dailyLimit) || 100000);
  const tokenUsagePercent = Math.min(
    100,
    Math.round((usedTokens / Math.max(1, maxTokens)) * 100)
  );

  async function handleSaveAiSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      const normalizedProvider =
        provider === "deterministic" ? "extractive" : provider;
      const res = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: normalizedProvider,
          baseUrl: baseUrl.trim() || null,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          chatModel: chatModel.trim() || undefined,
          embeddingModel: embeddingModel.trim() || undefined,
          autoSummarize,
          autoSuggestTags: autoTagging,
          dailyTokenLimit: Number(dailyLimit) || 100000,
        }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar configurações de IA.");
      setApiKey("");
      onFeedback("Configurações de IA e orçamento de tokens atualizados!");
      await onRefreshSettings();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao salvar IA.",
        true
      );
    }
  }

  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault();
    try {
      const scopes = tokenScopes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createApiToken",
          name: tokenName.trim(),
          scopes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Erro ao gerar token.");
      }
      setNewlyGeneratedToken(data.token?.rawToken || data.rawToken);
      setTokenName("");
      onFeedback("Token de API com escopo gerado! Copie-o agora.");
      await onRefreshSettings();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao criar token.",
        true
      );
    }
  }

  async function handleRevokeToken(id: string) {
    await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revokeApiToken", tokenId: id }),
    });
    await onRefreshSettings();
  }

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createWebhook",
          name: whName.trim(),
          targetUrl: whUrl.trim(),
          events: ["item.created", "item.processed", "item.deleted"],
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar webhook HMAC.");
      setWhName("");
      setWhUrl("");
      onFeedback("Webhook assinado via HMAC-SHA256 registrado!");
      await onRefreshSettings();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao criar webhook.",
        true
      );
    }
  }

  async function handleDeleteWebhook(id: string) {
    await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteWebhook", webhookId: id }),
    });
    await onRefreshSettings();
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createWorkspace",
          name: wsName.trim(),
        }),
      });
      if (!res.ok) throw new Error("Falha ao criar workspace colaborativo.");
      setWsName("");
      onFeedback("Workspace colaborativo criado!");
      await onRefreshSettings();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao criar workspace.",
        true
      );
    }
  }

  async function handleInviteMember(e: React.FormEvent) {
    e.preventDefault();
    const targetWsId = inviteWorkspaceId || workspaceList[0]?.id;
    if (!targetWsId) {
      onFeedback("Crie um workspace antes de convidar membros.", true);
      return;
    }
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "inviteMember",
          workspaceId: targetWsId,
          invitedEmail: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Falha ao gerar convite.");
      }
      setGeneratedInviteToken(
        data.invite?.inviteToken || data.invite?.token || null
      );
      setInviteEmail("");
      onFeedback("Convite gerado com sucesso!");
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao convidar membro.",
        true
      );
    }
  }

  async function handleAcceptInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!acceptInviteToken.trim()) return;
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "acceptInvite",
          inviteToken: acceptInviteToken.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Convite inválido ou expirado.");
      }
      setAcceptInviteToken("");
      onFeedback("Convite aceito! Você agora faz parte do workspace.");
      await onRefreshSettings();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao aceitar convite.",
        true
      );
    }
  }

  async function handleLeaveWorkspace(workspaceId: string) {
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leaveWorkspace",
          workspaceId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Erro ao sair do workspace.");
      }
      if (activeWorkspaceId === workspaceId && onSelectWorkspaceId) {
        onSelectWorkspaceId("");
      }
      onFeedback(
        "Você saiu do workspace. Seus itens autorais foram preservados no seu acervo pessoal."
      );
      await onRefreshSettings();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao sair do workspace.",
        true
      );
    }
  }

  async function handleDeleteWorkspace(workspaceId: string) {
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteWorkspace",
          workspaceId,
          itemRetentionPolicy: "retain_to_personal",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Erro ao excluir workspace.");
      }
      if (activeWorkspaceId === workspaceId && onSelectWorkspaceId) {
        onSelectWorkspaceId("");
      }
      onFeedback(
        "Workspace excluído com preservação de todos os itens nos acervos pessoais."
      );
      await onRefreshSettings();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao excluir workspace.",
        true
      );
    }
  }

  async function handleRevokeAllSessions() {
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revokeAllSessions" }),
      });
      if (!res.ok) throw new Error("Erro ao revogar sessões.");
      onFeedback("Todas as sessões foram revogadas.");
      onAccountDeleted();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao revogar sessões.",
        true
      );
    }
  }

  async function handleLgpdDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!lgpdConfirm.trim()) {
      onFeedback("Informe sua senha atual para confirmar a exclusão LGPD.", true);
      return;
    }
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteAccount",
          passwordConfirmation: lgpdConfirm,
        }),
      });
      if (!res.ok) throw new Error("Falha ao executar exclusão LGPD.");
      onAccountDeleted();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro na exclusão de conta.",
        true
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. AI Provider & Token Budget */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Cpu className="w-4 h-4 text-brand-text" />
              Provedor de IA & Orçamento Diário de Tokens
            </h3>
            <Badge variant="brand">
              {usedTokens.toLocaleString("pt-BR")} /{" "}
              {maxTokens.toLocaleString("pt-BR")} tokens ({tokenUsagePercent}%)
            </Badge>
          </div>

          {/* Token usage progress bar */}
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-inset overflow-hidden border border-border-subtle">
              <div
                className="h-full bg-brand transition-all"
                style={{ width: `${tokenUsagePercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-fg-muted">
              <span>Operações hoje: {aiUsage?.operationsCount ?? 0}</span>
              <span>
                Custo estimado: US$ {(aiUsage?.estimatedCostUsd ?? 0).toFixed(4)}
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveAiSettings} className="space-y-3">
            <Select
              label="Provedor Preferencial de Embeddings & RAG"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="extractive">
                Local Determinístico / Extrativo (Zero Custo / Offline)
              </option>
              <option value="ollama">Ollama Local (Llama / Nomic Embed)</option>
              <option value="openai">
                OpenAI Compatible (GPT-4o-mini / text-embedding-3-small)
              </option>
              <option value="gemini">
                Google Gemini (gemini-2.5-flash / text-embedding-004)
              </option>
            </Select>

            {provider !== "extractive" && provider !== "deterministic" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Base URL (opcional)"
                  placeholder={
                    provider === "ollama"
                      ? "http://localhost:11434"
                      : "https://api.openai.com/v1"
                  }
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                <Input
                  label={
                    aiConfig?.hasApiKey
                      ? `Chave API (${aiConfig.maskedApiKey})`
                      : "Chave API (criptografada AES-256-GCM)"
                  }
                  type="password"
                  placeholder="sk-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <Input
                  label="Modelo de Chat / Síntese"
                  value={chatModel}
                  onChange={(e) => setChatModel(e.target.value)}
                />
                <Input
                  label="Modelo de Embeddings"
                  value={embeddingModel}
                  onChange={(e) => setEmbeddingModel(e.target.value)}
                />
              </div>
            )}

            <Input
              label="Limite diário de tokens (proteção de orçamento)"
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
            />

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs text-fg-secondary">
                <input
                  type="checkbox"
                  checked={autoSummarize}
                  onChange={(e) => setAutoSummarize(e.target.checked)}
                />
                Resumo automático na captura
              </label>
              <label className="flex items-center gap-2 text-xs text-fg-secondary">
                <input
                  type="checkbox"
                  checked={autoTagging}
                  onChange={(e) => setAutoTagging(e.target.checked)}
                />
                Sugestão automática de tags por IA
              </label>
            </div>

            <Button
              type="submit"
              size="sm"
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Salvar Preferências de IA
            </Button>
          </form>
        </Card>

        {/* 2. Scoped API Tokens */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-brand-text" />
              Tokens de API com Escopo ({apiTokens.length})
            </h3>
            <Badge variant="purple">CLI, MCP & Extensão Chrome</Badge>
          </div>

          <form onSubmit={handleCreateToken} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nome do Token"
                required
                placeholder="Ex: Extensão Chrome / MCP"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
              />
              <Input
                label="Escopos (read, write)"
                value={tokenScopes}
                onChange={(e) => setTokenScopes(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Gerar Token `cmn_...`
            </Button>
          </form>

          {newlyGeneratedToken && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1">
              <div className="font-bold text-emerald-700 dark:text-emerald-300">
                Copie seu token agora (exibido apenas uma vez):
              </div>
              <code className="block font-mono break-all text-fg bg-inset p-2 rounded-lg">
                {newlyGeneratedToken}
              </code>
            </div>
          )}

          <div className="space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-border-subtle">
            {apiTokens.map((tok) => (
              <div
                key={tok.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-elevated/60 border border-border-subtle text-xs"
              >
                <div>
                  <div className="font-semibold text-fg">
                    {tok.name}{" "}
                    <span className="font-mono text-fg-muted">
                      ({tok.tokenPrefix}...)
                    </span>
                  </div>
                  <div className="text-[11px] text-fg-secondary">
                    Escopos: {(tok.scopes || []).join(", ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevokeToken(tok.id)}
                  className="text-fg-muted hover:text-red-500 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* 3. Signed HMAC Webhooks */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Webhook className="w-4 h-4 text-brand-text" />
              Webhooks de Saída Assinados (HMAC-SHA256)
            </h3>
            <Badge variant="default">{webhooks.length} ativos</Badge>
          </div>

          <form onSubmit={handleCreateWebhook} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nome da Integração"
                required
                placeholder="Ex: Automação n8n / Slack"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
              />
              <Input
                label="URL de Destino (HTTPS)"
                type="url"
                required
                placeholder="https://hooks.exemplo.com/comnois"
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Registrar Webhook
            </Button>
          </form>

          <div className="space-y-2 max-h-44 overflow-y-auto pt-2 border-t border-border-subtle">
            {webhooks.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-elevated/60 border border-border-subtle text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-fg">{w.name}</div>
                  <div className="text-[11px] text-fg-muted truncate">
                    {w.targetUrl}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteWebhook(w.id)}
                  className="text-fg-muted hover:text-red-500 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        {/* 4. Collaborative Workspaces & RBAC Invitations */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-text" />
              Workspaces Colaborativos & Convites RBAC
            </h3>
            <Badge variant="brand">{workspaceList.length} ativo(s)</Badge>
          </div>

          <form onSubmit={handleCreateWorkspace} className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label="Novo Workspace de Equipe"
                required
                placeholder="Ex: Pesquisa & Desenvolvimento"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Criar
            </Button>
          </form>

          {workspaceList.length > 0 && (
            <>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {workspaceList.map((ws) => {
                  const isActiveWs = activeWorkspaceId === ws.id;
                  return (
                    <div
                      key={ws.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-elevated/60 border border-border-subtle text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-fg truncate">
                          {ws.name}
                        </span>
                        <Badge variant={isActiveWs ? "brand" : "default"}>
                          {ws.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onSelectWorkspaceId && (
                          <button
                            type="button"
                            onClick={() =>
                              onSelectWorkspaceId(isActiveWs ? "" : ws.id)
                            }
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                              isActiveWs
                                ? "bg-brand text-white"
                                : "bg-inset text-fg-secondary hover:text-fg border border-border-subtle"
                            }`}
                          >
                            {isActiveWs ? "Ativo (Sair do Foco)" : "Ativar"}
                          </button>
                        )}
                        {ws.role === "owner" ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteWorkspace(ws.id)}
                            title="Excluir workspace preservando itens no acervo pessoal"
                            className="text-fg-muted hover:text-red-500 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleLeaveWorkspace(ws.id)}
                            title="Sair do workspace preservando itens autorais"
                            className="text-fg-muted hover:text-amber-500 p-1 cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <form
                onSubmit={handleInviteMember}
                className="space-y-2 pt-2 border-t border-border-subtle"
              >
                <div className="text-xs font-semibold text-fg-secondary flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-brand-text" />
                  Convidar Membro para Workspace
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={inviteWorkspaceId || workspaceList[0]?.id || ""}
                    onChange={(e) => setInviteWorkspaceId(e.target.value)}
                    className="rounded-xl bg-inset border border-border-subtle px-2.5 py-1.5 text-xs text-fg"
                  >
                    {workspaceList.map((ws) => (
                      <option key={ws.id} value={ws.id}>
                        {ws.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="email"
                    required
                    placeholder="membro@equipe.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="rounded-xl bg-inset border border-border-subtle px-2.5 py-1.5 text-xs text-fg"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as "member" | "admin")
                    }
                    className="rounded-xl bg-inset border border-border-subtle px-2.5 py-1.5 text-xs text-fg"
                  >
                    <option value="member">Papel: Member</option>
                    <option value="admin">Papel: Admin</option>
                  </select>
                </div>
                <Button type="submit" size="xs" variant="secondary">
                  Gerar Token de Convite
                </Button>
              </form>
            </>
          )}

          {generatedInviteToken && (
            <div className="p-2.5 rounded-xl bg-brand-soft/40 border border-brand/30 text-xs">
              <span className="font-semibold text-brand-text">
                Token de convite:
              </span>{" "}
              <code className="font-mono text-fg break-all">
                {generatedInviteToken}
              </code>
            </div>
          )}

          <form
            onSubmit={handleAcceptInvite}
            className="flex gap-2 items-end pt-2 border-t border-border-subtle"
          >
            <div className="flex-1">
              <Input
                label="Aceitar convite recebido (Token)"
                placeholder="Cole o token de convite..."
                value={acceptInviteToken}
                onChange={(e) => setAcceptInviteToken(e.target.value)}
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Aceitar
            </Button>
          </form>
        </Card>
      </div>

      {/* Bottom Row: Active Sessions + Audit Trail + LGPD Right to Erasure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-text" />
              Sessões Ativas ({workspacesData?.sessions?.length ?? 0}) & Trilha
              de Auditoria
            </h3>
            <Button
              size="xs"
              variant="secondary"
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              onClick={handleRevokeAllSessions}
            >
              Revogar Sessões
            </Button>
          </div>

          <div className="space-y-2 max-h-36 overflow-y-auto">
            {(workspacesData?.sessions || []).map((sess) => (
              <div
                key={sess.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-elevated/60 border border-border-subtle text-xs"
              >
                <div className="truncate">
                  <div className="font-semibold text-fg truncate">
                    {sess.userAgent || "Navegador Web / Sessão Autenticada"}
                  </div>
                  <div className="text-[11px] text-fg-muted">
                    IP: {sess.ipAddress || "local"} • Expira em{" "}
                    {new Date(sess.expiresAt).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Badge variant="success">Ativa</Badge>
              </div>
            ))}
          </div>

          {(workspacesData?.auditLogs || []).length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border-subtle">
              <div className="text-xs font-semibold text-fg-secondary flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-brand-text" />
                Eventos Recentes de Auditoria
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {(workspacesData?.auditLogs || []).slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-inset border border-border-subtle"
                  >
                    <span className="font-mono text-fg">{log.action}</span>
                    <span className="text-fg-muted">
                      {new Date(log.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card
          padding="lg"
          className="space-y-3 border-red-500/30 bg-red-500/5 flex flex-col justify-between"
        >
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Zona de Exclusão Total (Direito ao Esquecimento LGPD / GDPR)
            </h3>
            <p className="text-xs text-fg-secondary leading-relaxed">
              Remove permanentemente sua conta, sessões, tokens, coleções, itens, chunks vetoriais e apaga fisicamente todos os seus blobs binários do armazenamento privado.
            </p>
          </div>
          <form
            onSubmit={handleLgpdDeleteAccount}
            className="flex flex-col sm:flex-row gap-2 pt-2"
          >
            <input
              type="password"
              placeholder="Confirme sua senha atual para excluir a conta"
              value={lgpdConfirm}
              onChange={(e) => setLgpdConfirm(e.target.value)}
              className="flex-1 rounded-xl bg-inset border border-red-500/40 px-3 py-2 text-xs text-fg"
            />
            <Button type="submit" size="sm" variant="danger">
              Apagar Tudo Permanentemente
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
