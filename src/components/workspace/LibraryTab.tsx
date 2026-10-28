"use client";

import React from "react";
import {
  Search,
  Star,
  Archive,
  Trash2,
  ExternalLink,
  FileText,
  Link2,
  Image as ImageIcon,
  File,
  Sparkles,
  CheckSquare,
  Square,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import type {
  CollectionInfo,
  SearchItem,
  TagInfo,
} from "@/types/platform";

interface LibraryTabProps {
  items: SearchItem[];
  totalItems: number;
  effectiveMode: string;
  loading: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  searchMode: "hybrid" | "lexical" | "semantic";
  onSearchModeChange: (m: "hybrid" | "lexical" | "semantic") => void;
  sortBy: "relevance" | "newest" | "oldest" | "title";
  onSortByChange: (s: "relevance" | "newest" | "oldest" | "title") => void;
  filterType: string;
  onFilterTypeChange: (t: string) => void;
  filterStatus: string;
  onFilterStatusChange: (s: string) => void;
  selectedCollectionId: string;
  onSelectCollectionId: (id: string) => void;
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  onlyFavorites: boolean;
  onToggleOnlyFavorites: () => void;
  includeArchived: boolean;
  onToggleIncludeArchived: () => void;
  collections: CollectionInfo[];
  tags: TagInfo[];
  selectedItemIds: string[];
  onToggleSelectItem: (id: string) => void;
  onSelectAllItems: () => void;
  onClearSelection: () => void;
  onBatchAction: (
    action: "favorite" | "unfavorite" | "archive" | "unarchive" | "delete" | "addTag" | "addToCollection",
    extra?: { tagName?: string; collectionId?: string }
  ) => Promise<void>;
  onOpenItemDetail: (id: string) => void;
  onToggleFavoriteItem: (item: SearchItem) => Promise<void>;
  onToggleArchiveItem: (item: SearchItem) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onResetFilters: () => void;
  onIngestOfficialDocs?: () => Promise<void>;
}

const DSL_SUGGESTIONS = [
  { label: "is:fav", description: "Apenas favoritos" },
  { label: "type:note", description: "Notas em Markdown" },
  { label: "type:link", description: "Páginas Web" },
  { label: "#arquitetura", description: "Tag #arquitetura" },
  { label: "status:ready", description: "Indexados" },
];

function getItemTypeIcon(type: SearchItem["type"]) {
  switch (type) {
    case "link":
      return <Link2 className="w-3.5 h-3.5 text-brand-text" />;
    case "image":
      return <ImageIcon className="w-3.5 h-3.5 text-purple-500" />;
    case "file":
      return <File className="w-3.5 h-3.5 text-emerald-500" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-amber-500" />;
  }
}

export function LibraryTab({
  items,
  totalItems,
  effectiveMode,
  loading,
  query,
  onQueryChange,
  searchMode,
  onSearchModeChange,
  sortBy,
  onSortByChange,
  filterType,
  onFilterTypeChange,
  filterStatus,
  onFilterStatusChange,
  selectedCollectionId,
  onSelectCollectionId,
  selectedTag,
  onSelectTag,
  onlyFavorites,
  onToggleOnlyFavorites,
  includeArchived,
  onToggleIncludeArchived,
  collections,
  tags,
  selectedItemIds,
  onToggleSelectItem,
  onSelectAllItems,
  onClearSelection,
  onBatchAction,
  onOpenItemDetail,
  onToggleFavoriteItem,
  onToggleArchiveItem,
  onDeleteItem,
  onResetFilters,
  onIngestOfficialDocs,
}: LibraryTabProps) {
  function appendDslToken(token: string) {
    if (query.includes(token)) return;
    onQueryChange(query.trim() ? `${query.trim()} ${token}` : token);
  }

  return (
    <div className="space-y-5">
      {/* Search & Query DSL Panel */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-fg-muted absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="Pesquisa híbrida ou Query DSL (ex: arquitetura #rag type:note is:fav after:2025-01-01)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-inset border border-border-subtle text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={searchMode}
              onChange={(e) =>
                onSearchModeChange(e.target.value as "hybrid" | "lexical" | "semantic")
              }
              aria-label="Modo de recuperação"
            >
              <option value="hybrid">Modo Híbrido (RRF)</option>
              <option value="lexical">Lexical (FTS / BM25)</option>
              <option value="semantic">Semântico (Vetorial)</option>
            </Select>

            <Select
              value={sortBy}
              onChange={(e) =>
                onSortByChange(
                  e.target.value as "relevance" | "newest" | "oldest" | "title"
                )
              }
              aria-label="Ordenação"
            >
              <option value="relevance">Ordenar: Relevância</option>
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
              <option value="title">Título (A–Z)</option>
            </Select>
          </div>
        </div>

        {/* DSL quick tokens + Filters row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border-subtle">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-fg-muted flex items-center gap-1 mr-1">
              <SlidersHorizontal className="w-3 h-3" /> Query DSL:
            </span>
            {DSL_SUGGESTIONS.map((dsl) => (
              <button
                key={dsl.label}
                type="button"
                onClick={() => appendDslToken(dsl.label)}
                title={dsl.description}
                className="px-2 py-0.5 rounded-lg bg-elevated hover:bg-inset text-[11px] font-mono text-fg-secondary hover:text-brand-text border border-border-subtle transition cursor-pointer"
              >
                {dsl.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterType}
              onChange={(e) => onFilterTypeChange(e.target.value)}
              className="rounded-lg bg-inset border border-border-subtle px-2.5 py-1 text-xs text-fg"
            >
              <option value="">Todos os tipos</option>
              <option value="link">Links Web</option>
              <option value="note">Notas</option>
              <option value="file">Arquivos / PDFs</option>
              <option value="image">Imagens</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => onFilterStatusChange(e.target.value)}
              className="rounded-lg bg-inset border border-border-subtle px-2.5 py-1 text-xs text-fg"
            >
              <option value="">Todos os status</option>
              <option value="ready">Indexados (Ready)</option>
              <option value="pending">Na fila (Pending)</option>
              <option value="failed">Com falha</option>
            </select>

            <select
              value={selectedCollectionId}
              onChange={(e) => onSelectCollectionId(e.target.value)}
              className="rounded-lg bg-inset border border-border-subtle px-2.5 py-1 text-xs text-fg"
            >
              <option value="">Todas as coleções</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isSmartCollection ? `⚡ ${c.name}` : `📁 ${c.name}`}
                </option>
              ))}
            </select>

            <select
              value={selectedTag}
              onChange={(e) => onSelectTag(e.target.value)}
              className="rounded-lg bg-inset border border-border-subtle px-2.5 py-1 text-xs text-fg"
            >
              <option value="">Todas as tags</option>
              {tags.map((t) => (
                <option key={t.id} value={t.name}>
                  #{t.name} ({t.itemCount})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onToggleOnlyFavorites}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                onlyFavorites
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40"
                  : "bg-elevated text-fg-secondary border-border-subtle"
              }`}
            >
              ★ Favoritos
            </button>

            <button
              type="button"
              onClick={onToggleIncludeArchived}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer ${
                includeArchived
                  ? "bg-brand-soft text-brand-text border-brand/40"
                  : "bg-elevated text-fg-secondary border-border-subtle"
              }`}
            >
              Arquivados
            </button>

            <Button
              size="xs"
              variant="ghost"
              onClick={onResetFilters}
              title="Limpar busca e filtros"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Status & Batch Selection Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-fg-secondary">
          <span>
            Exibindo <strong className="text-fg">{items.length}</strong> de{" "}
            <strong className="text-fg">{totalItems}</strong> itens
          </span>
          <Badge variant="brand">Motor: {effectiveMode}</Badge>
          {loading && <Badge variant="warning">Atualizando...</Badge>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {totalItems < 10 && onIngestOfficialDocs && (
            <Button
              size="xs"
              variant="outline"
              onClick={onIngestOfficialDocs}
              title="Importar os 28 documentos oficiais de arquitetura da plataforma para esta conta"
            >
              + Carregar Documentação Oficial (28 docs)
            </Button>
          )}
          {selectedItemIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 bg-surface border border-brand/40 rounded-xl px-3 py-1.5 shadow-sm">
              <span className="text-xs font-semibold text-brand-text mr-1">
                {selectedItemIds.length} selecionado(s)
              </span>
              <Button
                size="xs"
                variant="secondary"
                onClick={() => onBatchAction("favorite")}
              >
                Favoritar
              </Button>
              <Button
                size="xs"
                variant="secondary"
                onClick={() => onBatchAction("archive")}
              >
                Arquivar
              </Button>
              <Button
                size="xs"
                variant="danger"
                onClick={() => onBatchAction("delete")}
              >
                Excluir
              </Button>
              <Button size="xs" variant="ghost" onClick={onClearSelection}>
                Cancelar
              </Button>
            </div>
          ) : (
            items.length > 0 && (
              <Button size="xs" variant="ghost" onClick={onSelectAllItems}>
                Selecionar todos ({items.length})
              </Button>
            )
          )}
        </div>
      </div>

      {/* Items Grid */}
      {items.length === 0 && !loading ? (
        <Card padding="lg" className="text-center py-14 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-soft text-brand-text flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-fg">
            Nenhum item encontrado para os filtros atuais
          </h3>
          <p className="text-xs text-fg-secondary max-w-md mx-auto">
            Tente limpar os filtros, usar outros termos na busca híbrida ou capturar um novo link, nota ou arquivo.
          </p>
          <div className="pt-2">
            <Button size="sm" variant="outline" onClick={onResetFilters}>
              Limpar Filtros de Busca
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const isSelected = selectedItemIds.includes(item.id);
            return (
              <Card
                key={item.id}
                interactive
                selected={isSelected}
                padding="md"
                className="flex flex-col justify-between gap-3 group"
                onClick={() => onOpenItemDetail(item.id)}
              >
                <div className="space-y-2.5">
                  {/* Card Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelectItem(item.id);
                        }}
                        className="text-fg-muted hover:text-brand-text transition cursor-pointer"
                        aria-label="Selecionar item"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-brand-text" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-fg-secondary uppercase">
                        {getItemTypeIcon(item.type)}
                        {item.type}
                      </span>
                      {(item.processingStatus || item.status || "ready") !== "ready" && (
                        <Badge
                          variant={
                            (item.processingStatus || item.status) === "failed"
                              ? "danger"
                              : "warning"
                          }
                        >
                          {item.processingStatus || item.status}
                        </Badge>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleFavoriteItem(item)}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          item.isFavorite
                            ? "text-amber-500 bg-amber-500/10"
                            : "text-fg-muted hover:text-fg hover:bg-elevated"
                        }`}
                        title="Favoritar"
                      >
                        <Star
                          className="w-3.5 h-3.5"
                          fill={item.isFavorite ? "currentColor" : "none"}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleArchiveItem(item)}
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          item.isArchived
                            ? "text-brand-text bg-brand-soft"
                            : "text-fg-muted hover:text-fg hover:bg-elevated"
                        }`}
                        title="Arquivar"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="p-1.5 rounded-lg text-fg-muted hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                        title="Excluir item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-fg group-hover:text-brand-text transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </h3>

                  {/* Domain or URL */}
                  {(item.originalUrl || item.sourceUrl) && (
                    <a
                      href={(item.originalUrl || item.sourceUrl)!}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] text-brand-text hover:underline truncate max-w-full"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {item.domain || item.originalUrl || item.sourceUrl}
                      </span>
                    </a>
                  )}

                  {/* Snippet / Summary */}
                  <p className="text-xs text-fg-secondary line-clamp-3 leading-relaxed">
                    {item.snippet || item.summary || "Sem resumo disponível."}
                  </p>
                </div>

                {/* Footer: Tags & Match Reason */}
                <div className="pt-2.5 border-t border-border-subtle space-y-2">
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.slice(0, 5).map((t) => (
                        <Badge
                          key={t.name}
                          variant={t.origin === "ai" ? "purple" : "default"}
                        >
                          {t.origin === "ai" && (
                            <Sparkles className="w-2.5 h-2.5" />
                          )}
                          #{t.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-fg-muted">
                    <span>
                      {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                    {item.matchReasons && item.matchReasons.length > 0 && (
                      <span className="font-mono text-[10px] text-brand-text">
                        {item.matchReasons[0]}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
