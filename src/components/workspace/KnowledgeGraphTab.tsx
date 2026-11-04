"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Network,
  Sparkles,
  ExternalLink,
  Search,
  Star,
  Tag,
  Layers,
  RefreshCw,
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
  centralityScore: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  similarityScore: number;
  vectorSimilarity: number;
  sharedTags: string[];
  connectionReason: string;
}

interface KnowledgeGraphTabProps {
  items: SearchItem[];
  activeWorkspaceId?: string;
  onOpenItemDetail: (id: string) => void;
}

export function KnowledgeGraphTab({
  items,
  activeWorkspaceId,
  onOpenItemDetail,
}: KnowledgeGraphTabProps) {
  const [filterText, setFilterText] = useState("");
  const [minSimilarity, setMinSimilarity] = useState(0.35);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [serverGraph, setServerGraph] = useState<{
    nodes: Array<Omit<GraphNode, "x" | "y">>;
    edges: GraphEdge[];
    mermaid?: string;
    stats: {
      totalNodes: number;
      totalEdges: number;
      isolatedNodes: number;
      avgDegree: number;
    };
  } | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [showMermaidPreview, setShowMermaidPreview] = useState(false);

  const fetchServerGraph = useCallback(async () => {
    setLoadingGraph(true);
    try {
      const wsQuery = activeWorkspaceId
        ? `&workspaceId=${encodeURIComponent(activeWorkspaceId)}`
        : "";
      const res = await fetch(
        `/api/graph?maxNodes=45&minSimilarity=${minSimilarity}${wsQuery}`
      );
      if (res.ok) {
        const data = await res.json();
        setServerGraph(data);
      }
    } finally {
      setLoadingGraph(false);
    }
  }, [minSimilarity, activeWorkspaceId]);

  useEffect(() => {
    void fetchServerGraph();
  }, [fetchServerGraph, items.length]);

  const { nodes, edges, avgDegree } = useMemo(() => {
    const rawNodes =
      serverGraph?.nodes ??
      items.slice(0, 40).map((it) => ({
        id: it.id,
        title: it.title,
        type: it.type,
        isFavorite: it.isFavorite,
        tags: it.tags.map((t) => t.name),
        domain: it.domain,
        degree: 0,
        centralityScore: 0,
      }));

    const filteredNodes = rawNodes.filter((n) => {
      if (!filterText.trim()) return true;
      const q = filterText.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)) ||
        (n.domain && n.domain.toLowerCase().includes(q))
      );
    });

    const allowedIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = (serverGraph?.edges ?? []).filter(
      (e) => allowedIds.has(e.source) && allowedIds.has(e.target)
    );

    // Concentric radial layout ordered by centrality & degree
    const sorted = [...filteredNodes].sort(
      (a, b) => b.centralityScore - a.centralityScore || b.degree - a.degree
    );

    const cx = 450;
    const cy = 270;
    const innerCapacity = Math.min(8, Math.ceil(sorted.length / 3));
    const outerCapacity = Math.max(1, sorted.length - innerCapacity);

    const positionedNodes: GraphNode[] = sorted.map((node, idx) => {
      const isInner = idx < innerCapacity;
      const ringCount = isInner ? innerCapacity : outerCapacity;
      const ringIndex = isInner ? idx : idx - innerCapacity;
      const radius = sorted.length <= 1 ? 0 : isInner ? 115 : 220;
      const angleOffset = isInner ? 0 : Math.PI / Math.max(1, ringCount);
      const angle =
        (2 * Math.PI * ringIndex) / Math.max(1, ringCount) + angleOffset;

      return {
        ...node,
        x: Math.round(cx + radius * Math.cos(angle)),
        y: Math.round(cy + radius * Math.sin(angle)),
      };
    });

    return {
      nodes: positionedNodes,
      edges: filteredEdges,
      avgDegree: serverGraph?.stats?.avgDegree ?? 0,
    };
  }, [serverGraph, items, filterText]);

  const nodeById = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  const focusedNode = focusedNodeId ? nodeById.get(focusedNodeId) || null : null;

  const connectedNeighbors = useMemo(() => {
    if (!focusedNodeId) return [];
    const list: Array<{
      node: GraphNode;
      reason: string;
      similarityScore: number;
      vectorSimilarity: number;
    }> = [];
    for (const edge of edges) {
      if (edge.source === focusedNodeId) {
        const target = nodeById.get(edge.target);
        if (target) {
          list.push({
            node: target,
            reason: edge.connectionReason,
            similarityScore: edge.similarityScore,
            vectorSimilarity: edge.vectorSimilarity,
          });
        }
      } else if (edge.target === focusedNodeId) {
        const source = nodeById.get(edge.source);
        if (source) {
          list.push({
            node: source,
            reason: edge.connectionReason,
            similarityScore: edge.similarityScore,
            vectorSimilarity: edge.vectorSimilarity,
          });
        }
      }
    }
    return list.sort((a, b) => b.similarityScore - a.similarityScore);
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
              Grafo Semântico de Nós do Conhecimento (&ldquo;Com Nós&rdquo;)
            </h2>
            <p className="text-xs text-fg-secondary">
              Calculado no servidor combinando similaridade de cosseno entre embeddings vetoriais (65%), interseção de tags confirmadas (30%) e domínio.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="brand">{nodes.length} Nós</Badge>
            <Badge variant="purple">{edges.length} Conexões Semânticas</Badge>
            <Badge variant="default">Grau médio: {avgDegree}</Badge>
            {serverGraph?.mermaid && (
              <Button
                size="xs"
                variant="outline"
                onClick={() => setShowMermaidPreview((prev) => !prev)}
              >
                {showMermaidPreview ? "Ocultar Mermaid" : "Diagrama Mermaid (.mmd)"}
              </Button>
            )}
            <Button
              size="xs"
              variant="secondary"
              disabled={loadingGraph}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={fetchServerGraph}
            >
              {loadingGraph ? "Calculando..." : "Recalcular"}
            </Button>
          </div>
        </div>

        {showMermaidPreview && serverGraph?.mermaid && (
          <div className="p-3.5 rounded-2xl bg-inset border border-border-subtle space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-brand-text">
                Topologia Exportável em Mermaid (`flowchart LR`)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard?.writeText(serverGraph.mermaid || "");
                  }}
                >
                  Copiar Mermaid
                </Button>
                <a
                  href={`/api/graph?maxNodes=45&minSimilarity=${minSimilarity}${
                    activeWorkspaceId
                      ? `&workspaceId=${encodeURIComponent(activeWorkspaceId)}`
                      : ""
                  }&format=mermaid`}
                  className="inline-flex items-center gap-1 rounded-xl bg-brand text-white px-2.5 py-1 text-xs font-semibold hover:bg-brand-hover transition"
                >
                  Baixar .mmd
                </a>
              </div>
            </div>
            <pre className="text-[11px] font-mono text-fg bg-surface p-3 rounded-xl border border-border-subtle overflow-x-auto max-h-48">
              {serverGraph.mermaid}
            </pre>
          </div>
        )}

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
            <span className="text-fg-secondary">Limiar Semântico:</span>
            <select
              value={minSimilarity}
              onChange={(e) => setMinSimilarity(Number(e.target.value))}
              className="rounded-xl bg-inset border border-border-subtle px-2.5 py-1.5 text-xs text-fg"
            >
              <option value={0.25}>25%+ (Rede Ampla)</option>
              <option value={0.35}>35%+ (Equilibrado)</option>
              <option value={0.5}>50%+ (Alta Similaridade Vetorial)</option>
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
                Nó Documental
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                Favorito (★)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Nó em Foco
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
                    strokeWidth={Math.min(
                      3.5,
                      1 + edge.similarityScore * 2.5
                    )}
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const isFocused = focusedNodeId === node.id;
                const isConnected =
                  !focusedNodeId || connectedNodeIds.has(node.id);
                const radius = Math.min(
                  20,
                  10 + Math.sqrt(node.degree) * 2.1
                );

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
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="brand">
                      {focusedNode.type.toUpperCase()}
                    </Badge>
                    <Badge variant="purple">
                      Centralidade{" "}
                      {Math.round(focusedNode.centralityScore * 100)}%
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
                  Abrir Leitor Editorial & Snapshots
                </Button>

                <div className="pt-3 border-t border-border-subtle space-y-2.5">
                  <div className="text-xs font-bold text-fg flex items-center justify-between">
                    <span>
                      Nós Conectados ({connectedNeighbors.length})
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-brand-text" />
                  </div>

                  {connectedNeighbors.length === 0 ? (
                    <p className="text-xs text-fg-muted">
                      Nenhuma conexão acima do limiar atual.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {connectedNeighbors.map(
                        ({ node, reason, similarityScore }) => (
                          <div
                            key={node.id}
                            onClick={() => setFocusedNodeId(node.id)}
                            className="p-2.5 rounded-xl bg-elevated/70 hover:bg-elevated border border-border-subtle cursor-pointer transition space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-fg line-clamp-1">
                                {node.title}
                              </span>
                              <Badge variant="brand">
                                {Math.round(similarityScore * 100)}%
                              </Badge>
                            </div>
                            <div className="text-[11px] font-mono text-brand-text">
                              {reason}
                            </div>
                          </div>
                        )
                      )}
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
                  Clique em qualquer círculo no grafo ao lado para ver o score de similaridade vetorial (cosseno), centralidade na rede e tags compartilhadas.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
