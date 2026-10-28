"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { CaptureBarModal } from "@/components/workspace/CaptureBarModal";
import { LibraryTab } from "@/components/workspace/LibraryTab";
import { ItemDetailDrawer } from "@/components/workspace/ItemDetailDrawer";
import {
  AssistantTab,
  type ConversationSummary,
} from "@/components/workspace/AssistantTab";
import {
  OrganizationTab,
  type AutomationRuleItem,
  type FeedSubscriptionItem,
} from "@/components/workspace/OrganizationTab";
import { JobsAndHealthTab } from "@/components/workspace/JobsAndHealthTab";
import { PortabilityTab } from "@/components/workspace/PortabilityTab";
import {
  SettingsAndSecurityTab,
  type ApiTokenItem,
  type WebhookItem,
} from "@/components/workspace/SettingsAndSecurityTab";
import type {
  AiConfigData,
  AiUsageData,
  AssistantAnswer,
  BenchmarkReportData,
  CollectionInfo,
  HealthDiagnosticsData,
  ItemDetailData,
  QueueMetricsData,
  SearchItem,
  TagInfo,
  UserInfo,
  WorkspaceTabId,
  WorkspacesSettingsData,
} from "@/types/platform";

export default function PlatformWorkspaceClient({
  initialUser,
}: {
  initialUser: UserInfo;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<WorkspaceTabId>("library");
  const [showCaptureForm, setShowCaptureForm] = useState(false);

  // Toast feedback
  const [feedback, setFeedback] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);

  const showToast = useCallback((message: string, isError = false) => {
    setFeedback({ message, isError });
    setTimeout(() => {
      setFeedback((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  // Library & Search state
  const [items, setItems] = useState<SearchItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [effectiveMode, setEffectiveMode] = useState("hybrid");
  const [loadingItems, setLoadingItems] = useState(false);
  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"hybrid" | "lexical" | "semantic">(
    "hybrid"
  );
  const [sortBy, setSortBy] = useState<
    "relevance" | "newest" | "oldest" | "title"
  >("newest");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [selectedTag, setSelectedTag] = useState("");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Active item detail drawer
  const [selectedItemDetail, setSelectedItemDetail] =
    useState<ItemDetailData | null>(null);

  // Taxonomy & Organization state
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [rules, setRules] = useState<AutomationRuleItem[]>([]);
  const [feeds, setFeeds] = useState<FeedSubscriptionItem[]>([]);

  // Assistant RAG state
  const [question, setQuestion] = useState("");
  const [scopeCollectionId, setScopeCollectionId] = useState("");
  const [scopeTag, setScopeTag] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);

  // Jobs, Health & Benchmark state
  const [queueMetrics, setQueueMetrics] = useState<QueueMetricsData | null>(
    null
  );
  const [healthData, setHealthData] = useState<HealthDiagnosticsData | null>(
    null
  );
  const [benchmarkReport, setBenchmarkReport] =
    useState<BenchmarkReportData | null>(null);

  // Settings & Security state
  const [aiConfig, setAiConfig] = useState<AiConfigData | null>(null);
  const [aiUsage, setAiUsage] = useState<AiUsageData | null>(null);
  const [workspacesData, setWorkspacesData] =
    useState<WorkspacesSettingsData | null>(null);
  const [apiTokens, setApiTokens] = useState<ApiTokenItem[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);

  // Loaders using exact existing API routes
  const loadLibrary = useCallback(async () => {
    setLoadingItems(true);
    try {
      const params = new URLSearchParams();
      const effectiveQuery = selectedTag
        ? `${query} #${selectedTag}`.trim()
        : query.trim();
      if (effectiveQuery) params.set("q", effectiveQuery);
      params.set("mode", searchMode);
      params.set("sortBy", sortBy === "title" ? "newest" : sortBy);
      params.set("pageSize", "50");
      if (filterType) params.set("type", filterType);
      if (filterStatus) {
        params.set(
          "processingStatus",
          filterStatus === "ready" ? "completed" : filterStatus
        );
      }
      if (selectedCollectionId) params.set("collectionId", selectedCollectionId);
      if (onlyFavorites) params.set("isFavorite", "true");
      if (includeArchived) params.set("includeArchived", "true");

      const res = await fetch(`/api/items?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || data.results || []);
        setTotalItems(data.total ?? 0);
        setEffectiveMode(data.effectiveMode || searchMode);
      }
    } finally {
      setLoadingItems(false);
    }
  }, [
    query,
    searchMode,
    sortBy,
    filterType,
    filterStatus,
    selectedCollectionId,
    selectedTag,
    onlyFavorites,
    includeArchived,
  ]);

  const loadOrganizationAndWorkspaceData = useCallback(async () => {
    const colRes = await fetch("/api/collections");
    if (colRes.ok) {
      const d = await colRes.json();
      setCollections(d.collections || []);
    }
    const tagRes = await fetch("/api/tags");
    if (tagRes.ok) {
      const d = await tagRes.json();
      setTags(d.tags || []);
    }
    const wsRes = await fetch("/api/workspaces");
    if (wsRes.ok) {
      const d = await wsRes.json();
      setWorkspacesData(d);
      setRules(d.automationRules || []);
      setFeeds(d.rssFeeds || []);
      setApiTokens(d.apiTokens || []);
      setWebhooks(d.webhooks || []);
    }
  }, []);

  const loadDiagnostics = useCallback(async () => {
    const jobsRes = await fetch("/api/jobs");
    if (jobsRes.ok) {
      setQueueMetrics(await jobsRes.json());
    }
    const healthRes = await fetch("/api/health");
    if (healthRes.ok) {
      setHealthData(await healthRes.json());
    }
  }, []);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/assistant");
    if (res.ok) {
      const d = await res.json();
      setConversations(d.conversations || []);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    const aiRes = await fetch("/api/settings/ai");
    if (aiRes.ok) {
      const d = await aiRes.json();
      setAiConfig(d.config || null);
      setAiUsage(d.usage || null);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!active) return;
      await loadOrganizationAndWorkspaceData();
      if (!active) return;
      await loadDiagnostics();
      if (!active) return;
      await loadConversations();
      if (!active) return;
      await loadSettings();
    })();
    return () => {
      active = false;
    };
  }, [
    loadOrganizationAndWorkspaceData,
    loadDiagnostics,
    loadConversations,
    loadSettings,
  ]);

  // Item detail loader
  async function openItemDetail(id: string) {
    const res = await fetch(`/api/items/${id}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedItemDetail(data);
    }
  }

  async function handleToggleFavoriteItem(item: SearchItem) {
    await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !item.isFavorite }),
    });
    await loadLibrary();
  }

  async function handleToggleArchiveItem(item: SearchItem) {
    await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !item.isArchived }),
    });
    await loadLibrary();
  }

  async function handleDeleteItem(id: string) {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    showToast("Item excluído da biblioteca.");
    await loadLibrary();
  }

  async function handleBatchAction(
    action:
      | "favorite"
      | "unfavorite"
      | "archive"
      | "unarchive"
      | "delete"
      | "addTag"
      | "addToCollection",
    extra?: { tagName?: string; collectionId?: string }
  ) {
    if (selectedItemIds.length === 0) return;
    const res = await fetch("/api/items/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemIds: selectedItemIds,
        action,
        ...extra,
      }),
    });
    if (res.ok) {
      showToast(
        `Ação em lote (${action}) aplicada a ${selectedItemIds.length} itens!`
      );
      setSelectedItemIds([]);
      await loadLibrary();
    }
  }

  // Assistant RAG handlers
  async function handleAskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          conversationId: selectedConversationId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Erro ao consultar assistente.");
      }
      setAnswer(data);
      if (data.conversationId) {
        setSelectedConversationId(data.conversationId);
      }
      await loadConversations();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erro ao processar pergunta RAG.",
        true
      );
    } finally {
      setAsking(false);
    }
  }

  async function handleSelectConversation(id: string) {
    setSelectedConversationId(id);
    const res = await fetch(`/api/assistant?conversationId=${id}`);
    if (res.ok) {
      const data = await res.json();
      const messages = data.conversation?.messages || data.messages || [];
      const lastAssistant = [...messages]
        .reverse()
        .find((m: { role: string }) => m.role === "assistant");
      if (lastAssistant) {
        setAnswer({
          question: lastAssistant.question || data.conversation?.title || "",
          answer: lastAssistant.content,
          directEvidenceSummary: [],
          synthesisNotes: [],
          citations: lastAssistant.citations || [],
          hasConflict: Boolean(lastAssistant.hasConflict),
          insufficientEvidence: Boolean(lastAssistant.insufficientEvidence),
          promptInjectionNeutralized: Boolean(
            lastAssistant.promptInjectionNeutralized
          ),
          scopeNote: data.conversation?.scopeSummary || "Histórico recuperado",
          providerUsed: lastAssistant.providerUsed || "recorded",
        });
      }
    }
  }

  async function handleDeleteConversation(id: string) {
    await fetch(`/api/assistant?conversationId=${id}`, { method: "DELETE" });
    if (selectedConversationId === id) {
      setSelectedConversationId(null);
    }
    await loadConversations();
  }

  async function handlePurgeOldConversations() {
    await fetch("/api/assistant?olderThanDays=30", {
      method: "DELETE",
    });
    showToast("Política de retenção aplicada ao histórico de conversas.");
    await loadConversations();
  }

  // Jobs & Benchmark handlers
  async function handleProcessQueue() {
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 20 }),
    });
    if (res.ok) {
      showToast("Fila de processamento executada!");
      await loadDiagnostics();
      await loadLibrary();
    }
  }

  async function handleReprocessItem(itemId: string) {
    const res = await fetch(`/api/items/${itemId}/retry`, {
      method: "POST",
    });
    if (res.ok) {
      showToast("Item reenfileirado e reprocessado!");
      await loadDiagnostics();
      await loadLibrary();
    }
  }

  async function handleRunBenchmark() {
    const res = await fetch("/api/health", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setBenchmarkReport(data.benchmark || data);
      showToast(
        "Benchmark quantitativo (Lexical vs Semântico vs Híbrido) concluído!"
      );
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/welcome");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col">
      <WorkspaceHeader
        user={initialUser}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        showCaptureForm={showCaptureForm}
        onToggleCaptureForm={() => setShowCaptureForm(!showCaptureForm)}
        pendingJobsCount={queueMetrics?.counts.pending ?? 0}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Global Feedback Toast */}
        {feedback && (
          <div
            role="status"
            className={`mb-5 p-3.5 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 shadow-sm ${
              feedback.isError
                ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.isError ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Collapsible Quick Capture Form */}
        {showCaptureForm && (
          <CaptureBarModal
            collections={collections}
            onClose={() => setShowCaptureForm(false)}
            onCreated={async () => {
              await loadLibrary();
              await loadOrganizationAndWorkspaceData();
              await loadDiagnostics();
            }}
            onFeedback={showToast}
          />
        )}

        {/* Active Workspace Tab */}
        {activeTab === "library" && (
          <LibraryTab
            items={items}
            totalItems={totalItems}
            effectiveMode={effectiveMode}
            loading={loadingItems}
            query={query}
            onQueryChange={setQuery}
            searchMode={searchMode}
            onSearchModeChange={setSearchMode}
            sortBy={sortBy}
            onSortByChange={setSortBy}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
            filterStatus={filterStatus}
            onFilterStatusChange={setFilterStatus}
            selectedCollectionId={selectedCollectionId}
            onSelectCollectionId={setSelectedCollectionId}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
            onlyFavorites={onlyFavorites}
            onToggleOnlyFavorites={() => setOnlyFavorites(!onlyFavorites)}
            includeArchived={includeArchived}
            onToggleIncludeArchived={() => setIncludeArchived(!includeArchived)}
            collections={collections}
            tags={tags}
            selectedItemIds={selectedItemIds}
            onToggleSelectItem={(id) =>
              setSelectedItemIds((prev) =>
                prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
              )
            }
            onSelectAllItems={() =>
              setSelectedItemIds(items.map((it) => it.id))
            }
            onClearSelection={() => setSelectedItemIds([])}
            onBatchAction={handleBatchAction}
            onOpenItemDetail={openItemDetail}
            onToggleFavoriteItem={handleToggleFavoriteItem}
            onToggleArchiveItem={handleToggleArchiveItem}
            onDeleteItem={handleDeleteItem}
            onResetFilters={() => {
              setQuery("");
              setFilterType("");
              setFilterStatus("");
              setSelectedCollectionId("");
              setSelectedTag("");
              setOnlyFavorites(false);
              setIncludeArchived(false);
            }}
            onIngestOfficialDocs={async () => {
              showToast("Importando e indexando os 28 documentos oficiais para sua conta...");
              const res = await fetch("/api/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "ingestDocs" }),
              });
              if (res.ok) {
                showToast("28 documentos oficiais importados e indexados na sua biblioteca!");
                await loadLibrary();
                await loadOrganizationAndWorkspaceData();
              } else {
                showToast("Erro ao importar documentação.", true);
              }
            }}
          />
        )}

        {activeTab === "assistant" && (
          <AssistantTab
            question={question}
            onQuestionChange={setQuestion}
            scopeCollectionId={scopeCollectionId}
            onScopeCollectionChange={setScopeCollectionId}
            scopeTag={scopeTag}
            onScopeTagChange={setScopeTag}
            collections={collections}
            tags={tags}
            asking={asking}
            answer={answer}
            onAskSubmit={handleAskSubmit}
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
            onDeleteConversation={handleDeleteConversation}
            onPurgeOldConversations={handlePurgeOldConversations}
            onOpenCitedItem={openItemDetail}
          />
        )}

        {activeTab === "organization" && (
          <OrganizationTab
            collections={collections}
            tags={tags}
            rules={rules}
            feeds={feeds}
            onRefreshAll={async () => {
              await loadOrganizationAndWorkspaceData();
              await loadLibrary();
            }}
            onFeedback={showToast}
          />
        )}

        {activeTab === "jobs" && (
          <JobsAndHealthTab
            queueMetrics={queueMetrics}
            healthData={healthData}
            benchmarkReport={benchmarkReport}
            onProcessQueue={handleProcessQueue}
            onReprocessItem={handleReprocessItem}
            onRunBenchmark={handleRunBenchmark}
            onRefreshDiagnostics={loadDiagnostics}
            onFeedback={showToast}
          />
        )}

        {activeTab === "portability" && (
          <PortabilityTab
            onRefreshLibrary={loadLibrary}
            onFeedback={showToast}
          />
        )}

        {activeTab === "settings" && (
          <SettingsAndSecurityTab
            aiConfig={aiConfig}
            aiUsage={aiUsage}
            workspacesData={workspacesData}
            apiTokens={apiTokens}
            webhooks={webhooks}
            onRefreshSettings={loadSettings}
            onFeedback={showToast}
            onAccountDeleted={() => {
              router.push("/welcome");
              router.refresh();
            }}
          />
        )}
      </main>

      {/* Slide-over Item Reader & Editor Drawer */}
      <ItemDetailDrawer
        item={selectedItemDetail}
        onClose={() => setSelectedItemDetail(null)}
        onOpenOtherItem={openItemDetail}
        onReloadItem={openItemDetail}
        onRefreshLibrary={loadLibrary}
        onFeedback={showToast}
      />
    </div>
  );
}
