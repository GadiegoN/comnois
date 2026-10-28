"use client";

import React from "react";
import {
  Sparkles,
  Send,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Quote,
  History,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Input";
import type {
  AssistantAnswer,
  CollectionInfo,
  TagInfo,
} from "@/types/platform";

export interface ConversationSummary {
  id: string;
  title: string;
  scopeSummary: string | null;
  updatedAt: string;
  messagesCount?: number;
}

interface AssistantTabProps {
  question: string;
  onQuestionChange: (q: string) => void;
  scopeCollectionId: string;
  onScopeCollectionChange: (id: string) => void;
  scopeTag: string;
  onScopeTagChange: (tag: string) => void;
  collections: CollectionInfo[];
  tags: TagInfo[];
  asking: boolean;
  answer: AssistantAnswer | null;
  onAskSubmit: (e: React.FormEvent) => Promise<void>;
  conversations: ConversationSummary[];
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onPurgeOldConversations: () => Promise<void>;
  onOpenCitedItem: (itemId: string) => void;
}

const EXAMPLE_QUESTIONS = [
  "Quais são os requisitos de segurança, anti-SSRF e LGPD da plataforma?",
  "Como funciona a busca híbrida com Reciprocal Rank Fusion (RRF)?",
  "Como o assistente RAG evita alucinações e valida citações?",
];

export function AssistantTab({
  question,
  onQuestionChange,
  scopeCollectionId,
  onScopeCollectionChange,
  scopeTag,
  onScopeTagChange,
  collections,
  tags,
  asking,
  answer,
  onAskSubmit,
  conversations,
  selectedConversationId,
  onSelectConversation,
  onDeleteConversation,
  onPurgeOldConversations,
  onOpenCitedItem,
}: AssistantTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: RAG Prompt & Grounded Answer */}
      <div className="lg:col-span-8 space-y-6">
        <Card padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-fg flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-text" />
                Assistente RAG com Citações Literalmente Verificadas
              </h2>
              <p className="text-xs text-fg-secondary">
                Respostas estritamente fundamentadas nos chunks do seu acervo, com proteção contra Prompt Injection e detecção de conflitos.
              </p>
            </div>
            <Badge variant="brand">Grounding Verificado</Badge>
          </div>

          <form onSubmit={onAskSubmit} className="space-y-3">
            <textarea
              rows={3}
              required
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              placeholder="Faça uma pergunta ao seu acervo (ex: Quais são as diretrizes de segurança e privacidade?)..."
              className="w-full rounded-2xl bg-inset border border-border-subtle p-3.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <Select
                label="Escopo por Coleção (opcional)"
                value={scopeCollectionId}
                onChange={(e) => onScopeCollectionChange(e.target.value)}
              >
                <option value="">Todo o acervo autorizado</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>

              <Select
                label="Escopo por Tag (opcional)"
                value={scopeTag}
                onChange={(e) => onScopeTagChange(e.target.value)}
              >
                <option value="">Todas as tags</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.name}>
                    #{t.name}
                  </option>
                ))}
              </Select>

              <Button
                type="submit"
                disabled={asking}
                leftIcon={<Send className="w-4 h-4" />}
                className="w-full"
              >
                {asking ? "Auditando Fontes..." : "Perguntar às Fontes"}
              </Button>
            </div>
          </form>

          {/* Quick Suggested Questions */}
          <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-fg-muted mr-1">Sugestões:</span>
            {EXAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => onQuestionChange(q)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-elevated hover:bg-inset text-fg-secondary hover:text-fg border border-border-subtle transition cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </Card>

        {/* Grounded Answer Output */}
        {answer && (
          <Card padding="lg" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <Badge
                  variant={answer.insufficientEvidence ? "warning" : "success"}
                >
                  {answer.insufficientEvidence
                    ? "Evidência Insuficiente"
                    : `${answer.citations.length} Citação(ões) Verificada(s)`}
                </Badge>
                <Badge variant="default">Motor: {answer.providerUsed}</Badge>
              </div>
              <span className="text-xs text-fg-muted">{answer.scopeNote}</span>
            </div>

            {answer.promptInjectionNeutralized && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>
                  Tentativa de Prompt Injection detectada em uma das fontes e neutralizada antes da síntese.
                </span>
              </div>
            )}

            {answer.hasConflict && (
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Foram detectadas divergências ou potenciais conflitos entre as fontes recuperadas. Verifique as citações abaixo.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-brand-text">
                Resposta Fundamentada
              </div>
              <div className="p-4 rounded-2xl bg-inset border border-border-subtle text-sm text-fg whitespace-pre-wrap leading-relaxed">
                {answer.answer}
              </div>
            </div>

            {/* Verified Literal Citations */}
            {answer.citations.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                  Trechos Literais Auditados ({answer.citations.length})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {answer.citations.map((cit, idx) => (
                    <Card
                      key={`${cit.chunkId}-${idx}`}
                      padding="sm"
                      className="space-y-2 bg-elevated/50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenCitedItem(cit.itemId)}
                          className="text-xs font-bold text-brand-text hover:underline flex items-center gap-1 text-left cursor-pointer"
                        >
                          <Quote className="w-3.5 h-3.5 shrink-0" />
                          <span className="line-clamp-1">
                            [{idx + 1}] {cit.title || cit.itemTitle}
                          </span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </button>
                        {(cit.verifiedLiteral ?? true) && (
                          <Badge variant="success">
                            <CheckCircle2 className="w-3 h-3" /> Literal
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs italic text-fg-secondary border-l-2 border-brand pl-2.5">
                        &ldquo;{cit.quote}&rdquo;
                      </p>
                      {(cit.locator || cit.sectionTitle) && (
                        <div className="text-[10px] font-mono text-fg-muted">
                          Localizador: {cit.locator || cit.sectionTitle}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Right Column: Persistent Auditable Conversation History */}
      <div className="lg:col-span-4">
        <Card padding="md" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-fg flex items-center gap-2">
              <History className="w-4 h-4 text-brand-text" />
              Histórico Auditável ({conversations.length})
            </h3>
            {conversations.length > 0 && (
              <Button
                size="xs"
                variant="ghost"
                onClick={onPurgeOldConversations}
                title="Expurgar conversas antigas conforme política de retenção"
              >
                Limpar Antigas
              </Button>
            )}
          </div>

          {conversations.length === 0 ? (
            <p className="text-xs text-fg-muted py-4 text-center">
              Nenhuma consulta salva ainda. Suas perguntas e citações verificadas aparecerão aqui.
            </p>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {conversations.map((conv) => {
                const active = selectedConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2 ${
                      active
                        ? "bg-brand-soft border-brand/40"
                        : "bg-elevated/60 hover:bg-elevated border-border-subtle"
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="text-xs font-semibold text-fg line-clamp-2">
                        {conv.title}
                      </div>
                      <div className="text-[10px] text-fg-muted">
                        {new Date(conv.updatedAt).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="text-fg-muted hover:text-red-500 p-1 cursor-pointer"
                      title="Excluir registro de conversa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
