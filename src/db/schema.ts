import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ============================================================================
// 1. IDENTIDADE E AUTENTICAÇÃO
// ============================================================================

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    status: text("status", { enum: ["active", "suspended", "deleted"] })
      .notNull()
      .default("active"),
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    dailyTokenLimit: integer("daily_token_limit").notNull().default(100000),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_unique_idx").on(table.email)]
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_user_id_idx").on(table.userId),
  ]
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("password_reset_token_hash_idx").on(table.tokenHash),
    index("password_reset_user_id_idx").on(table.userId),
  ]
);

// ============================================================================
// 2. WORKSPACES E COLABORAÇÃO
// ============================================================================

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isPersonal: boolean("is_personal").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("workspaces_owner_id_idx").on(table.ownerId)]
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email"),
    role: text("role", { enum: ["owner", "admin", "member"] })
      .notNull()
      .default("member"),
    status: text("status", { enum: ["active", "invited", "revoked", "expired"] })
      .notNull()
      .default("active"),
    inviteTokenHash: text("invite_token_hash"),
    inviteExpiresAt: timestamp("invite_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("workspace_members_ws_idx").on(table.workspaceId),
    index("workspace_members_user_idx").on(table.userId),
  ]
);

// ============================================================================
// 3. BIBLIOTECA, CONTEÚDO E ARQUIVOS (ASSETS)
// ============================================================================

export const items = pgTable(
  "items",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    type: text("type", { enum: ["link", "note", "file", "image"] }).notNull(),
    title: text("title").notNull(),
    originalUrl: text("original_url"),
    normalizedUrl: text("normalized_url"),
    domain: text("domain"),
    summary: text("summary"),
    summarySource: text("summary_source", { enum: ["manual", "extracted", "ai"] }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    processingStatus: text("processing_status", {
      enum: ["pending", "processing", "completed", "partial", "failed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    processingError: text("processing_error"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    contentVersion: integer("content_version").notNull().default(1),
    importSource: text("import_source"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("items_owner_id_idx").on(table.ownerId),
    index("items_workspace_id_idx").on(table.workspaceId),
    index("items_normalized_url_idx").on(table.ownerId, table.normalizedUrl),
    index("items_status_idx").on(table.ownerId, table.processingStatus),
    index("items_created_at_idx").on(table.ownerId, table.createdAt),
  ]
);

export const itemContents = pgTable(
  "item_contents",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    noteText: text("note_text"),
    extractedText: text("extracted_text"),
    sanitizedHtml: text("sanitized_html"),
    language: text("language").default("pt"),
    extractionOrigin: text("extraction_origin", {
      enum: ["user_note", "web_scraper", "pdf_parser", "ocr", "import"],
    })
      .notNull()
      .default("user_note"),
    extractorVersion: text("extractor_version").notNull().default("1.0.0"),
    contentHash: text("content_hash").notNull(),
    contentVersion: integer("content_version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("item_contents_item_id_unique").on(table.itemId)]
);

export const assets = pgTable(
  "assets",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    storageDriver: text("storage_driver", { enum: ["local", "s3"] })
      .notNull()
      .default("local"),
    originalFileName: text("original_file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256Hash: text("sha256_hash").notNull(),
    verificationStatus: text("verification_status", {
      enum: ["verified", "quarantined", "failed"],
    })
      .notNull()
      .default("verified"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("assets_item_id_idx").on(table.itemId),
    index("assets_owner_id_idx").on(table.ownerId),
    uniqueIndex("assets_storage_key_unique").on(table.storageKey),
  ]
);

// ============================================================================
// 4. ETIQUETAS (TAGS), COLEÇÕES E DESTAQUES (HIGHLIGHTS)
// ============================================================================

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tags_owner_normalized_unique").on(table.ownerId, table.normalizedName),
    index("tags_owner_idx").on(table.ownerId),
  ]
);

export const itemTags = pgTable(
  "item_tags",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    source: text("source", { enum: ["manual", "ai", "automation"] })
      .notNull()
      .default("manual"),
    isConfirmed: boolean("is_confirmed").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("item_tags_item_tag_unique").on(table.itemId, table.tagId),
    index("item_tags_tag_id_idx").on(table.tagId),
  ]
);

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type", { enum: ["manual", "smart"] }).notNull().default("manual"),
    smartRules: jsonb("smart_rules").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("collections_owner_idx").on(table.ownerId)]
);

export const collectionItems = pgTable(
  "collection_items",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("collection_items_unique").on(table.collectionId, table.itemId),
    index("collection_items_item_idx").on(table.itemId),
  ]
);

