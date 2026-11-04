"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Sparkles,
  Network,
  FolderTree,
  Activity,
  ArrowDownUp,
  Settings,
  Plus,
  Sun,
  FileText,
  X,
  CornerDownLeft,
} from "lucide-react";
import { useTheme } from "@/components/providers/ThemeProvider";
import { Badge } from "@/components/ui/Badge";
import type { SearchItem, ThemeMode, WorkspaceTabId } from "@/types/platform";

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: SearchItem[];
  onSelectTab: (tab: WorkspaceTabId) => void;
  onOpenItemDetail: (id: string) => void;
  onOpenCapture: () => void;
  onAskRagQuestion: (question: string) => void;
}

interface PaletteAction {
  id: string;
  group: "Navegação" | "Ações Rápidas" | "Temas Visuais" | "Documentos (Nós)";
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  onExecute: () => void;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  items,
  onSelectTab,
  onOpenItemDetail,
  onOpenCapture,
  onAskRagQuestion,
}: CommandPaletteModalProps) {
  const { setTheme, themes } = useTheme();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const actions = useMemo<PaletteAction[]>(() => {
    const q = search.trim().toLowerCase();

    const baseActions: PaletteAction[] = [
      {
        id: "act-capture",
        group: "Ações Rápidas",
        label: "Capturar novo Link, Nota Markdown ou Arquivo",
        subtitle: "Abre o formulário de captura rápida",
        icon: <Plus className="w-4 h-4 text-brand-text" />,
        onExecute: () => {
          onOpenCapture();
          onClose();
        },
      },
      {
        id: "nav-library",
        group: "Navegação",
        label: "Ir para Biblioteca & Busca Híbrida (RRF)",
        icon: <Search className="w-4 h-4 text-brand-text" />,
        onExecute: () => {
          onSelectTab("library");
          onClose();
        },
      },
      {
        id: "nav-graph",
        group: "Navegação",
        label: "Ir para Grafo de Nós do Conhecimento (Com Nós)",
        icon: <Network className="w-4 h-4 text-brand-text" />,
        onExecute: () => {
          onSelectTab("graph");
          onClose();
        },
      },
      {
        id: "nav-assistant",
        group: "Navegação",
        label: "Ir para Assistente RAG com Citações Verificáveis",
        icon: <Sparkles className="w-4 h-4 text-brand-text" />,
        onExecute: () => {
          onSelectTab("assistant");
          onClose();
        },
      },
      {
        id: "nav-organization",
        group: "Navegação",
        label: "Ir para Coleções Inteligentes, Tags, Regras & Feeds RSS",
        icon: <FolderTree className="w-4 h-4 text-brand-text" />,
        onExecute: () => {
          onSelectTab("organization");
          onClose();
        },
      },
      {
        id: "nav-jobs",
        group: "Navegação",
        label: "Ir para Fila de Workers, Saúde & Benchmark Quantitativo",
        icon: <Activity className="w-4 h-4 text-brand-text" />,
        onExecute: () => {
          onSelectTab("jobs");
          onClose();
        },
      },
      {
        id: "nav-portability",
        group: "Navegação",
        label: "Ir para Portabilidade (Exportar / Importar Dry-Run)",
        icon: <ArrowDownUp className="w-4 h-4 text-brand-text" />,
        onExecute: () => {
          onSelectTab("portability");
          onClose();
        },
      },
      {
        id: "nav-settings",
        group: "Navegação",
        label: "Ir para Configurações de IA, Tokens, Webhooks & LGPD",
        icon: <Settings className="w-4 h-4 text-brand-text" />,
        onExecute: () => {
          onSelectTab("settings");
          onClose();
        },
      },
      ...themes.map((t) => ({
        id: `theme-${t.id}`,
        group: "Temas Visuais" as const,
        label: `Ativar Tema ${t.label}`,
        subtitle: t.description,
        icon: <Sun className="w-4 h-4 text-amber-500" />,
        onExecute: () => {
          setTheme(t.id as ThemeMode);
          onClose();
        },
      })),
    ];

    const itemActions: PaletteAction[] = items
      .filter((it) => {
        if (!q) return true;
        return (
          it.title.toLowerCase().includes(q) ||
          it.tags.some((t) => t.name.toLowerCase().includes(q))
        );
      })
      .slice(0, 8)
      .map((it) => ({
        id: `item-${it.id}`,
        group: "Documentos (Nós)" as const,
        label: it.title,
        subtitle: it.tags.map((t) => `#${t.name}`).join(" "),
        icon: <FileText className="w-4 h-4 text-fg-secondary" />,
        onExecute: () => {
          onOpenItemDetail(it.id);
          onClose();
        },
      }));

    const filteredBase = baseActions.filter((a) => {
      if (!q) return true;
      return (
        a.label.toLowerCase().includes(q) ||
        (a.subtitle && a.subtitle.toLowerCase().includes(q))
      );
    });

    const ragDirectAction: PaletteAction[] =
      search.trim().length > 3
        ? [
            {
              id: "ask-rag-direct",
              group: "Ações Rápidas",
              label: `Perguntar ao Assistente RAG: "${search.trim()}"`,
              subtitle: "Executa consulta fundamentada com citações verificáveis",
              icon: <Sparkles className="w-4 h-4 text-purple-500" />,
              onExecute: () => {
                onAskRagQuestion(search.trim());
                onClose();
              },
            },
          ]
        : [];

    return [...ragDirectAction, ...itemActions, ...filteredBase];
  }, [
    search,
    items,
    themes,
    onOpenCapture,
    onSelectTab,
    onOpenItemDetail,
    onAskRagQuestion,
    setTheme,
    onClose,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          actions.length > 0 ? (prev + 1) % actions.length : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          actions.length > 0 ? (prev - 1 + actions.length) % actions.length : 0
        );
      } else if (e.key === "Enter" && actions[selectedIndex]) {
        e.preventDefault();
        actions[selectedIndex].onExecute();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, actions, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-surface border border-border-strong shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border-subtle bg-elevated/50">
          <Search className="w-4 h-4 text-brand-text shrink-0" />
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Digite um comando, busque um nó pelo título/#tag ou faça uma pergunta ao RAG..."
            className="flex-1 bg-transparent text-sm text-fg placeholder:text-fg-muted focus:outline-none"
          />
          <Badge variant="outline">ESC</Badge>
          <button
            type="button"
            onClick={onClose}
            className="text-fg-muted hover:text-fg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {actions.length === 0 ? (
            <div className="py-8 text-center text-xs text-fg-muted">
              Nenhum comando ou documento correspondente encontrado.
            </div>
          ) : (
            actions.map((act, idx) => {
              const active = idx === selectedIndex;
              return (
                <button
                  key={act.id}
                  type="button"
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={act.onExecute}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-left transition cursor-pointer ${
                    active
                      ? "bg-brand-soft text-brand-text border border-brand/30"
                      : "text-fg hover:bg-elevated border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {act.icon}
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">
                        {act.label}
                      </div>
                      {act.subtitle && (
                        <div className="text-[11px] text-fg-muted truncate">
                          {act.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-fg-muted">
                      {act.group}
                    </span>
                    {active && <CornerDownLeft className="w-3.5 h-3.5" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-4 py-2 bg-elevated border-t border-border-subtle flex items-center justify-between text-[11px] text-fg-muted">
          <span>Use ↑↓ para navegar e Enter para executar</span>
          <span className="font-mono">Atalho Global: Ctrl + K</span>
        </div>
      </div>
    </div>
  );
}

