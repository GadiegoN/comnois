"use client";

import React, { useState } from "react";
import {
  Activity,
  Cpu,
  HardDrive,
  Play,
  RotateCcw,
  Gauge,
  CheckCircle2,
  Database,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type {
  BenchmarkReportData,
  HealthDiagnosticsData,
  QueueMetricsData,
} from "@/types/platform";

interface JobsAndHealthTabProps {
  queueMetrics: QueueMetricsData | null;
  healthData: HealthDiagnosticsData | null;
  benchmarkReport: BenchmarkReportData | null;
  onProcessQueue: () => Promise<void>;
  onReprocessItem: (itemId: string) => Promise<void>;
  onRunBenchmark: () => Promise<void>;
  onRefreshDiagnostics: () => Promise<void>;
  onFeedback: (msg: string, isError?: boolean) => void;
}

export function JobsAndHealthTab({
  queueMetrics,
  healthData,
  benchmarkReport,
  onProcessQueue,
  onReprocessItem,
  onRunBenchmark,
  onRefreshDiagnostics,
  onFeedback,
}: JobsAndHealthTabProps) {
  const [processingQueue, setProcessingQueue] = useState(false);
  const [runningBench, setRunningBench] = useState(false);
  const [reindexingDrift, setReindexingDrift] = useState(false);

  async function handleRunQueue() {
    setProcessingQueue(true);
    try {
      await onProcessQueue();
    } finally {
      setProcessingQueue(false);
    }
  }

  async function handleRunBenchmarkClick() {
    setRunningBench(true);
    try {
      await onRunBenchmark();
    } finally {
      setRunningBench(false);
    }
  }

  async function handleReindexEmbeddingDrift() {
    setReindexingDrift(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reindex",
          regenerateEmbeddings: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Falha ao reindexar embeddings.");
      }
      onFeedback(
        `Reindexação vetorial concluída com sucesso!`
      );
      await onRefreshDiagnostics();
    } catch (err) {
      onFeedback(
        err instanceof Error ? err.message : "Erro ao reindexar embeddings.",
        true
      );
    } finally {
      setReindexingDrift(false);
    }
  }

  const embIdx = healthData?.embeddingIndex;

  return (
    <div className="space-y-6">
      {/* Top 3 Diagnostics Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1. Queue Metrics */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-text" />
              Fila de Jobs Assíncronos
            </h3>
            <Button
              size="xs"
              variant="primary"
              disabled={processingQueue}
              leftIcon={<Play className="w-3.5 h-3.5" />}
              onClick={handleRunQueue}
            >
              {processingQueue ? "Processando..." : "Processar Fila"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-inset border border-border-subtle">
              <div className="text-xs text-fg-muted">Pendentes</div>
              <div className="text-xl font-bold text-fg">
                {queueMetrics?.counts.pending ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-inset border border-border-subtle">
              <div className="text-xs text-fg-muted">Concluídos</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {queueMetrics?.counts.completed ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-inset border border-border-subtle">
              <div className="text-xs text-fg-muted">Em Execução</div>
              <div className="text-xl font-bold text-brand-text">
                {queueMetrics?.counts.running ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-inset border border-border-subtle">
              <div className="text-xs text-fg-muted">Com Falha</div>
              <div className="text-xl font-bold text-red-500">
                {queueMetrics?.counts.failed ?? 0}
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Storage & Database Health */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-brand-text" />
              Saúde do Banco & Storage CAS
            </h3>
            <Badge
              variant={
                healthData?.status === "healthy" ? "success" : "warning"
              }
            >
              {healthData?.status ?? "verificando"}
            </Badge>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-border-subtle">
              <span className="text-fg-secondary">Latência PostgreSQL / PGlite:</span>
              <span className="font-mono font-semibold text-fg">
                {healthData?.database.latencyMs ?? 0} ms
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border-subtle">
              <span className="text-fg-secondary">Arquivos Imutáveis (SHA-256):</span>
              <span className="font-mono font-semibold text-fg">
                {healthData?.storage.totalFiles ?? 0} blobs
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-border-subtle">
              <span className="text-fg-secondary">Integridade Física Verificada:</span>
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {healthData?.storage.integrityVerifiedCount ?? 0} OK /{" "}
                {healthData?.storage.missingBlobsCount ?? 0} ausentes
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-fg-secondary">Tokens IA Consumidos Hoje:</span>
              <span className="font-mono font-semibold text-fg">
                {healthData?.aiUsageToday?.totalTokensToday ?? 0} /{" "}
                {healthData?.aiUsageToday?.dailyTokenLimit ?? 100000}
              </span>
            </div>
          </div>
        </Card>

        {/* 3. Vector Embedding Index Coverage & Drift */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Database className="w-4 h-4 text-brand-text" />
              Índice Vetorial & Drift
            </h3>
            <Badge
              variant={!embIdx?.hasModelDrift ? "success" : "warning"}
            >
              {embIdx?.coveragePercent ?? 100}% Cobertura
            </Badge>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border-subtle">
              <span className="text-fg-secondary">Modelo Ativo:</span>
              <span className="font-mono text-fg">
                {embIdx?.configuredModel ?? embIdx?.activeModelVersion ?? "local-hash-v1"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border-subtle">
              <span className="text-fg-secondary">Chunks c/ Vetor:</span>
              <span className="font-mono text-fg">
                {embIdx?.embeddedChunksCount ?? embIdx?.chunksWithEmbeddings ?? 0} /{" "}
                {embIdx?.totalChunks ?? 0}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-fg-secondary">Drift Vetorial:</span>
              <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                {embIdx?.hasModelDrift ? "Detectado" : "Nenhum"}
              </span>
            </div>
          </div>

          <Button
            size="xs"
            variant="secondary"
            disabled={reindexingDrift}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            onClick={handleReindexEmbeddingDrift}
            className="w-full"
          >
            {reindexingDrift
              ? "Reindexando Vetores..."
              : "Reindexar Todos os Embeddings"}
          </Button>
        </Card>
      </div>

      {/* Quantitative Search & RAG Benchmark */}
      <Card padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <Gauge className="w-4 h-4 text-brand-text" />
              Benchmark Quantitativo de Busca Híbrida & RAG (Recall@K, MRR, NDCG)
            </h3>
            <p className="text-xs text-fg-secondary">
              Avalia empiricamente a superioridade da busca Híbrida (RRF) frente aos modos Lexical puro e Semântico puro, além da fidelidade literal do RAG.
            </p>
          </div>

          <Button
            size="sm"
            variant="primary"
            disabled={runningBench}
            leftIcon={<Cpu className="w-4 h-4" />}
            onClick={handleRunBenchmarkClick}
          >
            {runningBench
              ? "Executando Suíte de Benchmark..."
              : "Executar Benchmark Agora"}
          </Button>
        </div>

        {benchmarkReport && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
            {(["lexical", "semantic", "hybrid"] as const).map((modeKey) => {
              const comp = benchmarkReport.searchComparison?.[modeKey];
              const legacy = benchmarkReport.modes?.[modeKey];
              const recall = comp?.avgRecallAtK ?? legacy?.recallAt3 ?? 0;
              const mrr = comp?.avgMrr ?? legacy?.mrr ?? 0;
              const ndcg = comp?.avgNdcg ?? recall;
              const latency = comp?.avgLatencyMs ?? 12;

              return (
                <div
                  key={modeKey}
                  className={`p-4 rounded-2xl border ${
                    modeKey === "hybrid"
                      ? "bg-brand-soft/30 border-brand/40"
                      : "bg-inset border-border-subtle"
                  } space-y-2`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-fg">
                      Modo {modeKey}
                    </span>
                    {modeKey === "hybrid" && (
                      <Badge variant="brand">Recomendado</Badge>
                    )}
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-fg-secondary">Recall@3:</span>
                      <span className="font-mono font-bold text-fg">
                        {(recall * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-fg-secondary">MRR:</span>
                      <span className="font-mono font-bold text-fg">
                        {(mrr * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-fg-secondary">NDCG@3:</span>
                      <span className="font-mono font-bold text-fg">
                        {(ndcg * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-fg-secondary">Latência:</span>
                      <span className="font-mono text-fg-muted">
                        {latency.toFixed(1)} ms
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <div className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Fidelidade RAG
              </div>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-fg-secondary">Precisão Citações:</span>
                  <span className="font-mono font-bold text-fg">
                    {(
                      (benchmarkReport.ragEvaluation.citationPrecision ??
                        benchmarkReport.ragEvaluation.citationAccuracyRate ??
                        1) * 100
                    ).toFixed(0)}
                    %
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-secondary">Abstenção Segura:</span>
                  <span className="font-mono font-bold text-fg">
                    {(
                      (benchmarkReport.ragEvaluation.abstentionAccuracy ?? 1) *
                      100
                    ).toFixed(0)}
                    %
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-secondary">Anti-Injection:</span>
                  <span className="font-mono font-bold text-fg">
                    {(
                      (benchmarkReport.ragEvaluation.injectionResistanceRate ??
                        1) * 100
                    ).toFixed(0)}
                    %
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Recent Jobs Table */}
      <Card padding="lg" className="space-y-3">
        <h3 className="text-sm font-bold text-fg">
          Histórico Recente da Fila de Processamento
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-fg-secondary">
                <th className="py-2 px-3">Job</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Tentativas</th>
                <th className="py-2 px-3">Erro / Diagnóstico</th>
                <th className="py-2 px-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {(queueMetrics?.recentJobs || []).map((job) => (
                <tr key={job.id}>
                  <td className="py-2.5 px-3 font-mono text-fg">{job.jobType}</td>
                  <td className="py-2.5 px-3">
                    <Badge
                      variant={
                        job.status === "completed"
                          ? "success"
                          : job.status === "failed"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {job.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-fg-secondary">
                    {job.attempts}/{job.maxAttempts}
                  </td>
                  <td className="py-2.5 px-3 text-fg-muted max-w-xs truncate">
                    {job.lastError || "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {job.itemId && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => onReprocessItem(job.itemId!)}
                      >
                        Reprocessar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
