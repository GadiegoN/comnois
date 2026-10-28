"use client";

import React, { useState } from "react";
import {
  FolderTree,
  Tags,
  Wand2,
  Rss,
  Plus,
  Trash2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import type { CollectionInfo, TagInfo } from "@/types/platform";

export interface AutomationRuleItem {
  id: string;
  name: string;
  isActive: boolean;
  triggerOn: string;
  conditions: {
    domainContains?: string;
    titleContains?: string;
    itemType?: string;
  };
  actions: {
    addTags?: string[];
    markFavorite?: boolean;
  };
}

export interface FeedSubscriptionItem {
  id: string;
  title: string;
  feedUrl: string;
  isActive: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
}

interface OrganizationTabProps {
  collections: CollectionInfo[];
  tags: TagInfo[];
  rules: AutomationRuleItem[];
  feeds: FeedSubscriptionItem[];
  onRefreshAll: () => Promise<void>;
  onFeedback: (msg: string, isError?: boolean) => void;
}

export function OrganizationTab({
  collections,
  tags,
  rules,
  feeds,
  onRefreshAll,
  onFeedback,
}: OrganizationTabProps) {
  // Collection state
  const [colName, setColName] = useState("");
  const [colDesc, setColDesc] = useState("");
  const [isSmart, setIsSmart] = useState(false);
  const [smartQuery, setSmartQuery] = useState("");

  // Tag state
  const [tagName, setTagName] = useState("");

  // Automation Rule state
  const [ruleName, setRuleName] = useState("");
  const [domainContains, setDomainContains] = useState("");
  const [titleContains, setTitleContains] = useState("");
  const [ruleTags, setRuleTags] = useState("");
  const [ruleFav, setRuleFav] = useState(false);

  // RSS Feed state
  const [feedTitle, setFeedTitle] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [syncingFeeds, setSyncingFeeds] = useState(false);

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: colName.trim(),
          description: colDesc.trim() || undefined,
          type: isSmart ? "smart" : "manual",
          smartRules: isSmart ? { query: smartQuery.trim() } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Erro ao criar coleção.");
      }
      setColName("");
      setColDesc("");
      setSmartQuery("");
      onFeedback("Coleção criada com sucesso!");
      await onRefreshAll();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao criar coleção.",
        true
      );
    }
  }

  async function handleDeleteCollection(id: string) {
    await fetch(`/api/collections?collectionId=${id}`, { method: "DELETE" });
    await onRefreshAll();
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "note",
          title: `Tag #${tagName.trim()}`,
          noteText: `Nota de referência para a tag #${tagName.trim()}.`,
          tags: [tagName.trim()],
        }),
      });
      if (!res.ok) throw new Error("Falha ao criar tag.");
      setTagName("");
      onFeedback("Tag criada!");
      await onRefreshAll();
    } catch (err) {
      onFeedback(err instanceof Error ? err.message : "Erro ao criar tag.", true);
    }
  }

  async function handleDeleteTag(id: string) {
    await fetch(`/api/tags?tagId=${id}`, { method: "DELETE" });
    await onRefreshAll();
  }

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createAutomationRule",
          name: ruleName.trim(),
          conditions: {
            domainContains: domainContains.trim() || undefined,
            titleContains: titleContains.trim() || undefined,
          },
          actions: {
            addTags: ruleTags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            markFavorite: ruleFav,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Falha ao criar regra.");
      }
      setRuleName("");
      setDomainContains("");
      setTitleContains("");
      setRuleTags("");
      setRuleFav(false);
      onFeedback("Regra determinística ativada!");
      await onRefreshAll();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao criar regra.",
        true
      );
    }
  }

  async function handleDeleteRule(id: string) {
    await fetch(`/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteAutomationRule", ruleId: id }),
    });
    await onRefreshAll();
  }

  async function handleCreateFeed(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createRssFeed",
          title: feedTitle.trim(),
          feedUrl: feedUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Erro ao cadastrar feed RSS.");
      }
      setFeedTitle("");
      setFeedUrl("");
      onFeedback("Feed RSS/Atom cadastrado!");
      await onRefreshAll();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao adicionar feed.",
        true
      );
    }
  }

  async function handleSyncFeeds() {
    setSyncingFeeds(true);
    try {
      for (const f of feeds) {
        await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "syncRssFeed", feedId: f.id }),
        });
      }
      onFeedback("Sincronização de feeds concluída!");
      await onRefreshAll();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Falha ao sincronizar feeds.",
        true
      );
    } finally {
      setSyncingFeeds(false);
    }
  }

  async function handleDeleteFeed(id: string) {
    await fetch(`/api/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deleteRssFeed", feedId: id }),
    });
    await onRefreshAll();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Collections & Smart Collections */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-brand-text" />
            Coleções & Smart Collections ({collections.length})
          </h3>
          <Badge variant="brand">Hierárquicas + Dinâmicas</Badge>
        </div>

        <form onSubmit={handleCreateCollection} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Nome da coleção"
              required
              placeholder="Ex: Artigos de RAG"
              value={colName}
              onChange={(e) => setColName(e.target.value)}
            />
            <Input
              label="Descrição (opcional)"
              placeholder="Referências técnicas..."
              value={colDesc}
              onChange={(e) => setColDesc(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-fg-secondary">
            <input
              id="smart-col-toggle"
              type="checkbox"
              checked={isSmart}
              onChange={(e) => setIsSmart(e.target.checked)}
              className="rounded border-border-subtle"
            />
            <label htmlFor="smart-col-toggle">
              Smart Collection (atualizada automaticamente via Query DSL)
            </label>
          </div>

          {isSmart && (
            <Input
              label="Query DSL da Smart Collection"
              required
              placeholder="Ex: #arquitetura type:note is:fav"
              value={smartQuery}
              onChange={(e) => setSmartQuery(e.target.value)}
            />
          )}

          <Button
            type="submit"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Criar Coleção
          </Button>
        </form>

        <div className="space-y-2 max-h-60 overflow-y-auto pt-2 border-t border-border-subtle">
          {collections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-elevated/60 border border-border-subtle"
            >
              <div>
                <div className="text-xs font-semibold text-fg flex items-center gap-1.5">
                  {c.isSmartCollection && (
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span>{c.name}</span>
                  <Badge variant="default">{c.itemCount ?? 0} itens</Badge>
                </div>
                {c.smartQuery && (
                  <div className="text-[11px] font-mono text-brand-text">
                    Query: {c.smartQuery}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteCollection(c.id)}
                className="text-fg-muted hover:text-red-500 p-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* 2. Tags Taxonomy */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <Tags className="w-4 h-4 text-brand-text" />
            Taxonomia de Tags ({tags.length})
          </h3>
          <Badge variant="purple">Manuais + IA</Badge>
        </div>

        <form onSubmit={handleCreateTag} className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              label="Nova tag normalizada"
              required
              placeholder="Ex: seguranca-lgpd"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
            />
          </div>
          <Button type="submit" size="md" leftIcon={<Plus className="w-4 h-4" />}>
            Criar Tag
          </Button>
        </form>

        <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pt-2 border-t border-border-subtle">
          {tags.map((t) => (
            <div
              key={t.id}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-elevated border border-border-subtle text-xs"
            >
              <span className="font-medium text-fg">#{t.name}</span>
              <span className="text-[10px] text-fg-muted">({t.itemCount})</span>
              <button
                type="button"
                onClick={() => handleDeleteTag(t.id)}
                className="text-fg-muted hover:text-red-500 ml-1 cursor-pointer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* 3. Deterministic Automation Rules */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-brand-text" />
            Regras de Automação Determinística ({rules.length})
          </h3>
          <Badge variant="success">Auto-Tagging na Captura</Badge>
        </div>

        <form onSubmit={handleCreateRule} className="space-y-3">
          <Input
            label="Nome da regra"
            required
            placeholder="Ex: Taguear repositórios do GitHub"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Se o domínio contiver"
              placeholder="github.com"
              value={domainContains}
              onChange={(e) => setDomainContains(e.target.value)}
            />
            <Input
              label="Ou se o título contiver"
              placeholder="RFC, Paper, Benchmark"
              value={titleContains}
              onChange={(e) => setTitleContains(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <Input
              label="Aplicar tags (separadas por vírgula)"
              placeholder="codigo, opensource"
              value={ruleTags}
              onChange={(e) => setRuleTags(e.target.value)}
            />
            <label className="flex items-center gap-2 text-xs text-fg-secondary pb-2">
              <input
                type="checkbox"
                checked={ruleFav}
                onChange={(e) => setRuleFav(e.target.checked)}
              />
              Marcar automaticamente como Favorito
            </label>
          </div>
          <Button type="submit" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Adicionar Regra
          </Button>
        </form>

        <div className="space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-border-subtle">
          {rules.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-elevated/60 border border-border-subtle text-xs"
            >
              <div>
                <div className="font-semibold text-fg">{r.name}</div>
                <div className="text-[11px] text-fg-secondary">
                  Tags: {(r.actions?.addTags || []).join(", ") || "Nenhuma"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteRule(r.id)}
                className="text-fg-muted hover:text-red-500 p-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* 4. RSS / Atom Feed Subscriptions */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <Rss className="w-4 h-4 text-brand-text" />
            Assinaturas de Feeds RSS / Atom ({feeds.length})
          </h3>
          <Button
            size="xs"
            variant="secondary"
            disabled={syncingFeeds}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={handleSyncFeeds}
          >
            {syncingFeeds ? "Sincronizando..." : "Sincronizar Agora"}
          </Button>
        </div>

        <form onSubmit={handleCreateFeed} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Título do Feed"
              required
              placeholder="Ex: Blog Engenharia"
              value={feedTitle}
              onChange={(e) => setFeedTitle(e.target.value)}
            />
            <Input
              label="URL do XML (RSS / Atom)"
              type="url"
              required
              placeholder="https://exemplo.com/feed.xml"
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
            Assinar Feed
          </Button>
        </form>

        <div className="space-y-2 max-h-48 overflow-y-auto pt-2 border-t border-border-subtle">
          {feeds.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-elevated/60 border border-border-subtle text-xs"
            >
              <div className="min-w-0">
                <div className="font-semibold text-fg truncate">{f.title}</div>
                <div className="text-[11px] text-fg-muted truncate">
                  {f.feedUrl}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteFeed(f.id)}
                className="text-fg-muted hover:text-red-500 p-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

