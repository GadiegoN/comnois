"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  Search,
  Network,
  MessageSquareQuote,
  FolderTree,
  Activity,
  ArrowDownUp,
  Settings,
  Plus,
  LogOut,
  Globe,
  Command,
  Users,
} from "lucide-react";
import { ThemeSwitcher } from "@/components/ui/ThemeSwitcher";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { UserInfo, WorkspaceTabId } from "@/types/platform";

interface WorkspaceHeaderProps {
  user: UserInfo;
  activeTab: WorkspaceTabId;
  onSelectTab: (tab: WorkspaceTabId) => void;
  showCaptureForm: boolean;
  onToggleCaptureForm: () => void;
  onOpenCommandPalette?: () => void;
  pendingJobsCount: number;
  onLogout: () => void;
  workspaces?: Array<{ id: string; name: string; role: string }>;
  activeWorkspaceId?: string;
  onSelectWorkspaceId?: (id: string) => void;
}

const NAV_TABS: Array<{
  id: WorkspaceTabId;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: "library",
    label: "Biblioteca & Busca",
    icon: <Search className="w-4 h-4" />,
  },
  {
    id: "graph",
    label: "Grafo de Nós",
    icon: <Network className="w-4 h-4" />,
  },
  {
    id: "assistant",
    label: "Assistente RAG",
    icon: <MessageSquareQuote className="w-4 h-4" />,
  },
  {
    id: "organization",
    label: "Coleções & Regras",
    icon: <FolderTree className="w-4 h-4" />,
  },
  {
    id: "jobs",
    label: "Fila & Saúde",
    icon: <Activity className="w-4 h-4" />,
  },
  {
    id: "portability",
    label: "Portabilidade",
    icon: <ArrowDownUp className="w-4 h-4" />,
  },
  {
    id: "settings",
    label: "Configurações & LGPD",
    icon: <Settings className="w-4 h-4" />,
  },
];

export function WorkspaceHeader({
  user,
  activeTab,
  onSelectTab,
  showCaptureForm,
  onToggleCaptureForm,
  onOpenCommandPalette,
  pendingJobsCount,
  onLogout,
  workspaces = [],
  activeWorkspaceId = "",
  onSelectWorkspaceId,
}: WorkspaceHeaderProps) {
  return (
    <header className="sticky top-0 z-30 backdrop-blur-md bg-surface/90 border-b border-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 pb-2 space-y-3">
        {/* Top Row: Brand, Theme Switcher, Actions, User */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-fg tracking-tight">
                  Comnois
                </h1>
                <Badge variant="brand">Workspace v2.2</Badge>
              </div>
              <p className="text-[11px] text-fg-muted hidden sm:block">
                Pesquisa híbrida RRF & RAG com citações verificáveis
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onSelectWorkspaceId && (
              <div className="inline-flex items-center gap-1.5 rounded-xl bg-inset border border-border-subtle px-2.5 py-1 text-xs">
                <Users className="w-3.5 h-3.5 text-brand-text shrink-0" />
                <select
                  aria-label="Selecionar contexto de Workspace"
                  value={activeWorkspaceId}
                  onChange={(e) => onSelectWorkspaceId(e.target.value)}
                  className="bg-transparent text-xs font-medium text-fg focus:outline-none cursor-pointer"
                >
                  <option value="">Acervo Pessoal</option>
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id}>
                      {ws.name} ({ws.role})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onOpenCommandPalette && (
              <button
                type="button"
                onClick={onOpenCommandPalette}
                title="Abrir paleta de comandos rápidos (Ctrl+K)"
                className="inline-flex items-center gap-2 rounded-xl bg-inset hover:bg-elevated text-fg-secondary hover:text-fg border border-border-subtle px-3 py-1.5 text-xs font-medium transition-all cursor-pointer"
              >
                <Command className="w-3.5 h-3.5 text-brand-text" />
                <span className="hidden sm:inline">Comandos</span>
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-surface border border-border-subtle text-fg-muted">
                  Ctrl K
                </kbd>
              </button>
            )}

            <ThemeSwitcher />

            <Link
              href="/welcome"
              className="inline-flex items-center gap-1.5 rounded-xl bg-elevated hover:bg-inset text-fg-secondary hover:text-fg border border-border-subtle px-3 py-1.5 text-xs font-medium transition-all"
              title="Ver página de apresentação do produto"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Landing Page</span>
            </Link>

            <Button
              size="sm"
              variant={showCaptureForm ? "secondary" : "primary"}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={onToggleCaptureForm}
            >
              {showCaptureForm ? "Fechar Captura" : "Capturar Item"}
            </Button>

            <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-border-subtle">
              <div className="text-right">
                <div className="text-xs font-semibold text-fg leading-none">
                  {user.displayName}
                </div>
                <div className="text-[11px] text-fg-muted">{user.email}</div>
              </div>
              <Button
                size="xs"
                variant="ghost"
                onClick={onLogout}
                title="Encerrar sessão"
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar"
          aria-label="Navegação principal do workspace"
        >
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? "bg-brand text-white shadow-sm"
                    : "text-fg-secondary hover:text-fg hover:bg-elevated"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.id === "jobs" && pendingJobsCount > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                    }`}
                  >
                    {pendingJobsCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

