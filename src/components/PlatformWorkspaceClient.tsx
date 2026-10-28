"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Link2,
  FileText,
  Upload,
  Search,
  Sparkles,
  FolderKanban,
  Tag,
  Activity,
  Download,
  Settings,
  LogOut,
  Star,
  Archive,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  ExternalLink,
  Plus,
  Highlighter,
  ShieldCheck,
  Key,
  Layers,
} from "lucide-react";

interface UserInfo {
  id: string;
  email: string;
  displayName: string;
  aiEnabled: boolean;
  dailyTokenLimit: number;
}

interface SearchItem {
  id: string;
  type: "link" | "note" | "file" | "image";
  title: string;
  originalUrl: string | null;
  domain: string | null;
  summary: string | null;
  processingStatus: string;
  processingError: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  tags: Array<{ id: string; name: string; source: string }>;
  snippet?: string;
  score: number;
}

interface CollectionInfo {
  id: string;
  parentId?: string | null;
  name: string;
  description: string | null;
  type?: "manual" | "smart";
  smartRules?: {
    query?: string;
    itemTypes?: string[];
    domainContains?: string;
    isFavorite?: boolean;
  } | null;
  itemCount: number;
}

interface TagInfo {
  id: string;
  name: string;
  normalizedName: string;
  itemCount: number;
}

interface VerifiedCitation {
  citationId: string;
  itemId: string;
  chunkId: string;
  title: string;
  originalUrl: string | null;
  domain: string | null;
  quote: string;
  locator: string;
  startOffset: number;
  endOffset: number;
}

interface AssistantAnswer {
  question: string;
  answer: string;
  directEvidenceSummary: string[];
  synthesisNotes: string[];
  citations: VerifiedCitation[];
  hasConflict: boolean;
  conflictExplanation?: string;
  insufficientEvidence: boolean;
  promptInjectionNeutralized: boolean;
  scopeNote: string;
  providerUsed: string;
}

