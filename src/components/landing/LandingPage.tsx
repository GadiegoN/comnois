import React from "react";
import Link from "next/link";
import {
  Sparkles,
  Search,
  ShieldCheck,
  Database,
  Terminal,
  FolderTree,
  ArrowRight,
  CheckCircle2,
  Cpu,
  Lock,
  Globe,
  FileCheck2,
  Layers,
  GitCompare,
  Zap,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LandingShowcaseClient } from "@/components/landing/LandingShowcaseClient";

interface LandingPageProps {
  isAuthenticated?: boolean;
  userEmail?: string;
}

const ARCHITECTURAL_PILLARS = [
  {
    icon: <Search className="w-5 h-5 text-brand-text" />,
    badge: "Reciprocal Rank Fusion",
    title: "Busca Híbrida RRF + Query DSL",
    description:
      "Une a precisão exata do Full-Text Search (BM25/tsvector) com a compreensão conceitual de embeddings vetoriais. Filtre com operadores #tag, col:nome, type:link, is:fav e datas.",
  },
  {
    icon: <Sparkles className="w-5 h-5 text-brand-text" />,
    badge: "Zero Alucinação",
    title: "RAG com Citações Literalmente Verificadas",
    description:
      "Cada resposta do assistente exige evidência literal extraída dos seus chunks indexados, detecta contradições entre fontes e neutraliza tentativas de Prompt Injection.",
  },
  {
    icon: <FolderTree className="w-5 h-5 text-brand-text" />,
    badge: "Automação Determinística",
    title: "Coleções Inteligentes, Regras & RSS",
    description:
      "Organize em coleções hierárquicas, Smart Collections dinâmicas baseadas em queries, regras determinísticas de auto-tagging no momento da captura e assinatura de feeds RSS/Atom.",
  },
  {
    icon: <Database className="w-5 h-5 text-brand-text" />,
    badge: "Content-Addressable Storage",
    title: "Snapshots Offline & Storage SHA-256",
    description:
      "Gere snapshots Markdown permanentes de qualquer documento, armazene PDFs e imagens com deduplicação SHA-256 (Local ou S3/R2/MinIO) e audite a integridade física dos blobs.",
  },
  {
    icon: <Terminal className="w-5 h-5 text-brand-text" />,
    badge: "Developer-First",
    title: "Servidor MCP, CLI & Extensão Web",
    description:
      "Conecte seu acervo ao Claude Desktop, Cursor ou IDEs via Model Context Protocol (MCP), opere tudo pelo terminal com `pnpm cli` e capture páginas com a extensão Chrome MV3.",
  },
  {
    icon: <ShieldCheck className="w-5 h-5 text-brand-text" />,
    badge: "Security & LGPD by Design",
    title: "Anti-SSRF, RBAC, Webhooks HMAC & LGPD",
    description:
      "Proteção anti-SSRF na captura de links, workspaces colaborativos com RBAC, tokens de API com escopo (`cmn_...`), webhooks assinados via HMAC-SHA256 e exclusão total LGPD.",
  },
];

const COMPARISON_ROWS = [
  {
    feature: "Busca e Recuperação",
    bookmarks: "Busca apenas no título/URL",
    karakeep: "Busca textual + tags de IA",
    comnois: "Híbrida RRF (Lexical + Vetorial) + Query DSL avançada",
  },
  {
    feature: "Assistente de IA (RAG)",
    bookmarks: "Inexistente",
    karakeep: "Resumo básico por item",
    comnois: "Síntese multi-documento com verificação literal de citações e histórico auditável",
  },
  {
    feature: "Confiabilidade de Tags IA",
    bookmarks: "Apenas manual",
    karakeep: "Auto-tagging direto",
    comnois: "Tags sugeridas com score de confiança + confirmação/rejeição humana",
  },
  {
    feature: "Integrações & Agentes",
    bookmarks: "Nenhuma",
    karakeep: "API REST + CLI básica",
    comnois: "MCP Server nativo + CLI completa + Webhooks HMAC + Extensão MV3",
  },
  {
    feature: "Diagnóstico & Qualidade",
    bookmarks: "Nenhum",
    karakeep: "Status da fila",
    comnois: "Benchmark quantitativo (Recall@K, MRR, NDCG) + Detector de Drift Vetorial",
  },
];