export const highlights = pgTable(
  "highlights",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    quote: text("quote").notNull(),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("highlights_item_id_idx").on(table.itemId)]
);

// ============================================================================
// 5. PROCESSAMENTO EM SEGUNDO PLANO (JOBS / FILA PERSISTENTE)
// ============================================================================

export const processingJobs = pgTable(
  "processing_jobs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: text("item_id").references(() => items.id, { onDelete: "cascade" }),
    jobType: text("job_type", {
      enum: [
        "fetch_link",
        "extract_content",
        "ocr_asset",
        "chunk_and_index",
        "generate_ai_metadata",
        "generate_embeddings",
        "delete_derived_data",
      ],
    }).notNull(),
    status: text("status", {
      enum: ["pending", "processing", "succeeded", "retrying", "failed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    targetContentVersion: integer("target_content_version").notNull().default(1),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    timeoutMs: integer("timeout_ms").notNull().default(30000),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    lastError: text("last_error"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("processing_jobs_status_next_run_idx").on(table.status, table.nextRunAt),
    index("processing_jobs_item_id_idx").on(table.itemId),
    index("processing_jobs_owner_id_idx").on(table.ownerId),
  ]
);

// ============================================================================
// 6. CHUNKS DE PESQUISA E EMBEDDINGS VETORIAIS
// ============================================================================

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    chunkIndex: integer("chunk_index").notNull(),
    text: text("text").notNull(),
    normalizedText: text("normalized_text").notNull(),
    startOffset: integer("start_offset").notNull(),
    endOffset: integer("end_offset").notNull(),
    locator: text("locator").notNull(),
    textHash: text("text_hash").notNull(),
    contentVersion: integer("content_version").notNull().default(1),
    chunkerVersion: text("chunker_version").notNull().default("1.0.0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("document_chunks_item_id_idx").on(table.itemId),
    index("document_chunks_owner_id_idx").on(table.ownerId),
    uniqueIndex("document_chunks_item_index_unique").on(table.itemId, table.chunkIndex),
  ]
);

export const embeddings = pgTable(
  "embeddings",
  {
    id: text("id").primaryKey(),
    chunkId: text("chunk_id")
      .notNull()
      .references(() => documentChunks.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    provider: text("provider").notNull(),
    modelVersion: text("model_version").notNull(),
    dimensions: integer("dimensions").notNull(),
    vectorJson: jsonb("vector_json").$type<number[]>().notNull(),
    textHash: text("text_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("embeddings_chunk_model_unique").on(table.chunkId, table.modelVersion),
    index("embeddings_item_id_idx").on(table.itemId),
    index("embeddings_owner_id_idx").on(table.ownerId),
  ]
);

// ============================================================================
// 7. CONFIGURAÇÃO DE PROVEDORES DE IA, CUSTOS, API TOKENS, AUTOMAÇÕES E AUDITORIA
// ============================================================================

export const aiProviderConfigs = pgTable(
  "ai_provider_configs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["extractive", "openai", "ollama"] })
      .notNull()
      .default("extractive"),
    baseUrl: text("base_url"),
    apiKeyEncrypted: text("api_key_encrypted"),
    chatModel: text("chat_model").notNull().default("gpt-4o-mini"),
    embeddingModel: text("embedding_model").notNull().default("text-embedding-3-small"),
    embeddingDimensions: integer("embedding_dimensions").notNull().default(64),
    isEnabled: boolean("is_enabled").notNull().default(true),
    autoSummarize: boolean("auto_summarize").notNull().default(true),
    autoSuggestTags: boolean("auto_suggest_tags").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ai_provider_configs_owner_unique").on(table.ownerId)]
);

export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    operation: text("operation", {
      enum: ["assistant_answer", "embedding", "summary", "tag_suggestion", "ocr"],
    }).notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    estimatedCostUsdMicros: integer("estimated_cost_usd_micros").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ai_usage_logs_owner_date_idx").on(table.ownerId, table.createdAt)]
);

export const apiTokens = pgTable(
  "api_tokens",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    tokenHash: text("token_hash").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default(["read", "write"]),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("api_tokens_hash_unique").on(table.tokenHash),
    index("api_tokens_owner_idx").on(table.ownerId),
  ]
);

export const automationRules = pgTable(
  "automation_rules",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    triggerEvent: text("trigger_event", {
      enum: ["item_created", "content_extracted"],
    })
      .notNull()
      .default("item_created"),
    conditions: jsonb("conditions")
      .$type<{
        domainContains?: string;
        titleContains?: string;
        itemType?: "link" | "note" | "file" | "image";
      }>()
      .notNull(),
    actions: jsonb("actions")
      .$type<{
        addTags?: string[];
        addToCollectionId?: string;
        markFavorite?: boolean;
      }>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("automation_rules_owner_idx").on(table.ownerId)]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorId: text("actor_id"),
    workspaceId: text("workspace_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorId),
    index("audit_logs_workspace_idx").on(table.workspaceId),
  ]
);

