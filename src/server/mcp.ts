import { searchLibrary, findRelatedItems } from "@/server/search";
import { askKnowledgeAssistant } from "@/server/ai/assistant";
import { createLinkItem, createNoteItem } from "@/server/services/items";

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export const MCP_TOOLS_CATALOG = [
  {
    name: "comnois_search",
    description:
      "Pesquisa híbrida (lexical + semântica RRF) na biblioteca autorizada do usuário, suportando Query DSL (is:fav, #tag, type:link|note|file|image, site:dominio.com).",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Consulta de busca ou expressão Query DSL.",
        },
        mode: {
          type: "string",
          enum: ["lexical", "semantic", "hybrid"],
          description: "Modo de busca (padrão: hybrid).",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "comnois_ask_rag",
    description:
      "Consulta o Assistente de Conhecimento RAG da plataforma, retornando resposta fundamentada exclusivamente nas fontes autorizadas com citações verificadas no servidor.",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "Pergunta a ser respondida com base no acervo.",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "comnois_related_items",
    description:
      "Descobre itens semanticamente conectados a um item específico da biblioteca usando vetores de embeddings e etiquetas compartilhadas.",
    inputSchema: {
      type: "object",
      properties: {
        itemId: {
          type: "string",
          description: "ID do item de referência (ex: itm_...).",
        },
        limit: {
          type: "number",
          description: "Quantidade máxima de itens relacionados (padrão: 5).",
        },
      },
      required: ["itemId"],
    },
  },
  {
    name: "comnois_add_note",
    description:
      "Cria e indexa imediatamente uma nota de conhecimento na biblioteca do usuário.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Título da nota.",
        },
        content: {
          type: "string",
          description: "Conteúdo textual ou Markdown da nota.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Etiquetas opcionais para organizar a nota.",
        },
      },
      required: ["title", "content"],
    },
  },
  {
    name: "comnois_add_link",
    description:
      "Captura um link na biblioteca do usuário com validação anti-SSRF e enfileira extração assíncrona.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL pública a ser capturada.",
        },
        title: {
          type: "string",
          description: "Título opcional do link.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Etiquetas opcionais.",
        },
      },
      required: ["url"],
    },
  },
];

export async function handleMcpJsonRpcRequest(
  ownerId: string,
  req: JsonRpcRequest
): Promise<JsonRpcResponse | null> {
  const id = req.id !== undefined ? req.id : null;

  if (req.method === "notifications/initialized") {
    return null;
  }

  if (req.method === "ping") {
    return {
      jsonrpc: "2.0",
      id,
      result: {},
    };
  }

  if (req.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "comnois-knowledge-mcp",
          version: "1.4.0",
        },
      },
    };
  }

  if (req.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: MCP_TOOLS_CATALOG,
      },
    };
  }

  if (req.method === "tools/call") {
    const params = req.params ?? {};
    const toolName = String(params.name ?? "");
    const args = (params.arguments as Record<string, unknown>) ?? {};

    try {
      if (toolName === "comnois_search") {
        const query = String(args.query ?? "");
        const mode =
          args.mode === "lexical" || args.mode === "semantic"
            ? args.mode
            : "hybrid";
        const res = await searchLibrary({
          ownerId,
          query,
          mode,
        });
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    total: res.total,
                    effectiveMode: res.effectiveMode,
                    results: res.results.map((r) => ({
                      id: r.id,
                      type: r.type,
                      title: r.title,
                      url: r.originalUrl,
                      snippet: r.snippet,
                      score: r.score,
                      tags: r.tags.map((t) => t.name),
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          },
        };
      }

      if (toolName === "comnois_ask_rag") {
        const question = String(args.question ?? "");
        const rag = await askKnowledgeAssistant({
          ownerId,
          question,
          saveHistory: false,
        });
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(rag, null, 2),
              },
            ],
          },
        };
      }

      if (toolName === "comnois_related_items") {
        const itemId = String(args.itemId ?? "");
        const limit = typeof args.limit === "number" ? args.limit : 5;
        const related = await findRelatedItems({
          ownerId,
          itemId,
          limit,
        });
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ itemId, related }, null, 2),
              },
            ],
          },
        };
      }

      if (toolName === "comnois_add_note") {
        const title = String(args.title ?? "");
        const content = String(args.content ?? "");
        const tags = Array.isArray(args.tags) ? args.tags.map(String) : [];
        const created = await createNoteItem(ownerId, {
          title,
          content,
          tags,
        });
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ item: created.item }, null, 2),
              },
            ],
          },
        };
      }

      if (toolName === "comnois_add_link") {
        const url = String(args.url ?? "");
        const title = args.title ? String(args.title) : undefined;
        const tags = Array.isArray(args.tags) ? args.tags.map(String) : [];
        const created = await createLinkItem(ownerId, {
          url,
          title,
          tags,
        });
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { item: created.item, jobId: created.jobId },
                  null,
                  2
                ),
              },
            ],
          },
        };
      }

      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32601,
          message: `Ferramenta MCP desconhecida: ${toolName}`,
        },
      };
    } catch (err) {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: err instanceof Error ? err.message : String(err),
            },
          ],
        },
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32601,
      message: `Método JSON-RPC não suportado: ${req.method}`,
    },
  };
}