export function LandingPage({
  isAuthenticated = false,
  userEmail,
}: LandingPageProps) {
  return (
    <div className="min-h-screen bg-canvas text-fg flex flex-col selection:bg-brand selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-surface/85 border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white font-bold shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-fg">
                  Comnois
                </span>
                <Badge variant="brand">v1.5</Badge>
              </div>
              <p className="text-[11px] text-fg-muted hidden sm:block">
                Plataforma Inteligente de Conhecimento & RAG Verificável
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-fg-secondary">
            <a href="#vitrine" className="hover:text-fg transition-colors">
              Demonstração Interativa
            </a>
            <a href="#arquitetura" className="hover:text-fg transition-colors">
              Arquitetura
            </a>
            <a href="#comparativo" className="hover:text-fg transition-colors">
              Diferenciais
            </a>
            <a href="#developers" className="hover:text-fg transition-colors">
              CLI & MCP
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeSwitcher compact />
            {isAuthenticated ? (
              <Link
                href="/?view=workspace"
                className="inline-flex items-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
              >
                Abrir Meu Workspace
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-elevated hover:bg-inset text-fg border border-border-subtle px-3.5 py-2 text-xs font-medium transition-all"
                >
                  Entrar
                </Link>
                <Link
                  href="/login?mode=register"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand hover:bg-brand-hover text-white px-4 py-2 text-xs font-semibold shadow-sm transition-all"
                >
                  Começar Agora
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden theme-hero-glow border-b border-border-subtle">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-16 md:pt-20 md:pb-24">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft border border-brand/30 px-3.5 py-1 text-xs font-medium text-brand-text">
                <Zap className="w-3.5 h-3.5" />
                <span>Self-Hosted • Multi-Tema • Busca Híbrida RRF • RAG Verificável</span>
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-fg leading-[1.12]">
                Seu segundo cérebro com{" "}
                <span className="text-brand-text underline decoration-brand/30 decoration-wavy underline-offset-8">
                  evidência literal
                </span>{" "}
                e soberania total.
              </h1>

              <p className="text-base sm:text-lg text-fg-secondary leading-relaxed max-w-2xl mx-auto">
                Capture links, notas, PDFs e imagens. Pesquise com fusão híbrida lexical + vetorial e converse com seu acervo através de um assistente RAG que comprova cada citação literalmente.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {isAuthenticated ? (
                  <Link
                    href="/?view=workspace"
                    className="inline-flex items-center gap-2 rounded-2xl bg-brand hover:bg-brand-hover text-white px-6 py-3.5 text-sm font-semibold shadow-md transition-all"
                  >
                    Ir para o Workspace ({userEmail ?? "Conectado"})
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="inline-flex items-center gap-2 rounded-2xl bg-brand hover:bg-brand-hover text-white px-6 py-3.5 text-sm font-semibold shadow-md transition-all"
                    >
                      Acessar Plataforma
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/login?mode=register"
                      className="inline-flex items-center gap-2 rounded-2xl bg-surface hover:bg-elevated text-fg border border-border-strong px-6 py-3.5 text-sm font-semibold transition-all"
                    >
                      Criar Conta Local Gratuita
                    </Link>
                  </>
                )}
              </div>

              {/* Theme Preview Hint */}
              <div className="pt-4 flex flex-col items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-fg-muted">
                  Experimente os 4 temas visuais em tempo real:
                </span>
                <ThemeSwitcher />
              </div>
            </div>

            {/* Interactive Product Showcase */}
            <div id="vitrine" className="mt-12 md:mt-16">
              <LandingShowcaseClient />
            </div>
          </div>
        </section>

        {/* Key Metrics Bar */}
        <section className="bg-surface border-b border-border-subtle py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl md:text-3xl font-extrabold text-brand-text">
                100% Literal
              </div>
              <div className="text-xs text-fg-secondary mt-1">
                Verificação de substring em citações RAG
              </div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-extrabold text-fg">
                RRF (k=60)
              </div>
              <div className="text-xs text-fg-secondary mt-1">
                Fusão Lexical FTS + Similaridade de Cosseno
              </div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-extrabold text-fg">
                4 Temas
              </div>
              <div className="text-xs text-fg-secondary mt-1">
                Alabaster, Sépia Editorial, Obsidian e Aurora
              </div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                Zero Lock-in
              </div>
              <div className="text-xs text-fg-secondary mt-1">
                Exportação JSON, HTML Bookmarks, CSV e Snapshots .md
              </div>
            </div>
          </div>
        </section>

        {/* 6 Architectural Pillars */}
        <section id="arquitetura" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl space-y-3 mb-12">
            <Badge variant="brand">Engenharia de Produção</Badge>
            <h2 className="text-2xl sm:text-3xl font-bold text-fg tracking-tight">
              Construído para quem exige precisão técnica, não apenas favoritos.
            </h2>
            <p className="text-sm text-fg-secondary leading-relaxed">
              Cada subsistema do Comnois foi desenhado para resolver as falhas clássicas de ferramentas de PKM e bookmarking: links quebrados, buscas que não encontram sinônimos e IAs que inventam respostas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ARCHITECTURAL_PILLARS.map((pillar) => (
              <Card key={pillar.title} padding="lg" className="flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="w-10 h-10 rounded-xl bg-brand-soft flex items-center justify-center">
                      {pillar.icon}
                    </div>
                    <Badge variant="default">{pillar.badge}</Badge>
                  </div>
                  <h3 className="text-base font-bold text-fg">{pillar.title}</h3>
                  <p className="text-xs text-fg-secondary leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
                <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-fg-muted">
                  <span>Auditado por suíte automatizada</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Comparison Table */}
        <section id="comparativo" className="py-16 bg-surface border-y border-border-subtle">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
            <div className="max-w-2xl space-y-2">
              <Badge variant="purple">
                <GitCompare className="w-3 h-3" /> Comparativo de Capacidades
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-fg">
                Por que o Comnois vai além dos gerenciadores de bookmarks tradicionais
              </h2>
              <p className="text-sm text-fg-secondary">
                Inspirado na simplicidade de captura do Karakeep, mas projetado como uma plataforma completa de recuperação híbrida e RAG verificável.
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-canvas">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-elevated border-b border-border-subtle text-fg-secondary">
                    <th className="py-3.5 px-4 font-semibold">Dimensão</th>
                    <th className="py-3.5 px-4 font-semibold">Bookmarks Comuns</th>
                    <th className="py-3.5 px-4 font-semibold">Gerenciadores Self-Hosted</th>
                    <th className="py-3.5 px-4 font-bold text-brand-text bg-brand-soft/40">
                      Comnois Platform
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {COMPARISON_ROWS.map((row) => (
                    <tr key={row.feature} className="hover:bg-elevated/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-fg">{row.feature}</td>
                      <td className="py-3.5 px-4 text-fg-muted">{row.bookmarks}</td>
                      <td className="py-3.5 px-4 text-fg-secondary">{row.karakeep}</td>
                      <td className="py-3.5 px-4 font-medium text-fg bg-brand-soft/20">
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          {row.comnois}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Developer Experience & Self-Hosting */}
        <section id="developers" className="py-16 md:py-24 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-4">
              <Badge variant="brand">
                <Cpu className="w-3 h-3" /> Soberania & Extensibilidade
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-fg">
                Pronto para rodar local com PGlite ou em cluster PostgreSQL + Docker
              </h2>
              <p className="text-sm text-fg-secondary leading-relaxed">
                Alterne sem atrito entre provedores de IA locais (<strong>Ollama</strong>), nuvem (<strong>OpenAI</strong> / <strong>Google Gemini</strong>) ou modo determinístico offline. Monitore o consumo diário de tokens, verifique a cobertura de embeddings por versão de modelo e execute benchmarks quantitativos a qualquer momento.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface border border-border-subtle">
                  <Lock className="w-4 h-4 text-brand-text shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-fg">Tokens com Escopo</div>
                    <p className="text-[11px] text-fg-secondary">
                      Chaves `cmn_...` com permissões granulares `read`, `write` e `admin`.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-surface border border-border-subtle">
                  <FileCheck2 className="w-4 h-4 text-brand-text shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-fg">Auditoria de Drift</div>
                    <p className="text-[11px] text-fg-secondary">
                      Reindexação em 1 clique quando você troca de modelo de embedding.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Card padding="lg" className="space-y-4 bg-surface">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-fg-secondary">
                  Acesso Rápido à Plataforma
                </span>
                <Badge variant="success">Servidor Ativo</Badge>
              </div>
              <p className="text-xs text-fg-secondary">
                Entre na sua conta para acessar a Biblioteca Híbrida, o Assistente RAG com histórico persistente, as Coleções Inteligentes e o painel de Saúde & Benchmarks.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                {isAuthenticated ? (
                  <Link
                    href="/?view=workspace"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-white px-5 py-3 text-sm font-semibold shadow-sm transition-all"
                  >
                    Voltar ao Workspace Principal
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand hover:bg-brand-hover text-white px-5 py-3 text-sm font-semibold shadow-sm transition-all"
                    >
                      Entrar no Workspace
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/login?mode=register"
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-elevated hover:bg-inset text-fg border border-border-strong px-5 py-3 text-sm font-semibold transition-all"
                    >
                      Criar Nova Conta
                    </Link>
                  </>
                )}
              </div>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-surface border-t border-border-subtle py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-fg-muted">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-text" />
            <span className="font-semibold text-fg">Comnois Knowledge Platform</span>
            <span>— Arquitetura Modular SSR + Client Components</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/welcome" className="hover:text-fg transition-colors">
              Apresentação
            </Link>
            <Link href="/login" className="hover:text-fg transition-colors">
              Autenticação
            </Link>
            <Link href="/?view=workspace" className="hover:text-fg transition-colors">
              Workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