export default function PlatformWorkspaceClient({
  initialUser,
}: {
  initialUser: UserInfo;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "library" | "assistant" | "organization" | "jobs" | "portability" | "settings"
  >("library");

  // Library & Search State
  const [items, setItems] = useState<SearchItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"lexical" | "semantic" | "hybrid">("lexical");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [collectionFilter, setCollectionFilter] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "updated" | "relevance">("newest");

  // Batch Selection
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  // Capture Modal State
  const [captureMode, setCaptureMode] = useState<"link" | "note" | "file" | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [captureTitle, setCaptureTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [captureTags, setCaptureTags] = useState("");
  const [captureCollectionId, setCaptureCollectionId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureFeedback, setCaptureFeedback] = useState<{
    type: "success" | "warning" | "error";
    text: string;
  } | null>(null);

  // Detail Drawer State
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [itemDetail, setItemDetail] = useState<{
    item: SearchItem & { contentVersion: number };
    content: { noteText: string | null; extractedText: string | null; extractionOrigin: string } | null;
    assets: Array<{ id: string; originalFileName: string; mimeType: string; sizeBytes: number; downloadUrl: string }>;
    tags: Array<{ id: string; name: string; source: string; isConfirmed?: boolean }>;
    collections: Array<{ id: string; name: string }>;
    highlights: Array<{ id: string; quote: string; note: string | null }>;
    jobs: Array<{ id: string; jobType: string; status: string; attempts: number; lastError: string | null }>;
    relatedItems?: Array<{
      id: string;
      type: string;
      title: string;
      originalUrl: string | null;
      domain: string | null;
      similarityScore: number;
      sharedTags: string[];
      connectionReason: string;
    }>;
  } | null>(null);
  const [highlightQuote, setHighlightQuote] = useState("");
  const [highlightNote, setHighlightNote] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");

  // Organization State
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [newCollectionParentId, setNewCollectionParentId] = useState("");
  const [newCollectionType, setNewCollectionType] = useState<"manual" | "smart">("manual");
  const [smartRuleQuery, setSmartRuleQuery] = useState("");
  const [smartRuleDomain, setSmartRuleDomain] = useState("");
  const [smartRuleType, setSmartRuleType] = useState("");
  const [smartRuleFav, setSmartRuleFav] = useState(false);

  // Automation Rule Form State
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleDomain, setNewRuleDomain] = useState("");
  const [newRuleTags, setNewRuleTags] = useState("");
  const [newRuleFavorite, setNewRuleFavorite] = useState(false);

  // Assistant State
  const [question, setQuestion] = useState("");
  const [askingAssistant, setAskingAssistant] = useState(false);
  const [assistantResult, setAssistantResult] = useState<AssistantAnswer | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);
  const [assistantConversations, setAssistantConversations] = useState<
    Array<{ id: string; title: string; updatedAt: string }>
  >([]);

  // Jobs State
  const [queueMetrics, setQueueMetrics] = useState<{
    counts: Record<string, number>;
    oldestPendingAgeMs: number;
    recentJobs: Array<{
      id: string;
      jobType: string;
      status: string;
      attempts: number;
      maxAttempts: number;
      lastError: string | null;
      createdAt: string;
    }>;
  } | null>(null);
  const [runningWorker, setRunningWorker] = useState(false);
  const [healthDiagnostics, setHealthDiagnostics] = useState<{
    status: string;
    database: { connected: boolean; latencyMs: number };
    storage: { totalFiles: number; totalBytes: number; integrityVerifiedCount: number; missingBlobsCount: number };
    embeddingIndex?: {
      totalActiveItems: number;
      totalChunks: number;
      embeddedChunksCount: number;
      missingEmbeddingsCount: number;
      coveragePercent: number;
      configuredProvider: string;
      configuredModel: string;
      configuredDimensions: number;
      hasModelDrift: boolean;
      hasDimensionMismatch: boolean;
      estimatedTokensToReembed: number;
      recommendation: string;
    };
  } | null>(null);
  const [benchmarkReport, setBenchmarkReport] = useState<{
    modes: Record<"lexical" | "semantic" | "hybrid", { recallAt3: number; mrr: number }>;
    ragEvaluation: { citationAccuracyRate: number };
  } | null>(null);
  const [runningBenchmark, setRunningBenchmark] = useState(false);

  // Portability State
  const [importJsonText, setImportJsonText] = useState("");
  const [duplicatePolicy, setDuplicatePolicy] = useState<"skip" | "overwrite" | "append">("skip");
  const [importPreview, setImportPreview] = useState<{
    formatDetected: string;
    totalReceived: number;
    validItemsCount: number;
    newItemsCount: number;
    existingDuplicatesCount: number;
    collectionsDetected: string[];
    sampleTitles: string[];
  } | null>(null);
  const [importReport, setImportReport] = useState<{
    totalReceived: number;
    createdCount: number;
    duplicateCount: number;
    overwrittenCount: number;
    skippedCount: number;
    failedCount: number;
  } | null>(null);

  // AI & Settings State
  const [aiConfig, setAiConfig] = useState<{
    provider: "extractive" | "openai" | "ollama";
    baseUrl: string | null;
    hasApiKey: boolean;
    maskedApiKey: string;
    chatModel: string;
    embeddingModel: string;
    embeddingDimensions: number;
    isEnabled: boolean;
    autoSummarize: boolean;
    autoSuggestTags: boolean;
  } | null>(null);
  const [aiUsage, setAiUsage] = useState<{
    totalTokensToday: number;
    dailyTokenLimit: number;
    estimatedCostUsd: number;
    operationsCount: number;
  } | null>(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [workspacesData, setWorkspacesData] = useState<{
    workspaces: Array<{ workspaceId: string; name: string; role: string; isPersonal: boolean }>;
    apiTokens: Array<{ id: string; name: string; tokenPrefix: string; scopes?: string[]; revokedAt: string | null }>;
    automationRules: Array<{ id: string; name: string }>;
    webhooks?: Array<{
      id: string;
      name: string;
      targetUrl: string;
      events: string[];
      maskedSecret: string;
      recentDeliveries?: Array<{ id: string; eventType: string; success: boolean; statusCode: number | null }>;
    }>;
    rssFeeds?: Array<{
      id: string;
      title: string;
      feedUrl: string;
      itemsImportedCount: number;
      lastSyncedAt: string | null;
      lastError: string | null;
    }>;
    sessions?: Array<{
      id: string;
      ipAddress: string | null;
      userAgent: string | null;
      expiresAt: string;
      revokedAt: string | null;
      createdAt: string;
    }>;
    auditLogs?: Array<{
      id: string;
      action: string;
      targetType: string;
      createdAt: string;
    }>;
  } | null>(null);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenScopes, setNewTokenScopes] = useState<"read,write" | "read">("read,write");
  const [generatedRawToken, setGeneratedRawToken] = useState<string | null>(null);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newWebhookName, setNewWebhookName] = useState("");
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [generatedWebhookSecret, setGeneratedWebhookSecret] = useState<string | null>(null);
  const [newRssUrl, setNewRssUrl] = useState("");
  const [newRssTags, setNewRssTags] = useState("");
  const [syncingRssId, setSyncingRssId] = useState<string | null>(null);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");

  const loadOrganization = useCallback(async () => {
    try {
      const [colRes, tagRes] = await Promise.all([
        fetch("/api/collections"),
        fetch("/api/tags"),
      ]);
      if (colRes.ok) {
        const d = await colRes.json();
        setCollections(d.collections ?? []);
      }
      if (tagRes.ok) {
        const d = await tagRes.json();
        setTags(d.tags ?? []);
      }
    } catch {
      // ignore background load error
    }
  }, []);

  const loadLibrary = useCallback(async () => {
    setLoadingLibrary(true);
    setLibraryError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("mode", searchMode);
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("processingStatus", statusFilter);
      if (collectionFilter) params.set("collectionId", collectionFilter);
      if (selectedTagIds.length > 0) params.set("tagIds", selectedTagIds.join(","));
      if (onlyFavorites) params.set("isFavorite", "true");
      if (showArchived) params.set("isArchived", "true");
      params.set("pageSize", "50");
      params.set("sortBy", query.trim() && sortBy === "relevance" ? "relevance" : sortBy === "relevance" ? "newest" : sortBy);

      const res = await fetch(`/api/items?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Erro ao carregar biblioteca.");
      }
      setItems(data.results ?? []);
      setTotalItems(data.total ?? 0);
      setFallbackNotice(data.fallbackReason ?? null);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : "Falha na consulta.");
    } finally {
      setLoadingLibrary(false);
    }
  }, [
    query,
    searchMode,
    typeFilter,
    statusFilter,
    collectionFilter,
    selectedTagIds,
    onlyFavorites,
    showArchived,
    sortBy,
  ]);

  useEffect(() => {
    void loadLibrary();
    void loadOrganization();
  }, [loadLibrary, loadOrganization]);

  async function openItemDetail(itemId: string) {
    setActiveItemId(itemId);
    const res = await fetch(`/api/items/${itemId}`);
    if (res.ok) {
      const data = await res.json();
      setItemDetail(data);
      setEditTitle(data.item.title);
      setEditSummary(data.item.summary ?? "");
      console.log("Items", data.item)
    }
  }

  async function handleCaptureSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCapturing(true);
    setCaptureFeedback(null);

    try {
      const tagArray = captureTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (captureMode === "file") {
        if (!uploadFile) {
          throw new Error("Selecione um arquivo permitido.");
        }
        const fd = new FormData();
        fd.append("file", uploadFile);
        if (captureTitle.trim()) fd.append("title", captureTitle.trim());
        if (captureTags.trim()) fd.append("tags", captureTags.trim());
        if (captureCollectionId) fd.append("collectionId", captureCollectionId);

        const res = await fetch("/api/items", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Falha no envio do arquivo.");
        }
        setCaptureFeedback({
          type: "success",
          text: "Arquivo armazenado em área privada e enviado para extração em segundo plano.",
        });
      } else if (captureMode === "note") {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "note",
            title: captureTitle.trim() || undefined,
            content: noteContent,
            tags: tagArray,
            collectionId: captureCollectionId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Erro ao salvar nota.");
        }
        setCaptureFeedback({
          type: "success",
          text: "Nota persistida e indexada imediatamente para pesquisa e RAG.",
        });
      } else if (captureMode === "link") {
        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "link",
            url: linkUrl,
            title: captureTitle.trim() || undefined,
            tags: tagArray,
            collectionId: captureCollectionId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Erro ao capturar link.");
        }
        if (data.duplicateWarning) {
          setCaptureFeedback({
            type: "warning",
            text: `${data.duplicateWarning.message} O novo registro foi salvo e agendado para processamento.`,
          });
        } else {
          setCaptureFeedback({
            type: "success",
            text: "Link registrado imediatamente. A extração de conteúdo foi enfileirada no worker.",
          });
        }
      }

      setLinkUrl("");
      setCaptureTitle("");
      setNoteContent("");
      setCaptureTags("");
      setUploadFile(null);
      await loadLibrary();
      await loadOrganization();
    } catch (err) {
      setCaptureFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Erro ao capturar item.",
      });
    } finally {
      setCapturing(false);
    }
  }

  async function handleToggleFavorite(item: SearchItem) {
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isFavorite: !item.isFavorite }),
    });
    if (res.ok) {
      await loadLibrary();
      if (activeItemId === item.id) await openItemDetail(item.id);
    }
  }

  async function handleToggleArchive(item: SearchItem) {
    const res = await fetch(`/api/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isArchived: !item.isArchived }),
    });
    if (res.ok) {
      await loadLibrary();
      if (activeItemId === item.id) await openItemDetail(item.id);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!window.confirm("Confirmar exclusão permanente deste item, seus arquivos, chunks e vetores?")) {
      return;
    }
    const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    if (res.ok) {
      if (activeItemId === itemId) {
        setActiveItemId(null);
        setItemDetail(null);
      }
      await loadLibrary();
      await loadOrganization();
    }
  }

  async function handleRetryItem(itemId: string) {
    const res = await fetch(`/api/items/${itemId}/retry`, { method: "POST" });
    if (res.ok) {
      await openItemDetail(itemId);
      await loadLibrary();
    }
  }

  async function handleBatchAction(action: "favorite" | "archive" | "delete") {
    if (selectedItemIds.length === 0) return;
    if (
      action === "delete" &&
      !window.confirm(`Confirmar exclusão de ${selectedItemIds.length} item(ns)?`)
    ) {
      return;
    }

    const res = await fetch("/api/items/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemIds: selectedItemIds, action }),
    });
    if (res.ok) {
      const data = await res.json();
      setBatchMessage(
        `Ação em lote concluída: ${data.processedIds.length} processado(s), ${data.failedItems.length} falha(s).`
      );
      setSelectedItemIds([]);
      await loadLibrary();
    }
  }

  async function loadAssistantConversations() {
    const res = await fetch("/api/assistant");
    if (res.ok) {
      const data = await res.json();
      setAssistantConversations(data.conversations ?? []);
    }
  }

  async function openAssistantConversation(conversationId: string) {
    const res = await fetch(`/api/assistant?conversationId=${conversationId}`);
    if (res.ok) {
      const data = await res.json();
      const msgs = data.messages ?? [];
      const userMsg = msgs.find((m: { role: string }) => m.role === "user");
      const assistantMsg = [...msgs]
        .reverse()
        .find((m: { role: string }) => m.role === "assistant");
      if (assistantMsg) {
        const meta = assistantMsg.metadataJson ?? {};
        setQuestion(userMsg?.content ?? data.conversation?.title ?? "");
        setAssistantResult({
          question: userMsg?.content ?? data.conversation?.title ?? "",
          answer: assistantMsg.content,
          directEvidenceSummary: meta.directEvidenceSummary ?? [],
          synthesisNotes: meta.synthesisNotes ?? [],
          citations: assistantMsg.citationsJson ?? [],
          hasConflict: Boolean(meta.hasConflict),
          conflictExplanation: meta.conflictExplanation,
          insufficientEvidence: Boolean(meta.insufficientEvidence),
          promptInjectionNeutralized: Boolean(meta.promptInjectionNeutralized),
          scopeNote: meta.scopeNote ?? "Conversa recuperada do histórico.",
          providerUsed: meta.providerUsed ?? "extractive",
        });
      }
    }
  }

  async function handleAskAssistant(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAskingAssistant(true);
    setAssistantError(null);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Falha ao consultar assistente.");
      }
      setAssistantResult(data);
      await loadAssistantConversations();
    } catch (err) {
      setAssistantError(err instanceof Error ? err.message : "Erro ao consultar IA.");
    } finally {
      setAskingAssistant(false);
    }
  }

  async function loadJobsData() {
    const [res, healthRes] = await Promise.all([
      fetch("/api/jobs"),
      fetch("/api/health"),
    ]);
    if (res.ok) {
      setQueueMetrics(await res.json());
    }
    if (healthRes.ok) {
      setHealthDiagnostics(await healthRes.json());
    }
  }

  async function runEvaluationBenchmark() {
    setRunningBenchmark(true);
    try {
      const res = await fetch("/api/health", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBenchmarkReport(data.benchmark);
      }
    } finally {
      setRunningBenchmark(false);
    }
  }

  async function triggerWorkerBatch(action?: "reindex" | "recoverStale") {
    setRunningWorker(true);
    try {
      await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await loadJobsData();
      await loadLibrary();
    } finally {
      setRunningWorker(false);
    }
  }

  async function loadSettingsData() {
    const [aiRes, wsRes] = await Promise.all([
      fetch("/api/settings/ai"),
      fetch("/api/workspaces"),
    ]);
    if (aiRes.ok) {
      const d = await aiRes.json();
      setAiConfig(d.config);
      setAiUsage(d.usage);
    }
    if (wsRes.ok) {
      setWorkspacesData(await wsRes.json());
    }
  }

  function renderStatusBadge(status: string) {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
            <CheckCircle2 className="w-3 h-3" /> Pronto
          </span>
        );
      case "processing":
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/60">
            <Clock className="w-3 h-3" /> {status === "pending" ? "Aguardando" : "Processando"}
          </span>
        );
      case "partial":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-950/80 text-blue-300 border border-blue-800/60">
            <AlertTriangle className="w-3 h-3" /> Parcial
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-950/80 text-red-300 border border-red-800/60">
            <XCircle className="w-3 h-3" /> Falhou
          </span>
        );
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white tracking-tight">Comnois Knowledge</span>
              <span className="hidden sm:inline-block ml-2 text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                PostgreSQL + RAG Verificável
              </span>
            </div>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("library")}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "library"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Layers className="w-4 h-4" /> Biblioteca
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("assistant");
                void loadAssistantConversations();
              }}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "assistant"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Sparkles className="w-4 h-4" /> Assistente IA
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("organization");
                void loadOrganization();
              }}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "organization"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <FolderKanban className="w-4 h-4" /> Coleções & Tags
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("jobs");
                void loadJobsData();
              }}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "jobs"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Activity className="w-4 h-4" /> Workers
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("portability")}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "portability"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Download className="w-4 h-4" /> Portabilidade
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("settings");
                void loadSettingsData();
              }}
              className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === "settings"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Settings className="w-4 h-4" /> IA & Conta
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs text-slate-400">
              {initialUser.displayName}
            </span>
            <button
              type="button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
                router.refresh();
              }}
              title="Encerrar sessão"
              className="p-2 rounded-lg bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {/* ================================================================
            TAB 1: BIBLIOTECA & CAPTURA
           ================================================================ */}
        {activeTab === "library" && (
          <div className="space-y-6">
            {/* Quick Capture Bar */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    Capturar para sua Biblioteca Privada
                  </h2>
                  <p className="text-xs text-slate-400">
                    Adicione links, escreva notas ou envie PDFs e imagens com validação anti-SSRF e indexação automática.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCaptureMode(captureMode === "link" ? null : "link");
                      setCaptureFeedback(null);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Link2 className="w-4 h-4" /> Salvar Link
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCaptureMode(captureMode === "note" ? null : "note");
                      setCaptureFeedback(null);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4" /> Nova Nota
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCaptureMode(captureMode === "file" ? null : "file");
                      setCaptureFeedback(null);
                    }}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4" /> Enviar Arquivo / PDF
                  </button>
                </div>
              </div>

              {captureFeedback && (
                <div
                  className={`mt-4 p-3 rounded-lg text-xs border ${
                    captureFeedback.type === "error"
                      ? "bg-red-950/60 border-red-800 text-red-200"
                      : captureFeedback.type === "warning"
                        ? "bg-amber-950/60 border-amber-800 text-amber-200"
                        : "bg-emerald-950/60 border-emerald-800 text-emerald-200"
                  }`}
                >
                  {captureFeedback.text}
                </div>
              )}

              {captureMode && (
                <form
                  onSubmit={handleCaptureSubmit}
                  className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {captureMode === "link" && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        URL da página (HTTP/HTTPS)
                      </label>
                      <input
                        type="url"
                        required
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://exemplo.com/artigo-tecnico"
                        className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
                      />
                    </div>
                  )}

                  {captureMode === "file" && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Arquivo permitido (PDF, TXT, MD, CSV, JSON, PNG, JPG, WEBP — máx. 25MB)
                      </label>
                      <input
                        type="file"
                        required
                        accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Título (opcional)
                    </label>
                    <input
                      type="text"
                      value={captureTitle}
                      onChange={(e) => setCaptureTitle(e.target.value)}
                      placeholder="Título personalizado"
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Etiquetas separadas por vírgula
                    </label>
                    <input
                      type="text"
                      value={captureTags}
                      onChange={(e) => setCaptureTags(e.target.value)}
                      placeholder="ex: arquitetura, postgres, estudo"
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>

                  {captureMode === "note" && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Conteúdo da nota
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={noteContent}
                        onChange={(e) => setNoteContent(e.target.value)}
                        placeholder="Escreva suas anotações, sínteses ou referências..."
                        className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Coleção (opcional)
                    </label>
                    <select
                      value={captureCollectionId}
                      onChange={(e) => setCaptureCollectionId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-white"
                    >
                      <option value="">Nenhuma coleção</option>
                      {collections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCaptureMode(null)}
                      className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={capturing}
                      className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white cursor-pointer"
                    >
                      {capturing ? "Salvando..." : "Confirmar Captura"}
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Search & Filters Bar */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Pesquisar por termos, título, domínio, conteúdo extraído ou conceito semântico..."
                    className="w-full pl-10 pr-4 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <select
                    aria-label="Modo de pesquisa"
                    value={searchMode}
                    onChange={(e) =>
                      setSearchMode(e.target.value as "lexical" | "semantic" | "hybrid")
                    }
                    className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="lexical">Busca Textual (Lexical)</option>
                    <option value="semantic">Busca Semântica (Vetorial)</option>
                    <option value="hybrid">Busca Híbrida (RRF)</option>
                  </select>

                  <select
                    aria-label="Ordenação"
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as "newest" | "oldest" | "updated" | "relevance"
                      )
                    }
                    className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
                  >
                    <option value="newest">Mais recentes</option>
                    <option value="oldest">Mais antigos</option>
                    <option value="updated">Atualizados recentemente</option>
                    {query.trim() && <option value="relevance">Relevância</option>}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300"
                >
                  <option value="">Todos os tipos</option>
                  <option value="link">Links</option>
                  <option value="note">Notas</option>
                  <option value="file">Arquivos / PDFs</option>
                  <option value="image">Imagens</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300"
                >
                  <option value="">Qualquer estado</option>
                  <option value="completed">Prontos</option>
                  <option value="pending">Aguardando</option>
                  <option value="processing">Processando</option>
                  <option value="partial">Parciais</option>
                  <option value="failed">Com falha</option>
                </select>

                <select
                  value={collectionFilter}
                  onChange={(e) => setCollectionFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-300"
                >
                  <option value="">Todas as coleções</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      Coleção: {c.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setOnlyFavorites(!onlyFavorites)}
                  className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                    onlyFavorites
                      ? "bg-amber-950/60 border-amber-700 text-amber-300"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  ★ Favoritos
                </button>

                <button
                  type="button"
                  onClick={() => setShowArchived(!showArchived)}
                  className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                    showArchived
                      ? "bg-indigo-950/60 border-indigo-700 text-indigo-300"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  Arquivados
                </button>

                {(query ||
                  typeFilter ||
                  statusFilter ||
                  collectionFilter ||
                  selectedTagIds.length > 0 ||
                  onlyFavorites ||
                  showArchived) && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setTypeFilter("");
                      setStatusFilter("");
                      setCollectionFilter("");
                      setSelectedTagIds([]);
                      setOnlyFavorites(false);
                      setShowArchived(false);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-500 mr-1">Etiquetas:</span>
                  {tags.map((t) => {
                    const active = selectedTagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setSelectedTagIds(
                            active
                              ? selectedTagIds.filter((id) => id !== t.id)
                              : [...selectedTagIds, t.id]
                          )
                        }
                        className={`px-2 py-0.5 rounded-md text-[11px] border transition cursor-pointer ${
                          active
                            ? "bg-indigo-600 border-indigo-500 text-white"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        #{t.name} ({t.itemCount})
                      </button>
                    );
                  })}
                </div>
              )}

              {fallbackNotice && (
                <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-800/60 text-amber-200 text-xs">
                  Aviso de pesquisa: {fallbackNotice}
                </div>
              )}
            </section>

            {/* Batch Action Bar */}
            {selectedItemIds.length > 0 && (
              <div className="p-3 bg-indigo-950/60 border border-indigo-800 rounded-xl flex items-center justify-between text-xs">
                <span className="font-medium text-indigo-200">
                  {selectedItemIds.length} item(ns) selecionado(s)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleBatchAction("favorite")}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white"
                  >
                    Favoritar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchAction("archive")}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white"
                  >
                    Arquivar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBatchAction("delete")}
                    className="px-2.5 py-1 rounded bg-red-900/80 hover:bg-red-800 text-red-100"
                  >
                    Excluir selecionados
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedItemIds([])}
                    className="px-2 py-1 text-slate-400"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {batchMessage && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex justify-between">
                <span>{batchMessage}</span>
                <button type="button" onClick={() => setBatchMessage(null)}>
                  ✕
                </button>
              </div>
            )}

            {/* Items Grid */}
            {loadingLibrary ? (
              <div className="p-12 text-center text-sm text-slate-400">
                Carregando itens autorizados da biblioteca...
              </div>
            ) : libraryError ? (
              <div className="p-8 rounded-2xl bg-red-950/40 border border-red-800 text-center text-sm text-red-200">
                Pesquisa indisponível: {libraryError}
              </div>
            ) : items.length === 0 ? (
              <div className="p-12 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-center space-y-2">
                <p className="text-sm font-medium text-slate-200">
                  Nenhum item encontrado para os critérios atuais
                </p>
                <p className="text-xs text-slate-400">
                  Use os botões acima para salvar um link, criar uma nota ou enviar um PDF/imagem.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  Exibindo {items.length} de {totalItems} item(ns)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <article
                      key={item.id}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col justify-between transition"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              aria-label={`Selecionar ${item.title}`}
                              checked={selectedItemIds.includes(item.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedItemIds([...selectedItemIds, item.id]);
                                } else {
                                  setSelectedItemIds(
                                    selectedItemIds.filter((id) => id !== item.id)
                                  );
                                }
                              }}
                              className="rounded border-slate-700 bg-slate-950"
                            />
                            <span className="uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {item.type}
                            </span>
                            {item.domain && (
                              <span className="text-[11px] text-slate-400 truncate max-w-[130px]">
                                {item.domain}
                              </span>
                            )}
                          </div>
                          {renderStatusBadge(item.processingStatus)}
                        </div>

                        <button
                          type="button"
                          onClick={() => openItemDetail(item.id)}
                          className="text-left group block w-full cursor-pointer"
                        >
                          <h3 className="font-semibold text-sm text-white group-hover:text-indigo-400 line-clamp-2 transition">
                            {item.title}
                          </h3>
                        </button>

                        {(item.snippet || item.summary) && (
                          <p className="mt-2 text-xs text-slate-400 line-clamp-3">
                            {item.snippet || item.summary}
                          </p>
                        )}

                        {item.processingError && (
                          <p className="mt-2 text-[11px] text-amber-300 bg-amber-950/40 border border-amber-900/50 rounded p-1.5">
                            {item.processingError}
                          </p>
                        )}

                        {item.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {item.tags.map((t) => (
                              <span
                                key={t.id}
                                className={`text-[10px] px-2 py-0.5 rounded-md border ${
                                  t.source === "ai"
                                    ? "bg-purple-950/50 border-purple-800/60 text-purple-300"
                                    : "bg-slate-950 border-slate-800 text-slate-300"
                                }`}
                              >
                                #{t.name}
                                {t.source === "ai" ? " (IA)" : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                        <span>
                          {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(item)}
                            title="Favorito"
                            className={`p-1.5 rounded hover:bg-slate-800 cursor-pointer ${
                              item.isFavorite ? "text-amber-400" : "text-slate-500"
                            }`}
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(item)}
                            title={item.isArchived ? "Desarquivar" : "Arquivar"}
                            className={`p-1.5 rounded hover:bg-slate-800 cursor-pointer ${
                              item.isArchived ? "text-indigo-400" : "text-slate-500"
                            }`}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openItemDetail(item.id)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] cursor-pointer"
                          >
                            Abrir
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            title="Excluir"
                            className="p-1.5 rounded hover:bg-red-950/60 text-slate-500 hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================
            TAB 2: ASSISTENTE DE CONHECIMENTO (RAG VERIFICÁVEL)
           ================================================================ */}
        {activeTab === "assistant" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white">
                  Assistente de Conhecimento com Citações Verificáveis
                </h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                As respostas usam exclusivamente trechos recuperados do seu acervo autorizado. Citações são validadas no servidor contra IDs reais e protegidas contra prompt injection.
              </p>

              <form onSubmit={handleAskAssistant} className="flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Faça uma pergunta sobre os artigos, notas ou PDFs salvos na sua biblioteca..."
                  className="flex-1 px-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={askingAssistant}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white cursor-pointer"
                >
                  {askingAssistant ? "Consultando acervo..." : "Perguntar"}
                </button>
              </form>

              {assistantError && (
                <div className="mt-4 p-4 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-200">
                  {assistantError}
                </div>
              )}
            </section>

            {assistantResult && (
              <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <span className="text-xs text-slate-400">{assistantResult.scopeNote}</span>
                  <div className="flex items-center gap-2">
                    {assistantResult.promptInjectionNeutralized && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] bg-amber-950/80 border border-amber-700 text-amber-200">
                        <ShieldCheck className="w-3.5 h-3.5" /> Prompt Injection Neutralizado
                      </span>
                    )}
                    <span className="text-[11px] px-2.5 py-0.5 rounded bg-slate-800 text-slate-300">
                      Provedor: {assistantResult.providerUsed}
                    </span>
                  </div>
                </div>

                {assistantResult.insufficientEvidence && (
                  <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-800 text-xs text-amber-200">
                    <strong>Evidência Insuficiente:</strong> A biblioteca atual não contém fontes suficientes para sustentar uma afirmação conclusiva sobre esta consulta.
                  </div>
                )}

                {assistantResult.hasConflict && assistantResult.conflictExplanation && (
                  <div className="p-3.5 rounded-xl bg-purple-950/50 border border-purple-800 text-xs text-purple-200">
                    <strong>Divergência entre fontes detectada:</strong>{" "}
                    {assistantResult.conflictExplanation}
                  </div>
                )}

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                    Resposta Fundamentada
                  </h3>
                  <div className="text-sm text-slate-100 whitespace-pre-line leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                    {assistantResult.answer}
                  </div>
                </div>

                {assistantResult.directEvidenceSummary.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      Evidências Diretas nas Fontes
                    </h4>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {assistantResult.directEvidenceSummary.map((ev, idx) => (
                        <li
                          key={idx}
                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800"
                        >
                          {ev}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {assistantResult.citations.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Citações Verificadas pelo Servidor ({assistantResult.citations.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {assistantResult.citations.map((cit) => (
                        <div
                          key={cit.citationId}
                          className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-mono text-xs font-bold">
                                [{cit.citationId}]
                              </span>
                              <span className="text-[11px] text-slate-500">{cit.locator}</span>
                            </div>
                            <div className="font-semibold text-xs text-white mb-1">
                              {cit.title}
                            </div>
                            <blockquote className="text-xs text-slate-400 italic border-l-2 border-indigo-500/50 pl-2.5 line-clamp-3">
                              &ldquo;{cit.quote}&rdquo;
                            </blockquote>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                            <button
                              type="button"
                              onClick={() => openItemDetail(cit.itemId)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                            >
                              Abrir fonte e conferir trecho →
                            </button>
                            {cit.originalUrl && (
                              <a
                                href={cit.originalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                              >
                                Origem <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" /> Histórico de Consultas RAG & Retenção de Privacidade
                  </h3>
                  <p className="text-xs text-slate-400">
                    Reabra consultas anteriores com suas citações verificadas ou limpe o histórico a qualquer momento.
                  </p>
                </div>
                {assistantConversations.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/assistant", { method: "DELETE" });
                      await loadAssistantConversations();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 border border-red-800 text-xs text-red-200 cursor-pointer"
                  >
                    Limpar Todo o Histórico
                  </button>
                )}
              </div>

              {assistantConversations.length === 0 ? (
                <div className="text-xs text-slate-500">
                  Nenhuma conversa armazenada no histórico no momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {assistantConversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => openAssistantConversation(conv.id)}
                        className="text-left flex-1 truncate text-slate-200 hover:text-indigo-300 font-medium cursor-pointer"
                      >
                        {conv.title}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch(`/api/assistant?conversationId=${conv.id}`, {
                            method: "DELETE",
                          });
                          await loadAssistantConversations();
                        }}
                        className="text-red-400 hover:text-red-300 px-2 py-0.5"
                      >
                        Excluir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================================================================
            TAB 3: COLEÇÕES & ETIQUETAS
           ================================================================ */}
        {activeTab === "organization" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FolderKanban className="w-5 h-5 text-indigo-400" /> Coleções Manuais & Inteligentes (Smart Collections)
              </h2>
              <p className="text-xs text-slate-400">
                Crie coleções manuais ou dinâmicas baseadas em regras (domínio, tipo, favoritos ou palavras-chave). Excluir uma coleção nunca exclui os itens originais.
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newCollectionName.trim()) return;
                  const smartRules =
                    newCollectionType === "smart"
                      ? {
                          ...(smartRuleQuery.trim() ? { titleContains: smartRuleQuery.trim() } : {}),
                          ...(smartRuleDomain.trim()
                            ? { domainContains: smartRuleDomain.trim() }
                            : {}),
                          ...(smartRuleType
                            ? { itemType: smartRuleType as "link" | "note" | "file" | "image" }
                            : {}),
                          ...(smartRuleFav ? { isFavorite: true } : {}),
                        }
                      : undefined;

                  const res = await fetch("/api/collections", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: newCollectionName,
                      description: newCollectionDesc,
                      parentId: newCollectionParentId || null,
                      type: newCollectionType,
                      smartRules,
                    }),
                  });
                  if (res.ok) {
                    setNewCollectionName("");
                    setNewCollectionDesc("");
                    setNewCollectionParentId("");
                    setSmartRuleQuery("");
                    setSmartRuleDomain("");
                    setSmartRuleType("");
                    setSmartRuleFav(false);
                    await loadOrganization();
                  }
                }}
                className="flex flex-col gap-2"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Nome da nova coleção"
                    className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                  <select
                    value={newCollectionType}
                    onChange={(e) => setNewCollectionType(e.target.value as "manual" | "smart")}
                    className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                  >
                    <option value="manual">Coleção Manual</option>
                    <option value="smart">Smart Collection (Regras)</option>
                  </select>
                </div>

                {newCollectionType === "smart" && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-indigo-900/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <input
                      type="text"
                      value={smartRuleQuery}
                      onChange={(e) => setSmartRuleQuery(e.target.value)}
                      placeholder="Termo no título/resumo (opcional)"
                      className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white"
                    />
                    <input
                      type="text"
                      value={smartRuleDomain}
                      onChange={(e) => setSmartRuleDomain(e.target.value)}
                      placeholder="Domínio contém (ex: github.com)"
                      className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-white"
                    />
                    <select
                      value={smartRuleType}
                      onChange={(e) => setSmartRuleType(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-slate-200"
                    >
                      <option value="">Qualquer tipo de item</option>
                      <option value="link">Apenas Links</option>
                      <option value="note">Apenas Notas</option>
                      <option value="file">Apenas PDFs/Arquivos</option>
                    </select>
                    <label className="flex items-center gap-2 text-slate-300 px-1">
                      <input
                        type="checkbox"
                        checked={smartRuleFav}
                        onChange={(e) => setSmartRuleFav(e.target.checked)}
                      />
                      Somente itens favoritados
                    </label>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    placeholder="Descrição opcional"
                    className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                  <select
                    value={newCollectionParentId}
                    onChange={(e) => setNewCollectionParentId(e.target.value)}
                    className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300"
                  >
                    <option value="">Sem coleção pai (Raiz)</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        Subcoleção de: {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                  >
                    Criar Coleção
                  </button>
                </div>
              </form>

              <div className="space-y-2 pt-2">
                {collections.map((col) => (
                  <div
                    key={col.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{col.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                            col.type === "smart"
                              ? "bg-indigo-950 text-indigo-300 border border-indigo-800"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {col.type === "smart" ? "Smart" : "Manual"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        {col.itemCount} item(ns) {col.description ? `· ${col.description}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/collections?collectionId=${col.id}`, {
                          method: "DELETE",
                        });
                        await loadOrganization();
                      }}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-indigo-400" /> Etiquetas (Tags)
              </h2>
              <p className="text-xs text-slate-400">
                Gerencie etiquetas manuais e sugeridas por IA. Remover uma etiqueta não exclui os itens.
              </p>

              <div className="space-y-2">
                {tags.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-sm font-medium text-white">#{t.name}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        ({t.itemCount} itens)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await fetch(`/api/tags?tagId=${t.id}`, { method: "DELETE" });
                        await loadOrganization();
                        await loadLibrary();
                      }}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                    >
                      Excluir tag
                    </button>
                  </div>
                ))}
              </div>

              {/* Regras de Automação Determinística */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">
                  Regras de Automação na Captura
                </h3>
                <p className="text-xs text-slate-400">
                  Aplique etiquetas e marque favoritos automaticamente quando um link ou documento corresponder ao domínio configurado.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newRuleName.trim()) return;
                    const addTags = newRuleTags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    const res = await fetch("/api/workspaces", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "createAutomationRule",
                        name: newRuleName,
                        conditions: {
                          ...(newRuleDomain.trim() ? { domainContains: newRuleDomain.trim() } : {}),
                        },
                        actions: {
                          ...(addTags.length > 0 ? { addTags } : {}),
                          markFavorite: newRuleFavorite,
                        },
                      }),
                    });
                    if (res.ok) {
                      setNewRuleName("");
                      setNewRuleDomain("");
                      setNewRuleTags("");
                      setNewRuleFavorite(false);
                      await loadSettingsData();
                    }
                  }}
                  className="space-y-2 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={newRuleName}
                      onChange={(e) => setNewRuleName(e.target.value)}
                      placeholder="Nome da regra (ex: Repositórios GitHub)"
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                    <input
                      type="text"
                      value={newRuleDomain}
                      onChange={(e) => setNewRuleDomain(e.target.value)}
                      placeholder="Domínio contém (ex: github.com)"
                      className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={newRuleTags}
                      onChange={(e) => setNewRuleTags(e.target.value)}
                      placeholder="Adicionar tags (ex: codigo, opensource)"
                      className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                    <label className="flex items-center gap-1.5 text-slate-300 px-2">
                      <input
                        type="checkbox"
                        checked={newRuleFavorite}
                        onChange={(e) => setNewRuleFavorite(e.target.checked)}
                      />
                      Auto-favoritar
                    </label>
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-lg bg-indigo-600 text-white font-semibold cursor-pointer"
                    >
                      Criar Regra
                    </button>
                  </div>
                </form>

                {workspacesData?.automationRules && workspacesData.automationRules.length > 0 && (
                  <div className="space-y-1.5 pt-2">
                    {workspacesData.automationRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-200 font-medium">{rule.name}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch("/api/workspaces", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "deleteAutomationRule",
                                ruleId: rule.id,
                              }),
                            });
                            await loadSettingsData();
                          }}
                          className="text-red-400 hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Assinaturas de Feeds RSS / Atom */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">
                  Assinaturas de Feeds RSS / Atom (Captura Automática)
                </h3>
                <p className="text-xs text-slate-400">
                  Assine blogs e fontes técnicas com proteção anti-SSRF, desduplicação automática de links e aplicação de tags.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newRssUrl.trim()) return;
                    const autoTags = newRssTags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    const res = await fetch("/api/workspaces", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "createRssFeed",
                        feedUrl: newRssUrl,
                        autoTags: autoTags.length > 0 ? autoTags : ["rss"],
                      }),
                    });
                    if (res.ok) {
                      setNewRssUrl("");
                      setNewRssTags("");
                      await loadSettingsData();
                    }
                  }}
                  className="flex flex-wrap gap-2 text-xs"
                >
                  <input
                    type="url"
                    required
                    value={newRssUrl}
                    onChange={(e) => setNewRssUrl(e.target.value)}
                    placeholder="https://exemplo.com/feed.xml"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                  <input
                    type="text"
                    value={newRssTags}
                    onChange={(e) => setNewRssTags(e.target.value)}
                    placeholder="Tags (ex: rss, engenharia)"
                    className="w-40 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 text-white font-semibold cursor-pointer"
                  >
                    Assinar Feed
                  </button>
                </form>

                {workspacesData?.rssFeeds && workspacesData.rssFeeds.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    {workspacesData.rssFeeds.map((feed) => (
                      <div
                        key={feed.id}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="truncate max-w-xs">
                          <div className="font-medium text-white">{feed.title}</div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {feed.itemsImportedCount} importado(s) · {feed.feedUrl}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={syncingRssId === feed.id}
                            onClick={async () => {
                              setSyncingRssId(feed.id);
                              try {
                                await fetch("/api/workspaces", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "syncRssFeed",
                                    feedId: feed.id,
                                  }),
                                });
                                await loadSettingsData();
                                await loadLibrary();
                              } finally {
                                setSyncingRssId(null);
                              }
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 cursor-pointer"
                          >
                            {syncingRssId === feed.id ? "Sincronizando..." : "Sincronizar"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch("/api/workspaces", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  action: "deleteRssFeed",
                                  feedId: feed.id,
                                }),
                              });
                              await loadSettingsData();
                            }}
                            className="text-red-400 hover:underline"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* ================================================================
            TAB 4: WORKERS & FILA DE PROCESSAMENTO
           ================================================================ */}
        {activeTab === "jobs" && (
          <div className="space-y-6">
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Fila Persistente de Processamento Assíncrono & Índices
                  </h2>
                  <p className="text-xs text-slate-400">
                    Acompanhe estados de extração, retries com backoff, recuperação de tarefas órfãs e reconstrução do índice.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={runningWorker}
                    onClick={() => triggerWorkerBatch()}
                    className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Processar Fila Agora
                  </button>
                  <button
                    type="button"
                    disabled={runningWorker}
                    onClick={() => triggerWorkerBatch("recoverStale")}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                  >
                    Recuperar Jobs Travados
                  </button>
                  <button
                    type="button"
                    disabled={runningWorker}
                    onClick={() => triggerWorkerBatch("reindex")}
                    className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                  >
                    Reconstruir Índice & Vetores
                  </button>
                  <button
                    type="button"
                    disabled={runningBenchmark}
                    onClick={runEvaluationBenchmark}
                    className="px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-semibold text-white cursor-pointer"
                  >
                    {runningBenchmark ? "Executando Benchmark..." : "Executar Benchmark RAG/Busca"}
                  </button>
                </div>
              </div>

              {healthDiagnostics && (
                <div className="mb-6 p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="text-slate-400 block">Saúde do Sistema & Banco</span>
                      <span className="font-semibold text-emerald-400">
                        {healthDiagnostics.status.toUpperCase()} ({healthDiagnostics.database.latencyMs}ms)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Arquivos Privados Armazenados</span>
                      <span className="font-semibold text-white">
                        {healthDiagnostics.storage.totalFiles} arquivo(s) ({Math.round(healthDiagnostics.storage.totalBytes / 1024)} KB)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Integridade de Backup / Blobs</span>
                      <span className="font-semibold text-white">
                        {healthDiagnostics.storage.integrityVerifiedCount}/{healthDiagnostics.storage.totalFiles} íntegros ({healthDiagnostics.storage.missingBlobsCount} ausentes)
                      </span>
                    </div>
                  </div>

                  {healthDiagnostics.embeddingIndex && (
                    <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-slate-400 block">Cobertura Vetorial</span>
                        <span className="font-semibold text-indigo-300">
                          {healthDiagnostics.embeddingIndex.coveragePercent}% ({healthDiagnostics.embeddingIndex.embeddedChunksCount}/{healthDiagnostics.embeddingIndex.totalChunks} chunks)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Modelo & Dimensões</span>
                        <span className="font-semibold text-white">
                          {healthDiagnostics.embeddingIndex.configuredModel} ({healthDiagnostics.embeddingIndex.configuredDimensions}d)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Consistência de Modelo</span>
                        <span
                          className={`font-semibold ${
                            healthDiagnostics.embeddingIndex.hasDimensionMismatch ||
                            healthDiagnostics.embeddingIndex.hasModelDrift
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {healthDiagnostics.embeddingIndex.hasDimensionMismatch
                            ? "Divergência de Dimensões"
                            : healthDiagnostics.embeddingIndex.hasModelDrift
                            ? "Modelo Misto Detectado"
                            : "Uniforme"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Recomendação</span>
                        <span className="text-slate-300">
                          {healthDiagnostics.embeddingIndex.recommendation}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {benchmarkReport && (
                <div className="mb-6 p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/80 space-y-2 text-xs">
                  <div className="font-semibold text-indigo-300">
                    Resultado da Avaliação Quantitativa de Pesquisa & RAG (Recall / MRR / Citações):
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <div className="text-slate-400">Lexical Recall@3</div>
                      <div className="text-base font-bold text-white">
                        {Math.round(benchmarkReport.modes.lexical.recallAt3 * 100)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Semântica Recall@3</div>
                      <div className="text-base font-bold text-white">
                        {Math.round(benchmarkReport.modes.semantic.recallAt3 * 100)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Híbrida (RRF) Recall@3</div>
                      <div className="text-base font-bold text-emerald-400">
                        {Math.round(benchmarkReport.modes.hybrid.recallAt3 * 100)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Híbrida MRR</div>
                      <div className="text-base font-bold text-white">
                        {benchmarkReport.modes.hybrid.mrr}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Precisão Citações RAG</div>
                      <div className="text-base font-bold text-emerald-400">
                        {Math.round(benchmarkReport.ragEvaluation.citationAccuracyRate * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {queueMetrics && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
                    {[
                      { label: "Aguardando", key: "pending" },
                      { label: "Em execução", key: "processing" },
                      { label: "Retentativa", key: "retrying" },
                      { label: "Concluídos", key: "succeeded" },
                      { label: "Falhas", key: "failed" },
                      { label: "Cancelados", key: "cancelled" },
                    ].map((stat) => (
                      <div
                        key={stat.key}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800"
                      >
                        <div className="text-[11px] text-slate-400">{stat.label}</div>
                        <div className="text-xl font-bold text-white mt-1">
                          {queueMetrics.counts[stat.key] ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Histórico Recente de Tarefas
                    </h3>
                    {queueMetrics.recentJobs.map((j) => (
                      <div
                        key={j.id}
                        className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-indigo-300">{j.jobType}</span>
                          <span className="text-slate-500">
                            Tentativas: {j.attempts}/{j.maxAttempts}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {j.lastError && (
                            <span className="text-amber-300 max-w-md truncate">
                              {j.lastError}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200">
                            {j.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {/* ================================================================
            TAB 5: PORTABILIDADE (IMPORTAÇÃO E EXPORTAÇÃO)
           ================================================================ */}
        {activeTab === "portability" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white">
                Exportar Dados da Biblioteca (Multi-Formato)
              </h2>
              <p className="text-xs text-slate-400">
                Seus dados pertencem a você. Exporte todos os itens, textos extraídos, notas, etiquetas, coleções e destaques em JSON documentado (`comnois-export-v1`), em HTML Netscape (compatível com Chrome, Firefox, Safari, Raindrop e Karakeep) ou em CSV.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch("/api/portability?format=json");
                    if (res.ok) {
                      const bundle = await res.json();
                      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `comnois-export-${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Exportar JSON Completo
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch("/api/portability?format=netscape_html");
                    if (res.ok) {
                      const html = await res.text();
                      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `comnois-bookmarks-${new Date().toISOString().slice(0, 10)}.html`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Favoritos Netscape (.HTML)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch("/api/portability?format=csv");
                    if (res.ok) {
                      const csv = await res.text();
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `comnois-library-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Planilha (.CSV)
                </button>
              </div>
            </section>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white">
                Importar Biblioteca (JSON ou Favoritos HTML Netscape)
              </h2>
              <p className="text-xs text-slate-400">
                Importe pacotes JSON (`comnois-export-v1`) ou arquivos HTML de favoritos exportados de navegadores/gerenciadores com prévia de impacto e política explícita para duplicatas.
              </p>

              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Política de duplicidade
                </label>
                <select
                  value={duplicatePolicy}
                  onChange={(e) =>
                    setDuplicatePolicy(e.target.value as "skip" | "overwrite" | "append")
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                >
                  <option value="skip">Ignorar duplicatas (Idempotente — recomendado)</option>
                  <option value="overwrite">Atualizar/sobrescrever item existente</option>
                  <option value="append">Criar novo registro mesmo se duplicado</option>
                </select>
              </div>

              <textarea
                rows={6}
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder='Cole aqui o JSON ({ "items": [...] }) ou o HTML Netscape (<!DOCTYPE NETSCAPE-Bookmark-file-1>...)'
                className="w-full p-3 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
              />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!importJsonText.trim()) return;
                    const res = await fetch("/api/portability", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        dryRun: true,
                        rawHtml: importJsonText,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setImportPreview(data.preview);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  Analisar Prévia (Dry-Run)
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!importJsonText.trim()) return;
                    const res = await fetch("/api/portability", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        duplicatePolicy,
                        rawHtml: importJsonText,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setImportReport(data.report);
                      setImportPreview(null);
                      await loadLibrary();
                      await loadOrganization();
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white cursor-pointer"
                >
                  Executar Importação
                </button>
              </div>

              {importPreview && (
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-800 text-xs space-y-1">
                  <div className="font-semibold text-indigo-300">
                    Prévia da Importação ({importPreview.formatDetected}):
                  </div>
                  <div>Itens válidos detectados: {importPreview.validItemsCount}</div>
                  <div>Novos itens inéditos: {importPreview.newItemsCount}</div>
                  <div>Duplicatas já existentes: {importPreview.existingDuplicatesCount}</div>
                  {importPreview.collectionsDetected.length > 0 && (
                    <div>Coleções detectadas: {importPreview.collectionsDetected.join(", ")}</div>
                  )}
                </div>
              )}

              {importReport && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="font-semibold text-emerald-400">
                    Relatório de Importação:
                  </div>
                  <div>Recebidos: {importReport.totalReceived}</div>
                  <div>Criados: {importReport.createdCount}</div>
                  <div>Duplicatas detectadas: {importReport.duplicateCount}</div>
                  <div>Ignorados: {importReport.skippedCount}</div>
                  <div>Falhas: {importReport.failedCount}</div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================================================================
            TAB 6: CONFIGURAÇÕES DE IA, CUSTOS, WORKSPACES & TOKENS DE API
           ================================================================ */}
        {activeTab === "settings" && aiConfig && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white">
                Provedores de IA & Controle de Consumo
              </h2>
              {aiUsage && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Consumo diário de tokens:</span>
                    <span className="font-semibold text-white">
                      {aiUsage.totalTokensToday} / {aiUsage.dailyTokenLimit}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Custo estimado hoje (USD):</span>
                    <span className="font-mono text-emerald-400">
                      ${aiUsage.estimatedCostUsd}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-3 text-xs">
                <label className="flex items-center gap-2 text-slate-200">
                  <input
                    type="checkbox"
                    checked={aiConfig.isEnabled}
                    onChange={(e) =>
                      setAiConfig({ ...aiConfig, isEnabled: e.target.checked })
                    }
                  />
                  Habilitar recursos de IA (Assistente, Resumos e Sugestão de Etiquetas)
                </label>

                <div>
                  <label className="block text-slate-400 mb-1">Provedor Selecionado</label>
                  <select
                    value={aiConfig.provider}
                    onChange={(e) =>
                      setAiConfig({
                        ...aiConfig,
                        provider: e.target.value as "extractive" | "openai" | "ollama",
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  >
                    <option value="extractive">
                      Extrativo Local Determinístico (Sem envio a terceiros)
                    </option>
                    <option value="openai">OpenAI / Compatível</option>
                    <option value="ollama">Ollama Local (http://localhost:11434)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    Chave de API ({aiConfig.hasApiKey ? `Salva: ${aiConfig.maskedApiKey}` : "Não configurada"})
                  </label>
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="sk-... (armazenada com criptografia AES-256-GCM no servidor)"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch("/api/settings/ai", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          provider: aiConfig.provider,
                          isEnabled: aiConfig.isEnabled,
                          ...(newApiKey ? { apiKey: newApiKey } : {}),
                        }),
                      });
                      if (res.ok) {
                        setNewApiKey("");
                        await loadSettingsData();
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 font-semibold text-white cursor-pointer"
                  >
                    Salvar Configurações de IA
                  </button>

                  {/* Sessões Ativas & Exclusão Completa LGPD */}
                  <div className="pt-4 border-t border-slate-800 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-300">
                        Sessões Autenticadas ({workspacesData?.sessions?.filter((s) => !s.revokedAt).length ?? 1} ativa(s))
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await fetch("/api/workspaces", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ action: "revokeAllSessions" }),
                          });
                          router.push("/login");
                        }}
                        className="text-amber-400 hover:underline cursor-pointer"
                      >
                        Encerrar todas as sessões
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-red-950/30 border border-red-900/60 space-y-2">
                      <div className="font-semibold text-red-300">
                        Zona de Perigo — Exclusão Integral da Conta e Dados (LGPD/GDPR)
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Remove permanentemente todos os seus itens, arquivos privados no storage, chunks, vetores, sessões e configurações.
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={deleteAccountPassword}
                          onChange={(e) => setDeleteAccountPassword(e.target.value)}
                          placeholder="Confirme sua senha atual"
                          className="flex-1 px-3 py-1.5 bg-slate-950 border border-red-900/60 rounded-lg text-white"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!deleteAccountPassword) return;
                            if (
                              !window.confirm(
                                "Tem certeza absoluta? Esta operação excluirá permanentemente sua conta e todos os arquivos armazenados."
                              )
                            ) {
                              return;
                            }
                            const res = await fetch("/api/workspaces", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "deleteAccount",
                                passwordConfirmation: deleteAccountPassword,
                              }),
                            });
                            if (res.ok) {
                              router.push("/login");
                              router.refresh();
                            } else {
                              const err = await res.json();
                              alert(err.error?.message || "Falha ao excluir conta.");
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold cursor-pointer"
                        >
                          Excluir Conta
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-indigo-400" /> Tokens de API Escopados, Workspaces & Webhooks
              </h2>

              {/* API Tokens */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  Tokens Pessoais de API (CLI / Extensão de Navegador)
                </div>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={newTokenName}
                    onChange={(e) => setNewTokenName(e.target.value)}
                    placeholder="Nome do token (ex: Extensão Chrome)"
                    className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                  <select
                    value={newTokenScopes}
                    onChange={(e) => setNewTokenScopes(e.target.value as "read,write" | "read")}
                    className="px-2.5 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                  >
                    <option value="read,write">Leitura & Escrita</option>
                    <option value="read">Somente Leitura</option>
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newTokenName.trim()) return;
                      const res = await fetch("/api/workspaces", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "createApiToken",
                          name: newTokenName,
                          scopes: newTokenScopes.split(","),
                        }),
                      });
                      if (res.ok) {
                        const d = await res.json();
                        setGeneratedRawToken(d.token.rawToken);
                        setNewTokenName("");
                        await loadSettingsData();
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                  >
                    Gerar Token
                  </button>
                </div>

                {generatedRawToken && (
                  <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200 break-all">
                    Copie seu token agora (ele não será exibido novamente):{" "}
                    <code className="font-mono font-bold">{generatedRawToken}</code>
                  </div>
                )}

                <div className="space-y-1.5 pt-1">
                  {workspacesData?.apiTokens.map((tok) => (
                    <div
                      key={tok.id}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-medium text-white">{tok.name}</span>
                        <span className="ml-2 font-mono text-slate-400">
                          {tok.tokenPrefix}•••
                        </span>
                        {tok.scopes && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {tok.scopes.join(", ")}
                          </span>
                        )}
                      </div>
                      {tok.revokedAt ? (
                        <span className="text-red-400">Revogado</span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch("/api/workspaces", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "revokeApiToken",
                                tokenId: tok.id,
                              }),
                            });
                            await loadSettingsData();
                          }}
                          className="text-red-400 hover:underline"
                        >
                          Revogar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Collaborative Workspaces */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  Workspaces Colaborativos (RBAC: Owner / Admin / Member)
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Nome do novo workspace de equipe"
                    className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!newWorkspaceName.trim()) return;
                      const res = await fetch("/api/workspaces", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "createWorkspace",
                          name: newWorkspaceName,
                        }),
                      });
                      if (res.ok) {
                        setNewWorkspaceName("");
                        await loadSettingsData();
                      }
                    }}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
                  >
                    Criar Workspace
                  </button>
                </div>
                <div className="space-y-1.5">
                  {workspacesData?.workspaces.map((ws) => (
                    <div
                      key={ws.workspaceId}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-white">{ws.name}</span>
                      <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 uppercase text-[10px]">
                        {ws.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outgoing Signed Webhooks */}
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  Webhooks Assinados (HMAC-SHA256 + Proteção Anti-SSRF)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newWebhookName}
                    onChange={(e) => setNewWebhookName(e.target.value)}
                    placeholder="Nome (ex: Integração n8n/Slack)"
                    className="px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                      placeholder="https://hooks.exemplo.com/webhook"
                      className="flex-1 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (!newWebhookName.trim() || !newWebhookUrl.trim()) return;
                        const res = await fetch("/api/workspaces", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "createWebhook",
                            name: newWebhookName,
                            targetUrl: newWebhookUrl,
                          }),
                        });
                        if (res.ok) {
                          const d = await res.json();
                          setGeneratedWebhookSecret(d.webhook.signingSecret);
                          setNewWebhookName("");
                          setNewWebhookUrl("");
                          await loadSettingsData();
                        }
                      }}
                      className="px-3 py-2 rounded-lg bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                {generatedWebhookSecret && (
                  <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200 break-all">
                    Segredo HMAC-SHA256 (`X-Comnois-Signature`):{" "}
                    <code className="font-mono font-bold">{generatedWebhookSecret}</code>
                  </div>
                )}

                {workspacesData?.webhooks && workspacesData.webhooks.length > 0 && (
                  <div className="space-y-1.5">
                    {workspacesData.webhooks.map((wh) => (
                      <div
                        key={wh.id}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="truncate max-w-xs">
                          <div className="font-medium text-white">{wh.name}</div>
                          <div className="text-[11px] text-slate-400 truncate">{wh.targetUrl}</div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            await fetch("/api/workspaces", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "deleteWebhook",
                                webhookId: wh.id,
                              }),
                            });
                            await loadSettingsData();
                          }}
                          className="text-red-400 hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </main>

      {/* ================================================================
          ITEM DETAIL DRAWER / MODAL
         ================================================================ */}
      {activeItemId && itemDetail && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto p-6 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {itemDetail.item.type}
                  </span>
                  {renderStatusBadge(itemDetail.item.processingStatus)}
                  <span className="text-xs text-slate-500">
                    v{itemDetail.item.contentVersion}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white">{itemDetail.item.title}</h2>
                {itemDetail.item.originalUrl && (
                  <a
                    href={itemDetail.item.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-400 hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    {itemDetail.item.originalUrl} <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveItemId(null);
                  setItemDetail(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-200 cursor-pointer"
              >
                Fechar
              </button>
            </div>

            {/* Edit Metadata */}
            <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-slate-300">
                Editar Título e Resumo
              </div>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
              />
              <textarea
                rows={2}
                value={editSummary}
                onChange={(e) => setEditSummary(e.target.value)}
                placeholder="Resumo ou descrição do item"
                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
              />
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleRetryItem(itemDetail.item.id)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Reprocessar Extração / IA
                  </button>
                  <button
                    type="button"
                    disabled={creatingSnapshot}
                    onClick={async () => {
                      setCreatingSnapshot(true);
                      try {
                        const res = await fetch(`/api/items/${itemDetail.item.id}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "create_snapshot" }),
                        });
                        if (res.ok) {
                          await openItemDetail(itemDetail.item.id);
                        }
                      } finally {
                        setCreatingSnapshot(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-700 text-xs text-emerald-200 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5" />{" "}
                    {creatingSnapshot ? "Gerando Snapshot..." : "Gerar Snapshot Offline (.md)"}
                  </button>
                  <a
                    href={`/api/items/${itemDetail.item.id}?format=markdown`}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 inline-flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar .md
                  </a>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch(`/api/items/${itemDetail.item.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        title: editTitle,
                        summary: editSummary,
                      }),
                    });
                    await openItemDetail(itemDetail.item.id);
                    await loadLibrary();
                  }}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 text-xs font-semibold text-white cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>

            {/* Tags & AI Tag Confirmation */}
            {itemDetail.tags.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Etiquetas Associadas (Manuais & Sugestões de IA)
                </h3>
                <div className="flex flex-wrap gap-2">
                  {itemDetail.tags.map((tg) => (
                    <div
                      key={tg.id}
                      className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-2 ${
                        tg.source === "ai" && !tg.isConfirmed
                          ? "bg-purple-950/50 border-purple-800 text-purple-200"
                          : "bg-slate-950 border-slate-800 text-slate-200"
                      }`}
                    >
                      <span>
                        #{tg.name}
                        {tg.source === "ai" && !tg.isConfirmed ? " (Sugestão IA)" : ""}
                      </span>
                      {tg.source === "ai" && !tg.isConfirmed && (
                        <div className="flex items-center gap-1 border-l border-purple-800/60 pl-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch("/api/tags", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  itemId: itemDetail.item.id,
                                  tagId: tg.id,
                                  decision: "confirm",
                                }),
                              });
                              await openItemDetail(itemDetail.item.id);
                              await loadLibrary();
                            }}
                            title="Confirmar etiqueta sugerida pela IA"
                            className="text-emerald-400 hover:underline font-semibold cursor-pointer"
                          >
                            ✓ Aceitar
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await fetch("/api/tags", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  itemId: itemDetail.item.id,
                                  tagId: tg.id,
                                  decision: "reject",
                                }),
                              });
                              await openItemDetail(itemDetail.item.id);
                              await loadLibrary();
                            }}
                            title="Rejeitar etiqueta sugerida pela IA"
                            className="text-red-400 hover:underline ml-1 cursor-pointer"
                          >
                            ✕ Recusar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Private Assets Download */}
            {itemDetail.assets.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Arquivo Original Privado
                </h3>
                {itemDetail.assets.map((ast) => (
                  <div
                    key={ast.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-medium text-white">{ast.originalFileName}</div>
                      <div className="text-slate-500">
                        {ast.mimeType} · {Math.round(ast.sizeBytes / 1024)} KB
                      </div>
                    </div>
                    <a
                      href={ast.downloadUrl}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium"
                    >
                      Baixar Arquivo
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Extracted Text / Note Content */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Conteúdo Extraído / Nota ({itemDetail.content?.extractionOrigin ?? "sem extração"})
              </h3>
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 whitespace-pre-wrap max-h-72 overflow-y-auto leading-relaxed">
                {itemDetail.content?.extractedText ||
                  itemDetail.content?.noteText ||
                  "Nenhum texto extraído disponível para este item."}
              </div>
            </div>

            {/* Highlights */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Highlighter className="w-3.5 h-3.5" /> Destaques (Highlights)
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={highlightQuote}
                  onChange={(e) => setHighlightQuote(e.target.value)}
                  placeholder="Trecho relevante..."
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
                <input
                  type="text"
                  value={highlightNote}
                  onChange={(e) => setHighlightNote(e.target.value)}
                  placeholder="Nota opcional"
                  className="w-40 px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!highlightQuote.trim()) return;
                    await fetch(`/api/items/${itemDetail.item.id}/highlights`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        quote: highlightQuote,
                        note: highlightNote,
                      }),
                    });
                    setHighlightQuote("");
                    setHighlightNote("");
                    await openItemDetail(itemDetail.item.id);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs text-white cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {itemDetail.highlights.map((h) => (
                  <div
                    key={h.id}
                    className="p-3 rounded-lg bg-slate-950 border-l-2 border-amber-400 text-xs space-y-1"
                  >
                    <div className="italic text-slate-200">&ldquo;{h.quote}&rdquo;</div>
                    {h.note && <div className="text-slate-400">{h.note}</div>}
                  </div>
                ))}
              </div>
            </div>

            {/* Related Items (Semantic Connections) */}
            {itemDetail.relatedItems && itemDetail.relatedItems.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Conexões Semânticas & Itens Relacionados
                </h3>
                <div className="space-y-2">
                  {itemDetail.relatedItems.map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => openItemDetail(rel.id)}
                      className="w-full text-left p-3 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 flex items-center justify-between gap-3 text-xs transition cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white truncate">
                          {rel.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {rel.connectionReason}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono text-[11px] shrink-0">
                        {Math.round(rel.similarityScore * 100)}%
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

