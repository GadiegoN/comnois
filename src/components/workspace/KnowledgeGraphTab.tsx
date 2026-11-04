"use client";

import React, { useMemo, useState } from "react";
import {
  Network,
  Sparkles,
  ExternalLink,
  Search,
  Star,
  Tag,
  Layers,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { SearchItem } from "@/types/platform";

interface GraphNode {
  id: string;
  title: string;
  type: SearchItem["type"];
  isFavorite: boolean;
  tags: string[];
  domain: string | null;
  x: number;
  y: number;
  degree: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  weight: number;
  sharedTags: string[];
  reason: string;
}

interface KnowledgeGraphTabProps {
  items: SearchItem[];
  onOpenItemDetail: (id: string) => void;
}

export function KnowledgeGraphTab({
  items,
  onOpenItemDetail,
}: KnowledgeGraphTabProps) {
  const [filterText, setFilterText] = useState("");
  const [minSharedTags, setMinSharedTags] = useState(1);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const filtered = items
      .filter((it) => {
        if (!filterText.trim()) return true;
        const q = filterText.toLowerCase();
        return (
          it.title.toLowerCase().includes(q) ||
          it.tags.some((t) => t.name.toLowerCase().includes(q)) ||
          (it.domain && it.domain.toLowerCase().includes(q))
        );
      })
      .slice(0, 40);

    const computedEdges: GraphEdge[] = [];
    const degreeMap = new Map<string, number>();

    for (let i = 0; i < filtered.length; i++) {
      for (let j = i + 1; j < filtered.length; j++) {
        const a = filtered[i];
        const b = filtered[j];
        const tagsA = new Set(
          a.tags
            .map((t) => t.name.toLowerCase())
            .filter((name) => name !== "documentacao")
        );
        const shared = b.tags
          .map((t) => t.name.toLowerCase())
          .filter((name) => tagsA.has(name));

        const sameDomain = Boolean(
          a.domain && b.domain && a.domain === b.domain
        );

        const weight = shared.length + (sameDomain ? 1 : 0);
        if (weight >= minSharedTags) {
          computedEdges.push({
            id: `${a.id}--${b.id}`,
            source: a.id,
            target: b.id,
            weight,
            sharedTags: shared,
            reason:
              shared.length > 0
                ? shared.map((t) => `#${t}`).join(", ")
                : `Domínio: ${a.domain}`,
          });
          degreeMap.set(a.id, (degreeMap.get(a.id) ?? 0) + 1);
          degreeMap.set(b.id, (degreeMap.get(b.id) ?? 0) + 1);
        }
      }
    }

    // Concentric radial layout: high-degree hub nodes closer to center, peripheral nodes on outer ring
    const sorted = [...filtered].sort(
      (a, b) => (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0)
    );

    const cx = 450;
    const cy = 270;
    const computedNodes: GraphNode[] = sorted.map((item, idx) => {
      const degree = degreeMap.get(item.id) ?? 0;
      const isInnerRing = idx < Math.min(8, Math.ceil(sorted.length / 3));
      const ringItemsCount = isInnerRing
        ? Math.min(8, Math.ceil(sorted.length / 3))
        : Math.max(1, sorted.length - Math.min(8, Math.ceil(sorted.length / 3)));
      const ringIndex = isInnerRing
        ? idx
        : idx - Math.min(8, Math.ceil(sorted.length / 3));
      const radius =
        sorted.length <= 1 ? 0 : isInnerRing ? 115 : 220;
      const angleOffset = isInnerRing ? 0 : Math.PI / ringItemsCount;
      const angle =
        (2 * Math.PI * ringIndex) / Math.max(1, ringItemsCount) + angleOffset;

      return {
        id: item.id,
        title: item.title,
        type: item.type,
        isFavorite: item.isFavorite,
        tags: item.tags.map((t) => t.name),
        domain: item.domain,
        x: Math.round(cx + radius * Math.cos(angle)),
        y: Math.round(cy + radius * Math.sin(angle)),
        degree,
      };
    });

    return { nodes: computedNodes, edges: computedEdges };
  }, [items, filterText, minSharedTags]);

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  const focusedNode = focusedNodeId ? nodeById.get(focusedNodeId) || null : null;

  const connectedNeighbors = useMemo(() => {
    if (!focusedNodeId) return [];
    const list: Array<{ node: GraphNode; reason: string; weight: number }> = [];
    for (const edge of edges) {
      if (edge.source === focusedNodeId) {
        const target = nodeById.get(edge.target);
        if (target) {
          list.push({ node: target, reason: edge.reason, weight: edge.weight });
        }
      } else if (edge.target === focusedNodeId) {
        const source = nodeById.get(edge.source);
        if (source) {
          list.push({ node: source, reason: edge.reason, weight: edge.weight });
        }
      }
    }
    return list.sort((a, b) => b.weight - a.weight);
  }, [focusedNodeId, edges, nodeById]);

  const connectedNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (focusedNodeId) {
      set.add(focusedNodeId);
      for (const n of connectedNeighbors) {
        set.add(n.node.id);
      }
    }
    return set;
  }, [focusedNodeId, connectedNeighbors]);

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-fg flex items-center gap-2">
              <Network className="w-4 h-4 text-brand-text" />
              Grafo de Nós do Conhecimento (&ldquo;Com Nós&rdquo;)
            </h2>
            <p className="text-xs text-fg-secondary">
              Cada documento do seu acervo é um nó conectado por afinidade temática, tags confirmadas e domínio. Clique em um nó para inspecionar suas conexões.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="brand">{nodes.length} Nós ativos</Badge>
            <Badge variant="purple">{edges.length} Conexões</Badge>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border-subtle">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-fg-muted absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filtrar nós do grafo por título, #tag ou domínio..."
              className="w-full pl-10 pr-4 py-1.5 rounded-xl bg-inset border border-border-subtle text-xs text-fg placeholder:text-fg-muted focus:outline-none focus:border-brand"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-fg-secondary">Densidade de Arestas:</span>
            <select
              value={minSharedTags}
              onChange={(e) => setMinSharedTags(Number(e.target.value))}
              className="rounded-xl bg-inset border border-border-subtle px-2.5 py-1.5 text-xs text-fg"
            >
              <option value={1}>1+ tag/domínio em comum (Completa)</option>
              <option value={2}>2+ tags em comum (Forte)</option>
              <option value={3}>3+ tags em comum (Núcleo Estrito)</option>
            </select>
            {focusedNodeId && (
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setFocusedNodeId(null)}
              >
                Limpar Foco
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Main Interactive Graph + Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <Card
          padding="none"
          className="lg:col-span-8 overflow-hidden bg-inset/60 border-border-strong"
        >
          <div className="flex items-center justify-between px-4 py-2.5 bg-surface border-b border-border-subtle text-[11px] text-fg-muted">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                Nó Padrão
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                Favorito (★)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Nó Selecionado
              </span>
            </div>
            <span>Clique em um nó para focar • Duplo clique para abrir</span>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox="0 0 900 540"
              className="w-full h-[460px] select-none"
              role="img"
              aria-label="Grafo interativo de nós do conhecimento"
            >
              {/* Edges */}
              {edges.map((edge) => {
                const source = nodeById.get(edge.source);
                const target = nodeById.get(edge.target);
                if (!source || !target) return null;

                const isHighlighted =
                  !focusedNodeId ||
                  edge.source === focusedNodeId ||
                  edge.target === focusedNodeId;

                return (
                  <line
                    key={edge.id}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={
                      focusedNodeId && isHighlighted
                        ? "var(--accent-primary)"
                        : "var(--border-strong)"
                    }
                    strokeOpacity={
                      !focusedNodeId ? 0.45 : isHighlighted ? 0.9 : 0.1
                    }
                    strokeWidth={Math.min(3.5, 1 + edge.weight * 0.6)}
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const isFocused = focusedNodeId === node.id;
                const isConnected =
                  !focusedNodeId || connectedNodeIds.has(node.id);
                const radius = Math.min(20, 10 + Math.sqrt(node.degree) * 2.2);

                const fillColor = isFocused
                  ? "#10b981"
                  : node.isFavorite
                    ? "#f59e0b"
                    : "var(--accent-primary)";

                const shortLabel =
                  node.title.length > 26
                    ? `${node.title.slice(0, 24)}…`
                    : node.title;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() =>
                      setFocusedNodeId((prev) =>
                        prev === node.id ? null : node.id
                      )
                    }
                    onDoubleClick={() => onOpenItemDetail(node.id)}
                    className="cursor-pointer transition-opacity"
                    style={{ opacity: isConnected ? 1 : 0.22 }}
                  >
                    {isFocused && (
                      <circle
                        r={radius + 6}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="3 2"
                      />
                    )}
                    <circle
                      r={radius}
                      fill={fillColor}
                      stroke="var(--bg-surface)"
                      strokeWidth={2.5}
                    />
                    <text
                      y={radius + 14}
                      textAnchor="middle"
                      fill="var(--text-primary)"
                      fontSize="10"
                      fontWeight={isFocused ? "700" : "500"}
                    >
                      {shortLabel}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </Card>

        {/* Right Column: Selected Node & Connected Neighbors */}
        <div className="lg:col-span-4 space-y-4">
          <Card padding="lg" className="space-y-4">
            {focusedNode ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="brand">
                        {focusedNode.type.toUpperCase()}
                      </Badge>
                      {focusedNode.isFavorite && (
                        <Badge variant="warning">
                          <Star className="w-3 h-3" /> Favorito
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-fg leading-snug">
                      {focusedNode.title}
                    </h3>
                  </div>
                </div>

                {focusedNode.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {focusedNode.tags.map((t) => (
                      <Badge key={t} variant="default">
                        <Tag className="w-2.5 h-2.5" /> #{t}
                      </Badge>
                    ))}
                  </div>
                )}

                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<ExternalLink className="w-3.5 h-3.5" />}
                  onClick={() => onOpenItemDetail(focusedNode.id)}
                  className="w-full"
                >
                  Abrir Leitor & Conexões Vetoriais
                </Button>

                <div className="pt-3 border-t border-border-subtle space-y-2.5">
                  <div className="text-xs font-bold text-fg flex items-center justify-between">
                    <span>Nós Conectados ({connectedNeighbors.length})</span>
                    <Sparkles className="w-3.5 h-3.5 text-brand-text" />
                  </div>

                  {connectedNeighbors.length === 0 ? (
                    <p className="text-xs text-fg-muted">
                      Nenhuma conexão direta com a densidade atual.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {connectedNeighbors.map(({ node, reason }) => (
                        <div
                          key={node.id}
                          onClick={() => setFocusedNodeId(node.id)}
                          className="p-2.5 rounded-xl bg-elevated/70 hover:bg-elevated border border-border-subtle cursor-pointer transition space-y-1"
                        >
                          <div className="text-xs font-semibold text-fg line-clamp-1">
                            {node.title}
                          </div>
                          <div className="text-[11px] font-mono text-brand-text">
                            Afinidade: {reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 space-y-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-soft text-brand-text flex items-center justify-center mx-auto">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-fg">
                  Inspecione qualquer Nó do Grafo
                </h3>
                <p className="text-xs text-fg-secondary leading-relaxed">
                  Clique em qualquer círculo no grafo ao lado para destacar sua vizinhança semântica, ver as tags compartilhadas e abrir o documento completo.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