export const webhooks = pgTable(
  "webhooks",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    targetUrl: text("target_url").notNull(),
    secretEncrypted: text("secret_encrypted").notNull(),
    events: jsonb("events")
      .$type<Array<"item.created" | "item.processed" | "item.deleted">>()
      .notNull()
      .default(["item.created", "item.processed"]),
    isActive: boolean("is_active").notNull().default(true),
    lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
    lastStatus: integer("last_status"),
    failureCount: integer("failure_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("webhooks_owner_idx").on(table.ownerId)]
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    signature: text("signature").notNull(),
    statusCode: integer("status_code"),
    success: boolean("success").notNull().default(false),
    errorMessage: text("error_message"),
    attempts: integer("attempts").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("webhook_deliveries_webhook_idx").on(table.webhookId),
    index("webhook_deliveries_owner_idx").on(table.ownerId),
  ]
);

export const rssFeeds = pgTable(
  "rss_feeds",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    feedUrl: text("feed_url").notNull(),
    siteUrl: text("site_url"),
    autoTags: jsonb("auto_tags").$type<string[]>().notNull().default([]),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "set null",
    }),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    itemsImportedCount: integer("items_imported_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("rss_feeds_owner_idx").on(table.ownerId),
    uniqueIndex("rss_feeds_owner_url_unique").on(table.ownerId, table.feedUrl),
  ]
);

// ============================================================================
// 8. HISTÓRICO AUDITÁVEL DO ASSISTENTE RAG E GOVERNANÇA DE RETENÇÃO
// ============================================================================

export const assistantConversations = pgTable(
  "assistant_conversations",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("assistant_conversations_owner_idx").on(table.ownerId, table.updatedAt),
  ]
);

export const assistantMessages = pgTable(
  "assistant_messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => assistantConversations.id, { onDelete: "cascade" }),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    citationsJson: jsonb("citations_json")
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default([]),
    metadataJson: jsonb("metadata_json")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("assistant_messages_conversation_idx").on(
      table.conversationId,
      table.createdAt
    ),
    index("assistant_messages_owner_idx").on(table.ownerId),
  ]
);




