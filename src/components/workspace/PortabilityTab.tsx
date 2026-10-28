"use client";

import React, { useState } from "react";
import { Download, Upload, Eye, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Input";

interface PortabilityTabProps {
  onRefreshLibrary: () => Promise<void>;
  onFeedback: (msg: string, isError?: boolean) => void;
}

export function PortabilityTab({
  onRefreshLibrary,
  onFeedback,
}: PortabilityTabProps) {
  const [importFormat, setImportFormat] = useState<"json" | "html">("json");
  const [duplicatePolicy, setDuplicatePolicy] = useState<
    "skip" | "overwrite" | "append"
  >("skip");
  const [rawContent, setRawContent] = useState("");
  const [dryRunResult, setDryRunResult] = useState<{
    totalParsed: number;
    newItemsCount: number;
    duplicatesCount: number;
    invalidCount: number;
  } | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleDryRun() {
    if (!rawContent.trim()) return;
    setImporting(true);
    try {
      const payload =
        importFormat === "json"
          ? {
              duplicatePolicy,
              dryRun: true,
              bundle: JSON.parse(rawContent),
            }
          : {
              duplicatePolicy,
              dryRun: true,
              rawHtml: rawContent,
            };

      const res = await fetch("/api/portability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Erro na simulação dry-run.");
      }
      setDryRunResult(data.preview || data);
      onFeedback("Simulação Dry-Run concluída com sucesso!");
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Formato inválido para dry-run.",
        true
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleExecuteImport() {
    if (!rawContent.trim()) return;
    setImporting(true);
    try {
      const payload =
        importFormat === "json"
          ? {
              duplicatePolicy,
              dryRun: false,
              bundle: JSON.parse(rawContent),
            }
          : {
              duplicatePolicy,
              dryRun: false,
              rawHtml: rawContent,
            };

      const res = await fetch("/api/portability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Falha na importação.");
      }
      const rep = data.report || data;
      onFeedback(
        `Importação concluída: ${rep.importedCount ?? 0} importados, ${rep.skippedCount ?? 0} ignorados.`
      );
      setRawContent("");
      setDryRunResult(null);
      await onRefreshLibrary();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao importar dados.",
        true
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Export Card */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <Download className="w-4 h-4 text-brand-text" />
            Exportar Biblioteca Completa (Zero Lock-in)
          </h3>
          <Badge variant="success">Portabilidade Total</Badge>
        </div>

        <p className="text-xs text-fg-secondary leading-relaxed">
          Exporte todos os seus itens, notas, coleções, tags, highlights e metadados em formatos abertos e padronizados.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <a
            href="/api/portability?format=json"
            download="comnois-export.json"
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-elevated hover:bg-inset border border-border-subtle text-center transition"
          >
            <span className="text-xs font-bold text-fg">JSON Completo</span>
            <span className="text-[11px] text-fg-muted mt-1">
              Itens, Tags, Coleções e Destaques
            </span>
          </a>

          <a
            href="/api/portability?format=html"
            download="comnois-bookmarks.html"
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-elevated hover:bg-inset border border-border-subtle text-center transition"
          >
            <span className="text-xs font-bold text-fg">Netscape HTML</span>
            <span className="text-[11px] text-fg-muted mt-1">
              Compatível com Navegadores & Karakeep
            </span>
          </a>

          <a
            href="/api/portability?format=csv"
            download="comnois-library.csv"
            className="flex flex-col items-center justify-center p-4 rounded-2xl bg-elevated hover:bg-inset border border-border-subtle text-center transition"
          >
            <span className="text-xs font-bold text-fg">Planilha CSV</span>
            <span className="text-[11px] text-fg-muted mt-1">
              Excel, Google Sheets & BI
            </span>
          </a>
        </div>
      </Card>

      {/* Import with Dry-Run Preview */}
      <Card padding="lg" className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-fg flex items-center gap-2">
            <Upload className="w-4 h-4 text-brand-text" />
            Importação com Simulação Prévia (Dry-Run)
          </h3>
          <Badge variant="brand">Deduplicação Inteligente</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Formato de origem"
            value={importFormat}
            onChange={(e) => setImportFormat(e.target.value as "json" | "html")}
          >
            <option value="json">Comnois / Karakeep JSON</option>
            <option value="html">Netscape Bookmarks HTML</option>
          </Select>

          <Select
            label="Política de duplicidade"
            value={duplicatePolicy}
            onChange={(e) =>
              setDuplicatePolicy(
                e.target.value as "skip" | "overwrite" | "append"
              )
            }
          >
            <option value="skip">Ignorar duplicados (Skip)</option>
            <option value="overwrite">Atualizar existentes (Overwrite)</option>
            <option value="append">Criar cópia (Append)</option>
          </Select>
        </div>

        <Textarea
          label="Cole o conteúdo JSON ou HTML Bookmarks abaixo"
          rows={5}
          placeholder={
            importFormat === "json"
              ? '{"items": [{"type": "link", "title": "Exemplo", "sourceUrl": "https://exemplo.com"}]}'
              : "<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF='https://exemplo.com'>Exemplo</A></DL>"
          }
          value={rawContent}
          onChange={(e) => setRawContent(e.target.value)}
        />

        {dryRunResult && (
          <div className="p-3 rounded-xl bg-brand-soft/40 border border-brand/30 text-xs flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-brand-text flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              Dry-Run: {dryRunResult.totalParsed} lidos •{" "}
              {dryRunResult.newItemsCount} novos •{" "}
              {dryRunResult.duplicatesCount} duplicados
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={importing || !rawContent.trim()}
            leftIcon={<Eye className="w-3.5 h-3.5" />}
            onClick={handleDryRun}
          >
            Simular Importação (Dry-Run)
          </Button>
          <Button
            size="sm"
            variant="primary"
            disabled={importing || !rawContent.trim()}
            leftIcon={<Upload className="w-3.5 h-3.5" />}
            onClick={handleExecuteImport}
          >
            Executar Importação
          </Button>
        </div>
      </Card>
    </div>
  );
}

