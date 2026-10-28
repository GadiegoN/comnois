"use client";

import React, { useState } from "react";
import {
  Search,
  Sparkles,
  Terminal,
  CheckCircle2,
  ShieldCheck,
  FileCode,
  ArrowUpRight,
  Layers,
  Quote,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type ShowcaseMode = "hybrid" | "rag" | "mcp";

export function LandingShowcaseClient() {
  const [mode, setMode] = useState<ShowcaseMode>("rag");

  return (
    <div className="rounded-3xl bg-surface border border-border-strong theme-card-shadow overflow-hidden">
      {/* Top window bar + interactive mode tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-elevated border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-400/80" />
          <span className="w-3 h-3 rounded-full bg-amber-400/80" />
          <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-xs font-mono text-fg-muted">
            comnois://workspace/production-preview
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMode("rag")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              mode === "rag"
                ? "bg-brand text-white shadow-sm"
                : "bg-surface text-fg-secondary hover:text-fg border border-border-subtle"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Assistente RAG Verificável
          </button>
          <button
            type="button"
            onClick={() => setMode("hybrid")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              mode === "hybrid"
                ? "bg-brand text-white shadow-sm"
                : "bg-surface text-fg-secondary hover:text-fg border border-border-subtle"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            Busca Híbrida RRF + DSL
          </button>
          <button
            type="button"
            onClick={() => setMode("mcp")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              mode === "mcp"
                ? "bg-brand text-white shadow-sm"
                : "bg-surface text-fg-secondary hover:text-fg border border-border-subtle"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            CLI, MCP & Snapshots Offline
          </button>
        </div>
      </div>

      {/* Mode 1: Verifiable RAG */}
      {mode === "rag" && (
        <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="brand">
                <Sparkles className="w-3 h-3" /> Grounding Estrito nas Suas Fontes
              </Badge>
              <span className="text-xs text-fg-muted font-mono">
                Anti-Prompt Injection Ativo
              </span>
            </div>

            <div className="rounded-2xl bg-inset border border-border-subtle p-4">
              <div className="text-xs text-fg-muted mb-1">Pergunta ao acervo:</div>
              <div className="text-sm font-semibold text-fg">
                &ldquo;Como a plataforma protege contra SSRF e garante citações auditáveis no RAG?&rdquo;
              </div>
            </div>

            <div className="rounded-2xl bg-surface border border-border-subtle p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-text">
                  Síntese Fundamentada
                </span>
                <Badge variant="success">
                  <CheckCircle2 className="w-3 h-3" /> 2 Citações Verificadas Literalmente
                </Badge>
              </div>
              <p className="text-sm text-fg leading-relaxed">
                A ingestão de URLs aplica validação estrita de DNS e bloqueio de faixas de IP privadas/loopback (RFC 1918, link-local e metadata cloud) com limite de redirecionamentos <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-brand-soft text-brand-text">[Fonte 1]</span>. Já o motor RAG exige que todo trecho citado exista literalmente no chunk recuperado, rejeitando alucinações e neutralizando instruções maliciosas embutidas em páginas salvas <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-brand-soft text-brand-text">[Fonte 2]</span>.
              </p>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Evidências Diretas Verificadas
            </div>
            <Card padding="sm" className="space-y-2 bg-elevated/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-fg flex items-center gap-1.5">
                  <Quote className="w-3.5 h-3.5 text-brand-text" />
                  [1] Segurança, privacidade e conformidade
                </span>
                <Badge variant="success">Literal Match</Badge>
              </div>
              <p className="text-xs text-fg-secondary italic border-l-2 border-brand pl-2.5">
                &ldquo;Proteção Anti-SSRF com resolução DNS prévia, bloqueio de IPs privados (127.0.0.0/8, 10.0.0.0/8, 169.254.169.254) e timeout estrito.&rdquo;
              </p>
              <div className="text-[11px] text-fg-muted font-mono">
                Seção: Proteção de Rede • Score RRF: 0.942
              </div>
            </Card>

            <Card padding="sm" className="space-y-2 bg-elevated/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-fg flex items-center gap-1.5">
                  <Quote className="w-3.5 h-3.5 text-brand-text" />
                  [2] Assistente RAG e citações verificáveis
                </span>
                <Badge variant="success">Literal Match</Badge>
              </div>
              <p className="text-xs text-fg-secondary italic border-l-2 border-brand pl-2.5">
                &ldquo;Verificador de literalidade valida que cada quote retornado pelo modelo é substring exata do chunk indexado antes de exibir ao usuário.&rdquo;
              </p>
              <div className="text-[11px] text-fg-muted font-mono">
                Seção: Grounding & Anti-Alucinação • Score RRF: 0.918
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Mode 2: Hybrid Search + Query DSL */}
      {mode === "hybrid" && (
        <div className="p-6 md:p-8 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 flex items-center gap-2.5 rounded-2xl bg-inset border border-brand/50 px-4 py-3">
              <Search className="w-4 h-4 text-brand-text shrink-0" />
              <code className="text-xs md:text-sm text-fg font-mono">
                arquitetura vetorial <span className="text-brand-text font-semibold">#rag</span>{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">type:note</span>{" "}
                <span className="text-amber-600 dark:text-amber-400 font-semibold">is:fav</span>{" "}
                <span className="text-purple-600 dark:text-purple-400 font-semibold">after:2025-01-01</span>
              </code>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="brand">RRF (k=60)</Badge>
              <Badge variant="purple">Lexical FTS + Cosine Similarity</Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card padding="md" className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="brand">Híbrido #1</Badge>
                <span className="text-xs font-mono text-fg-muted">RRF 0.0328</span>
              </div>
              <h4 className="text-sm font-semibold text-fg">
                Busca híbrida e ranking RRF (busca-hibrida-e-ranking.md)
              </h4>
              <p className="text-xs text-fg-secondary line-clamp-3">
                Combina busca lexical PostgreSQL Full-Text Search (tsvector + ranking BM25/ts_rank) com busca semântica vetorial via Reciprocal Rank Fusion.
              </p>
              <div className="pt-2 flex flex-wrap gap-1.5">
                <Badge variant="default">#rag</Badge>
                <Badge variant="success">Match Lexical + Semântico</Badge>
              </div>
            </Card>

            <Card padding="md" className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="purple">Semântico #2</Badge>
                <span className="text-xs font-mono text-fg-muted">RRF 0.0315</span>
              </div>
              <h4 className="text-sm font-semibold text-fg">
                Pipeline de IA, Chunks e Embeddings (pipeline-de-ia.md)
              </h4>
              <p className="text-xs text-fg-secondary line-clamp-3">
                Segmentação semântica com overlap configurável, versionamento de modelo de embedding e diagnóstico automático de drift vetorial.
              </p>
              <div className="pt-2 flex flex-wrap gap-1.5">
                <Badge variant="default">#ia</Badge>
                <Badge variant="purple">Alta Similaridade Vetorial</Badge>
              </div>
            </Card>

            <Card padding="md" className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="success">Grafo Relacionado</Badge>
                <span className="text-xs font-mono text-fg-muted">Cosine 0.89</span>
              </div>
              <h4 className="text-sm font-semibold text-fg">
                Descoberta Automática de Conexões Semânticas
              </h4>
              <p className="text-xs text-fg-secondary line-clamp-3">
                Cada item calcula automaticamente os documentos mais próximos por similaridade de cosseno nos embeddings e sobreposição de tags confirmadas.
              </p>
              <div className="pt-2 flex flex-wrap gap-1.5">
                <Badge variant="default">#knowledge-graph</Badge>
                <Badge variant="outline">Zero Config</Badge>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Mode 3: CLI, MCP & Offline Snapshots */}
      {mode === "mcp" && (
        <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-[#0b0f19] text-slate-100 p-5 font-mono text-xs space-y-2.5 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 border-b border-slate-800 pb-2">
              <span>Terminal — Comnois CLI & MCP Server</span>
              <span className="text-emerald-400">● stdio / JSON-RPC 2.0</span>
            </div>
            <div>
              <span className="text-indigo-400">$</span> pnpm cli search &quot;arquitetura #rag is:fav&quot;
            </div>
            <div className="text-slate-400 pl-3">
              → 4 resultados híbridos (RRF) retornados em 14ms
            </div>
            <div>
              <span className="text-indigo-400">$</span> pnpm cli ask &quot;Quais são os controles LGPD?&quot;
            </div>
            <div className="text-emerald-300 pl-3">
              ✓ Resposta fundamentada com 3 citações literais verificadas
            </div>
            <div>
              <span className="text-indigo-400">$</span> pnpm mcp
            </div>
            <div className="text-slate-400 pl-3">
              → MCP Server ativo para Claude Desktop / Cursor / IDEs (search_knowledge, ask_knowledge, save_knowledge_item)
            </div>
          </div>

          <div className="space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <Badge variant="brand">
                <FileCode className="w-3 h-3" /> Preservação Digital & Soberania de Dados
              </Badge>
              <h4 className="text-base font-bold text-fg">
                Snapshots Offline Auto-Contidos & Portabilidade Real
              </h4>
              <p className="text-xs text-fg-secondary leading-relaxed">
                Páginas da web saem do ar (link rot). O Comnois gera snapshots Markdown auto-contidos com checksum SHA-256 no armazenamento imutável e permite exportar ou importar com dry-run em JSON, Netscape Bookmarks HTML e CSV.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card padding="sm" className="bg-elevated/50">
                <div className="text-xs font-semibold text-fg flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  Storage CAS SHA-256
                </div>
                <p className="text-[11px] text-fg-secondary mt-1">
                  Deduplicação automática de binários local ou S3/MinIO com verificação de integridade.
                </p>
              </Card>
              <Card padding="sm" className="bg-elevated/50">
                <div className="text-xs font-semibold text-fg flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-brand-text" />
                  Extensão Chrome MV3
                </div>
                <p className="text-[11px] text-fg-secondary mt-1">
                  Salve URLs, trechos selecionados e tags com 1 clique direto do navegador.
                </p>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

