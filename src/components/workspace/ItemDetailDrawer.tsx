"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Edit3,
  Save,
  Sparkles,
  Check,
  XCircle,
  Download,
  FileDown,
  Highlighter,
  Network,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import type { ItemDetailData } from "@/types/platform";

interface ItemDetailDrawerProps {
  item: ItemDetailData | null;
  onClose: () => void;
  onOpenOtherItem: (id: string) => void;
  onReloadItem: (id: string) => Promise<void>;
  onRefreshLibrary: () => Promise<void>;
  onFeedback: (msg: string, isError?: boolean) => void;
}

export function ItemDetailDrawer({
  item: detail,
  onClose,
  onOpenOtherItem,
  onReloadItem,
  onRefreshLibrary,
  onFeedback,
}: ItemDetailDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editTextContent, setEditTextContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [highlightQuote, setHighlightQuote] = useState("");
  const [highlightNote, setHighlightNote] = useState("");
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);

  const coreItem = detail?.item;
  const fullText =
    detail?.content?.noteText ||
    detail?.content?.extractedText ||
    coreItem?.summary ||
    "";

  useEffect(() => {
    if (detail && coreItem) {
      setEditing(false);
      setEditTitle(coreItem.title || "");
      setEditSummary(coreItem.summary || "");
      setEditTextContent(fullText);
      setEditTags((detail.tags || []).map((t) => t.name).join(", "));
    }
  }, [detail, coreItem, fullText]);

  if (!detail || !coreItem) return null;

  const itemId = coreItem.id;
  const itemStatus = coreItem.processingStatus || coreItem.status || "ready";
  const itemUrl = coreItem.originalUrl || coreItem.sourceUrl || null;

  async function handleSaveEdit() {
    setSavingEdit(true);
    try {
      const parsedTags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          summary: editSummary.trim(),
          noteText: editTextContent,
          tags: parsedTags,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Erro ao atualizar item.");
      }
      setEditing(false);
      onFeedback("Documento atualizado e reindexado com sucesso!");
      await onReloadItem(itemId);
      await onRefreshLibrary();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao salvar alterações.",
        true
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleTagReview(tagId: string, decision: "confirm" | "reject") {
    try {
      const res = await fetch(`/api/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          tagId,
          action: decision === "confirm" ? "confirmTag" : "rejectTag",
        }),
      });
      if (!res.ok) {
        throw new Error("Erro ao revisar tag sugerida pela IA.");
      }
      onFeedback(
        decision === "confirm"
          ? "Tag de IA confirmada!"
          : "Tag sugerida rejeitada e removida."
      );
      await onReloadItem(itemId);
      await onRefreshLibrary();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao revisar tag.",
        true
      );
    }
  }

  async function handleCreateOfflineSnapshot() {
    setCreatingSnapshot(true);
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_snapshot" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Falha ao gerar snapshot.");
      }
      onFeedback("Snapshot offline (.md) gerado e anexado com checksum SHA-256!");
      await onReloadItem(itemId);
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao gerar snapshot.",
        true
      );
    } finally {
      setCreatingSnapshot(false);
    }
  }

  async function handleAddHighlight(e: React.FormEvent) {
    e.preventDefault();
    if (!highlightQuote.trim()) return;
    try {
      const res = await fetch(`/api/items/${itemId}/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote: highlightQuote.trim(),
          note: highlightNote.trim() || undefined,
          color: "yellow",
        }),
      });
      if (!res.ok) {
        throw new Error("Falha ao criar destaque.");
      }
      setHighlightQuote("");
      setHighlightNote("");
      onFeedback("Destaque salvo no documento!");
      await onReloadItem(itemId);
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao salvar destaque.",
        true
      );
    }
  }

  async function handleDeleteHighlight(highlightId: string) {
    try {
      await fetch(`/api/items/${itemId}/highlights?highlightId=${highlightId}`, {
        method: "DELETE",
      });
      await onReloadItem(itemId);
    } catch {
      // ignore
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-3xl bg-surface border-l border-border-subtle h-full overflow-y-auto p-6 space-y-6 shadow-2xl">
        {/* Top Drawer Bar */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-border-subtle">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="brand">{coreItem.type.toUpperCase()}</Badge>
              <Badge
                variant={
                  itemStatus === "ready" || itemStatus === "completed"
                    ? "success"
                    : itemStatus === "failed"
                      ? "danger"
                      : "warning"
                }
              >
                {itemStatus}
              </Badge>
              <span className="text-xs text-fg-muted">
                Salvo em {new Date(coreItem.createdAt).toLocaleString("pt-BR")}
              </span>
            </div>
            <h2 className="text-lg font-bold text-fg leading-snug">
              {coreItem.title}
            </h2>
            {itemUrl && (
              <a
                href={itemUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand-text hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {itemUrl}
              </a>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Edit3 className="w-3.5 h-3.5" />}
              onClick={() => setEditing(!editing)}
            >
              {editing ? "Cancelar" : "Editar"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Edit Mode or Reader View */}
        {editing ? (
          <Card padding="md" className="space-y-4 bg-elevated/40">
            <Input
              label="Título"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <Textarea
              label="Resumo / Síntese"
              rows={2}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
            />
            <Textarea
              label="Conteúdo Extraído / Markdown"
              rows={8}
              value={editTextContent}
              onChange={(e) => setEditTextContent(e.target.value)}
            />
            <Input
              label="Tags (separadas por vírgula)"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="primary"
                disabled={savingEdit}
                leftIcon={<Save className="w-3.5 h-3.5" />}
                onClick={handleSaveEdit}
              >
                {savingEdit ? "Salvando..." : "Salvar e Reindexar"}
              </Button>
            </div>
          </Card>
        ) : (
          <>
            {/* Tags & AI Tag Review */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                Tags & Classificação Assistida por IA
              </div>
              <div className="flex flex-wrap gap-2">
                {detail.tags.length === 0 && (
                  <span className="text-xs text-fg-muted">
                    Nenhuma tag atribuída.
                  </span>
                )}
                {detail.tags.map((t) => {
                  const tagIdentifier = t.tagId || t.id;
                  const isAiTag = t.origin === "ai" || t.source === "ai";
                  return (
                    <div
                      key={tagIdentifier}
                      className="inline-flex items-center gap-1.5 rounded-full bg-elevated border border-border-subtle px-3 py-1 text-xs"
                    >
                      {isAiTag && (
                        <Sparkles className="w-3 h-3 text-purple-500" />
                      )}
                      <span className="font-medium text-fg">#{t.name}</span>
                      {t.confidence !== undefined && isAiTag && (
                        <span className="text-[10px] text-fg-muted">
                          ({Math.round(t.confidence * 100)}%)
                        </span>
                      )}
                      {isAiTag && !t.isConfirmed && (
                        <div className="flex items-center gap-1 ml-1 pl-1 border-l border-border-subtle">
                          <button
                            type="button"
                            onClick={() => handleTagReview(tagIdentifier, "confirm")}
                            title="Confirmar tag sugerida pela IA"
                            className="text-emerald-500 hover:text-emerald-600 cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTagReview(tagIdentifier, "reject")}
                            title="Rejeitar tag sugerida pela IA"
                            className="text-red-500 hover:text-red-600 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Summary */}
            {coreItem.summary && (
              <Card padding="md" className="bg-brand-soft/30 border-brand/30">
                <div className="text-xs font-semibold text-brand-text mb-1">
                  Resumo Executivo
                </div>
                <p className="text-xs text-fg leading-relaxed">
                  {coreItem.summary}
                </p>
              </Card>
            )}

            {/* Full Extracted Text Content */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                  Conteúdo Integral Extraído
                </span>
                <Button
                  size="xs"
                  variant="outline"
                  disabled={creatingSnapshot}
                  leftIcon={<FileDown className="w-3.5 h-3.5" />}
                  onClick={handleCreateOfflineSnapshot}
                >
                  {creatingSnapshot
                    ? "Gerando Snapshot..."
                    : "Gerar Snapshot Offline (.md)"}
                </Button>
              </div>
              <div className="rounded-2xl bg-inset border border-border-subtle p-5 max-h-96 overflow-y-auto text-xs sm:text-sm text-fg whitespace-pre-wrap leading-relaxed font-sans">
                {fullText || "Sem conteúdo textual extraído."}
              </div>
            </div>

            {/* Private Assets & Offline Snapshots */}
            {detail.assets && detail.assets.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                  Arquivos & Snapshots Armazenados (CAS SHA-256)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {detail.assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-xl bg-elevated border border-border-subtle"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-fg truncate">
                          {asset.originalFileName || asset.originalFilename || asset.id}
                        </div>
                        <div className="text-[11px] text-fg-muted">
                          {asset.mimeType} • {(asset.sizeBytes / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <a
                        href={asset.downloadUrl || `/api/assets/${asset.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-brand text-white px-2.5 py-1.5 text-xs font-medium hover:bg-brand-hover shrink-0"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Baixar
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Highlights & Annotations */}
            <div className="space-y-3 pt-2 border-t border-border-subtle">
              <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted flex items-center gap-1.5">
                <Highlighter className="w-3.5 h-3.5 text-amber-500" />
                Destaques & Anotações Pessoais ({detail.highlights.length})
              </div>

              <form
                onSubmit={handleAddHighlight}
                className="grid grid-cols-1 sm:grid-cols-3 gap-2"
              >
                <input
                  type="text"
                  required
                  placeholder="Trecho destacado..."
                  value={highlightQuote}
                  onChange={(e) => setHighlightQuote(e.target.value)}
                  className="rounded-xl bg-inset border border-border-subtle px-3 py-1.5 text-xs text-fg"
                />
                <input
                  type="text"
                  placeholder="Nota sobre o trecho (opcional)..."
                  value={highlightNote}
                  onChange={(e) => setHighlightNote(e.target.value)}
                  className="rounded-xl bg-inset border border-border-subtle px-3 py-1.5 text-xs text-fg"
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Adicionar Destaque
                </Button>
              </form>

              {detail.highlights.length > 0 && (
                <div className="space-y-2">
                  {detail.highlights.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-start justify-between gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30"
                    >
                      <div className="space-y-1">
                        <p className="text-xs italic text-fg">
                          &ldquo;{h.quote}&rdquo;
                        </p>
                        {h.note && (
                          <p className="text-[11px] text-fg-secondary">
                            Nota: {h.note}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteHighlight(h.id)}
                        className="text-fg-muted hover:text-red-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Semantic Related Items Graph */}
            {detail.relatedItems && detail.relatedItems.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border-subtle">
                <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-brand-text" />
                  Conexões Semânticas Automáticas ({detail.relatedItems.length})
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {detail.relatedItems.map((rel) => {
                    const targetId = rel.itemId || rel.id;
                    return (
                      <Card
                        key={targetId}
                        interactive
                        padding="sm"
                        onClick={() => onOpenOtherItem(targetId)}
                        className="space-y-1 bg-elevated/50"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="brand">
                            Similaridade {Math.round(rel.similarityScore * 100)}%
                          </Badge>
                          <span className="text-[10px] uppercase text-fg-muted">
                            {rel.type}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-fg line-clamp-1">
                          {rel.title}
                        </div>
                        {rel.sharedTags.length > 0 && (
                          <div className="text-[11px] text-fg-secondary">
                            Tags em comum:{" "}
                            {rel.sharedTags.map((t) => `#${t}`).join(", ")}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
