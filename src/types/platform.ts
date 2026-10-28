export type ThemeMode = "light" | "sepia" | "dark" | "nord";

export type WorkspaceTabId =
  | "library"
  | "assistant"
  | "organization"
  | "jobs"
  | "portability"
  | "settings";

export interface UserInfo {
  id: string;
  email: string;
  displayName: string;
  aiEnabled: boolean;
  dailyTokenLimit: number;
}

export interface SearchItem {
  id: string;
  type: "link" | "note" | "file" | "image";
  title: string;
  originalUrl: string | null;
  sourceUrl?: string | null;
  domain: string | null;
  summary: string | null;
  processingStatus: string;
  status?: string;
  processingError: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  tags: Array<{ id: string; name: string; source: string; origin?: string }>;
  snippet?: string;
  score: number;
  matchReasons?: string[];
}

export interface CollectionInfo {
  id: string;
  parentId?: string | null;
  name: string;
  description: string | null;
  type?: "manual" | "smart";
  isSmartCollection?: boolean;
  smartQuery?: string | null;
  smartRules?: {
    query?: string;
    itemTypes?: string[];
    domainContains?: string;
    isFavorite?: boolean;
  } | null;
  itemCount: number;
}

export interface TagInfo {
  id: string;
  name: string;
  normalizedName: string;
  itemCount: number;
}

export interface VerifiedCitation {
  citationId?: string;
  itemId: string;
  chunkId: string;
  title: string;
  itemTitle?: string;
  originalUrl: string | null;
  domain: string | null;
  quote: string;
  locator: string;
  sectionTitle?: string | null;
  verifiedLiteral?: boolean;
  startOffset: number;
  endOffset: number;
}

export interface AssistantAnswer {
  conversationId?: string;
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

export interface RelatedItemConnection {
  id: string;
  itemId?: string;
  type: string;
  title: string;
  originalUrl: string | null;
  domain: string | null;
  similarityScore: number;
  sharedTags: string[];
  connectionReason: string;
}

export interface ItemDetailData {
  item: SearchItem & { contentVersion: number };
  content: {
    noteText: string | null;
    extractedText: string | null;
    extractionOrigin: string;
  } | null;
  assets: Array<{
    id: string;
    originalFileName: string;
    originalFilename?: string;
    mimeType: string;
    sizeBytes: number;
    downloadUrl: string;
  }>;
  tags: Array<{
    id: string;
    tagId?: string;
    name: string;
    source: string;
    origin?: string;
    confidence?: number;
    isConfirmed?: boolean;
  }>;
  collections: Array<{ id: string; name: string }>;
  highlights: Array<{ id: string; quote: string; note: string | null }>;
  jobs: Array<{
    id: string;
    jobType: string;
    status: string;
    attempts: number;
    lastError: string | null;
  }>;
  relatedItems?: RelatedItemConnection[];
}

export interface QueueMetricsData {
  counts: Record<string, number>;
  oldestPendingAgeMs: number;
  recentJobs: Array<{
    id: string;
    itemId?: string | null;
    jobType: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    createdAt: string;
  }>;
}

export interface HealthDiagnosticsData {
  status: string;
  database: { connected: boolean; latencyMs: number; totalItemsCount?: number };
  storage: {
    totalFiles: number;
    totalBytes: number;
    integrityVerifiedCount: number;
    missingBlobsCount: number;
  };
  aiUsageToday?: {
    totalTokensToday: number;
    dailyTokenLimit: number;
    estimatedCostUsd: number;
    operationsCount: number;
  };
  embeddingIndex?: {
    totalActiveItems: number;
    totalChunks: number;
    embeddedChunksCount: number;
    chunksWithEmbeddings?: number;
    missingEmbeddingsCount: number;
    outdatedChunks?: number;
    coveragePercent: number;
    configuredProvider: string;
    configuredModel: string;
    activeModelVersion?: string;
    configuredDimensions: number;
    hasModelDrift: boolean;
    hasDimensionMismatch: boolean;
    estimatedTokensToReembed: number;
    recommendation: string;
  };
}

export interface BenchmarkReportData {
  modes?: Record<"lexical" | "semantic" | "hybrid", { recallAt3: number; mrr: number }>;
  searchComparison?: Record<
    "lexical" | "semantic" | "hybrid",
    {
      avgRecallAtK: number;
      avgMrr: number;
      avgNdcg: number;
      avgLatencyMs: number;
    }
  >;
  ragEvaluation: {
    citationAccuracyRate?: number;
    citationPrecision?: number;
    abstentionAccuracy?: number;
    injectionResistanceRate?: number;
  };
}

export interface AiConfigData {
  provider?: "extractive" | "openai" | "ollama";
  preferredProvider?: string;
  baseUrl?: string | null;
  hasApiKey?: boolean;
  maskedApiKey?: string;
  chatModel?: string;
  embeddingModel?: string;
  embeddingDimensions?: number;
  isEnabled?: boolean;
  autoSummarize?: boolean;
  autoSuggestTags?: boolean;
  autoTaggingEnabled?: boolean;
  dailyTokenLimit?: number;
}

export interface AiUsageData {
  totalTokensToday: number;
  dailyTokenLimit: number;
  estimatedCostUsd: number;
  operationsCount: number;
}

export interface WorkspacesSettingsData {
  workspaces?: Array<{ id: string; name: string; slug: string; role: string }>;
  owned?: Array<{ id: string; name: string; slug?: string }>;
  apiTokens?: Array<{
    id: string;
    name: string;
    tokenPrefix: string;
    scopes: string[];
    createdAt: string;
  }>;
  automationRules?: Array<{ id: string; name: string; isActive: boolean }>;
  webhooks?: Array<{
    id: string;
    name: string;
    targetUrl: string;
    events: string[];
    isActive: boolean;
    lastStatus: number | null;
    failureCount: number;
  }>;
  rssFeeds?: Array<{
    id: string;
    title: string;
    feedUrl: string;
    autoTags: string[];
    itemsImportedCount: number;
    lastSyncedAt: string | null;
    lastError: string | null;
  }>;
  sessions?: Array<{
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    expiresAt: string;
  }>;
}
