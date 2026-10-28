"use client";

import React, { useState } from "react";
import {
  Cpu,
  KeyRound,
  Webhook,
  Users,
  ShieldAlert,
  Plus,
  Trash2,
  Save,
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
  onRefreshSettings,
  onFeedback,
  onAccountDeleted,
}: SettingsAndSecurityTabProps) {
  const [provider, setProvider] = useState(
    aiConfig?.preferredProvider || "deterministic"
  );
  const [autoTagging, setAutoTagging] = useState(
    aiConfig?.autoTaggingEnabled ?? true
  );
  const [dailyLimit, setDailyLimit] = useState(
    String(aiConfig?.dailyTokenLimit ?? 100000)
  );

  // Scoped API Token state
  const [tokenName, setTokenName] = useState("");
  const [tokenScopes, setTokenScopes] = useState("read,write");
  const [newlyGeneratedToken, setNewlyGeneratedToken] = useState<string | null>(
    null
  );

  // Webhook state
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whSecret, setWhSecret] = useState("");

  // Workspace state
  const [wsName, setWsName] = useState("");

  // LGPD Delete confirmation
  const [lgpdConfirm, setLgpdConfirm] = useState("");

  async function handleSaveAiSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: provider === "deterministic" ? "extractive" : provider,
          autoSuggestTags: autoTagging,
          dailyTokenLimit: Number(dailyLimit) || 100000,
        }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar configurações de IA.");
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
          events: ["item.created", "item.indexed"],
        }),
      });
      if (!res.ok) throw new Error("Erro ao criar webhook HMAC.");
      setWhName("");
      setWhUrl("");
      setWhSecret("");
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. AI Provider & Token Budget */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <Cpu className="w-4 h-4 text-brand-text" />
            Provedor de IA & Orçamento Diário de Tokens
          </h3>
          <Badge variant="brand">
            Usado hoje: {aiUsage?.totalTokensToday ?? 0} tokens
          </Badge>
        </div>

        <form onSubmit={handleSaveAiSettings} className="space-y-3">
          <Select
            label="Provedor Preferencial de Embeddings & RAG"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="deterministic">
              Local Determinístico (Zero Custo / Offline)
            </option>
            <option value="ollama">Ollama Local (Llama / Nomic Embed)</option>
            <option value="openai">OpenAI (text-embedding-3-small / GPT-4o-mini)</option>
            <option value="gemini">Google Gemini (text-embedding-004 / Gemini Flash)</option>
          </Select>

          <Input
            label="Limite diário de tokens (proteção de orçamento)"
            type="number"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(e.target.value)}
          />

          <label className="flex items-center gap-2 text-xs text-fg-secondary">
            <input
              type="checkbox"
              checked={autoTagging}
              onChange={(e) => setAutoTagging(e.target.checked)}
            />
            Habilitar sugestão automática de tags por IA na captura
          </label>

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
              label="Escopos (read, write, admin)"
              value={tokenScopes}
              onChange={(e) => setTokenScopes(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
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

        <div className="space-y-2 max-h-44 overflow-y-auto pt-2 border-t border-border-subtle">
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
          <Button type="submit" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Registrar Webhook
          </Button>
        </form>

        <div className="space-y-2 max-h-40 overflow-y-auto pt-2 border-t border-border-subtle">
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

      {/* 4. Collaborative Workspaces & LGPD Right to Erasure */}
      <div className="space-y-6">
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-text" />
              Workspaces Colaborativos & RBAC
            </h3>
            <Badge variant="brand">
              {(workspacesData?.owned || workspacesData?.workspaces || []).length} ativo(s)
            </Badge>
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
            <Button type="submit" size="md" leftIcon={<Plus className="w-4 h-4" />}>
              Criar
            </Button>
          </form>
        </Card>

        <Card
          padding="lg"
          className="space-y-3 border-red-500/30 bg-red-500/5"
        >
          <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Zona de Exclusão Total (Direito ao Esquecimento LGPD / GDPR)
          </h3>
          <p className="text-xs text-fg-secondary">
            Remove permanentemente sua conta, sessões, itens, chunks vetoriais e blobs órfãos do armazenamento físico.
          </p>
          <form
            onSubmit={handleLgpdDeleteAccount}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="text"
              placeholder="Digite EXCLUIR MINHA CONTA"
              value={lgpdConfirm}
              onChange={(e) => setLgpdConfirm(e.target.value)}
              className="flex-1 rounded-xl bg-inset border border-red-500/40 px-3 py-1.5 text-xs text-fg"
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
