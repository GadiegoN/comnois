"use client";

import React, { useState } from "react";
import { Link2, FileText, Upload, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import type { CollectionInfo } from "@/types/platform";

interface CaptureBarModalProps {
  collections: CollectionInfo[];
  onClose: () => void;
  onCreated: () => Promise<void>;
  onFeedback: (msg: string, isError?: boolean) => void;
}

export function CaptureBarModal({
  collections,
  onClose,
  onCreated,
  onFeedback,
}: CaptureBarModalProps) {
  const [captureType, setCaptureType] = useState<"link" | "note" | "file">("link");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const parsedTags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (captureType === "file") {
        if (!file) {
          throw new Error("Selecione um arquivo PDF, imagem ou texto para enviar.");
        }
        const formData = new FormData();
        formData.append("file", file);
        if (title.trim()) formData.append("title", title.trim());
        if (noteContent.trim()) formData.append("summary", noteContent.trim());
        if (parsedTags.length > 0) formData.append("tags", parsedTags.join(","));
        if (collectionId) formData.append("collectionId", collectionId);

        const res = await fetch("/api/items", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Erro ao capturar arquivo.");
        }
      } else {
        const payload =
          captureType === "link"
            ? {
                type: "link",
                url: url.trim(),
                title: title.trim() || undefined,
                summary: noteContent.trim() || undefined,
                tags: parsedTags,
                collectionId: collectionId || undefined,
              }
            : {
                type: "note",
                title: title.trim(),
                noteText: noteContent.trim(),
                tags: parsedTags,
                collectionId: collectionId || undefined,
              };

        const res = await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Erro ao capturar item.");
        }
      }

      onFeedback("Item capturado e enfileirado para indexação híbrida!");
      setUrl("");
      setTitle("");
      setNoteContent("");
      setTagsInput("");
      setFile(null);
      await onCreated();
      onClose();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao capturar item.",
        true
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card padding="lg" className="mb-6 border-brand/40 bg-surface">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCaptureType("link")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              captureType === "link"
                ? "bg-brand text-white"
                : "bg-elevated text-fg-secondary hover:text-fg"
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Salvar URL / Artigo
          </button>
          <button
            type="button"
            onClick={() => setCaptureType("note")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              captureType === "note"
                ? "bg-brand text-white"
                : "bg-elevated text-fg-secondary hover:text-fg"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Nova Nota Markdown
          </button>
          <button
            type="button"
            onClick={() => setCaptureType("file")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
              captureType === "file"
                ? "bg-brand text-white"
                : "bg-elevated text-fg-secondary hover:text-fg"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Arquivo / Imagem
          </button>
        </div>

        <Button size="xs" variant="ghost" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {captureType === "link" && (
            <Input
              label="URL da página ou artigo"
              type="url"
              required
              placeholder="https://exemplo.com/artigo-tecnico"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}

          {captureType === "file" && (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-fg-secondary">
                Arquivo (PDF, Markdown, TXT, PNG, JPEG, WEBP)
              </label>
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full rounded-xl bg-inset border border-border-subtle px-3 py-1.5 text-xs text-fg file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white"
              />
            </div>
          )}

          <Input
            label={
              captureType === "link"
                ? "Título personalizado (opcional)"
                : "Título do documento"
            }
            required={captureType === "note"}
            placeholder="Ex: Arquitetura de Busca Híbrida RRF"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <Textarea
          label={
            captureType === "note"
              ? "Conteúdo em Markdown"
              : "Notas / Resumo adicional (opcional)"
          }
          rows={captureType === "note" ? 4 : 2}
          required={captureType === "note"}
          placeholder="Escreva anotações, trechos importantes ou contexto..."
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <Input
            label="Tags (separadas por vírgula)"
            placeholder="arquitetura, rag, seguranca"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />

          <Select
            label="Coleção inicial (opcional)"
            value={collectionId}
            onChange={(e) => setCollectionId(e.target.value)}
          >
            <option value="">Sem coleção específica</option>
            {collections
              .filter((c) => !c.isSmartCollection)
              .map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
          </Select>

          <Button
            type="submit"
            disabled={submitting}
            leftIcon={<Plus className="w-4 h-4" />}
            className="w-full"
          >
            {submitting ? "Capturando & Indexando..." : "Salvar na Biblioteca"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

