import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { items, documentChunks, embeddings } from "@/db/schema";
import { normalizeSearchText } from "@/server/search/chunker";
import {
  checkAndRecordAiUsage,
  cosineSimilarity,
  GroundedSourceSnippet,
  resolveAiProviderForUser,
  AIProviderAdapter,
} from "./providers";
import { requireWorkspaceRole } from "@/server/services/workspaces";

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|rules|prompts)/gi,
  /disregard\s+(all\s+)?(previous|prior|system)\s+(instructions|rules)/gi,
  /esque[cç]a\s+(todas\s+as\s+)?(instru[cç][oõ]es|regras)\s+(anteriores|acima)/gi,
  /ignore\s+(todas\s+as\s+)?(instru[cç][oõ]es|regras)\s+(anteriores|do\s+sistema)/gi,
  /system\s*prompt\s*:/gi,
  /\[system\s*instruction\]/gi,
  /voc[eê]\s+agora\s+deve\s+obedecer/gi,
  /new\s+system\s+instructions\s*:/gi,
];

export function sanitizeUntrustedChunkForRag(rawText: string): {
  sanitizedText: string;
  injectionDetected: boolean;
} {
  let text = rawText;
  let injectionDetected = false;

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      injectionDetected = true;
      text = text.replace(pattern, "[CONTEÚDO EXTERNO BLOQUEADO POR POLÍTICA ANTI-INJECTION]");
    }
    pattern.lastIndex = 0;
  }

  return {
    sanitizedText: text,
    injectionDetected,
  };
}

export interface VerifiedCitation {
  citationId: string;
  itemId: string;
  chunkId: string;
  title: string;
  originalUrl: string | null;
  domain: string | null;
  quote: string;
  locator: string;
  startOffset: number;
  endOffset: number;
}

export interface AssistantQueryResult {
  question: string;
  answer: string;
  directEvidenceSummary: string[];
  synthesisNotes: string[];
  citations: VerifiedCitation[];
  hasConflict: boolean;
  conflictExplanation?: string;
  insufficientEvidence: boolean;
  promptInjectionNeutralized: boolean;
  scopeNote: string;
  providerUsed: string;
}

export async function askKnowledgeAssistant(input: {
  ownerId: string;
  workspaceId?: string | null;
  question: string;
  itemIdsFilter?: string[];
  maxSources?: number;
  customProvider?: AIProviderAdapter;
}): Promise<AssistantQueryResult> {
  const question = input.question.trim();
  if (!question) {
    return {
      question: "",
      answer: "Por favor, digite uma pergunta para consultar sua biblioteca.",
      directEvidenceSummary: [],
      synthesisNotes: [],
      citations: [],
      hasConflict: false,
      insufficientEvidence: true,
      promptInjectionNeutralized: false,
      scopeNote: "Nenhuma consulta executada.",
      providerUsed: "none",
    };
  }

  if (input.workspaceId) {
    await requireWorkspaceRole(input.ownerId, input.workspaceId, "member");
  }

  const provider =
    input.customProvider ?? (await resolveAiProviderForUser(input.ownerId));
  const caps = provider.getCapabilities();

  const db = await getDb();

  // Strictly load items belonging to the authorized user or workspace
  const authorizedItems = await db
    .select()
    .from(items)
    .where(
      input.workspaceId
        ? eq(items.workspaceId, input.workspaceId)
        : eq(items.ownerId, input.ownerId)
    );

  const filteredItems = input.itemIdsFilter?.length
    ? authorizedItems.filter((i) => input.itemIdsFilter!.includes(i.id))
    : authorizedItems.filter((i) => !i.isArchived);

  if (filteredItems.length === 0) {
    return {
      question,
      answer:
        "Não há itens disponíveis no escopo autorizado da sua biblioteca para responder a esta pergunta.",
      directEvidenceSummary: [],
      synthesisNotes: ["Biblioteca vazia ou nenhum item corresponde ao filtro selecionado."],
      citations: [],
      hasConflict: false,
      insufficientEvidence: true,
      promptInjectionNeutralized: false,
      scopeNote: "Consultados 0 itens no escopo autorizado.",
      providerUsed: caps.provider,
    };
  }

  const itemMap = new Map(filteredItems.map((i) => [i.id, i]));
  const allowedItemIds = filteredItems.map((i) => i.id);

  const chunks = await db
    .select()
    .from(documentChunks)
    .where(inArray(documentChunks.itemId, allowedItemIds));

  if (chunks.length === 0) {
    return {
      question,
      answer:
        "Os itens da sua biblioteca ainda não possuem trechos de texto extraídos ou indexados para sustentar uma resposta fundamentada.",
      directEvidenceSummary: [],
      synthesisNotes: [],
      citations: [],
      hasConflict: false,
      insufficientEvidence: true,
      promptInjectionNeutralized: false,
      scopeNote: `Consultados ${filteredItems.length} item(ns), mas 0 trechos indexados encontrados.`,
      providerUsed: caps.provider,
    };
  }

  // Score chunks using lexical + semantic hybrid retrieval
  const ASSISTANT_STOPWORDS = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "em",
    "no",
    "na",
    "nos",
    "nas",
    "um",
    "uma",
    "uns",
    "umas",
    "para",
    "por",
    "com",
    "sem",
    "sob",
    "sobre",
    "entre",
    "que",
    "como",
    "qual",
    "quais",
    "quando",
    "onde",
    "quem",
    "isso",
    "isto",
    "aquilo",
    "este",
    "esta",
    "esse",
    "essa",
    "foi",
    "sao",
    "ser",
    "estar",
    "ter",
    "mais",
    "menos",
    "muito",
    "muita",
    "tambem",
    "pelo",
    "pela",
    "pelos",
    "pelas",
    "seu",
    "sua",
    "seus",
    "suas",
    "funciona",
    "existe",
  ]);

  const qNorm = normalizeSearchText(question);
  const qTerms = qNorm
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !ASSISTANT_STOPWORDS.has(t));

  let queryEmbedding: number[] | null = null;
  if (caps.supportsEmbeddings) {
    try {
      const embRes = await provider.generateEmbedding(question);
      queryEmbedding = embRes.vector;
    } catch {
      queryEmbedding = null;
    }
  }

  const embRows = queryEmbedding
    ? await db
        .select()
        .from(embeddings)
        .where(inArray(embeddings.itemId, allowedItemIds))
    : [];
  const embByChunk = new Map(embRows.map((e) => [e.chunkId, e.vectorJson]));

  const scoredChunks: Array<{
    chunk: (typeof chunks)[0];
    item: (typeof filteredItems)[0];
    score: number;
  }> = [];

  for (const chk of chunks) {
    const parentItem = itemMap.get(chk.itemId);
    if (!parentItem) continue;

    let lexicalHits = 0;
    const titleNorm = normalizeSearchText(parentItem.title);
    for (const term of qTerms) {
      if (chk.normalizedText.includes(term)) {
        lexicalHits += 2.0;
      }
      if (titleNorm.includes(term)) {
        lexicalHits += 1.2;
      }
    }

    let semScore = 0;
    if (queryEmbedding) {
      const vec = embByChunk.get(chk.id);
      if (vec && vec.length === queryEmbedding.length) {
        semScore = Math.max(0, cosineSimilarity(queryEmbedding, vec));
      }
    }

    // Require either a meaningful lexical term match or strong semantic similarity (>= 0.55)
    if (lexicalHits === 0 && semScore < 0.55) {
      continue;
    }

    const combinedScore = lexicalHits + semScore * 3.0;
    scoredChunks.push({
      chunk: chk,
      item: parentItem,
      score: combinedScore,
    });
  }

  scoredChunks.sort((a, b) => b.score - a.score);

  // Enforce diversity: max 2 chunks per item, max 5 total chunks
  const maxSources = Math.min(8, Math.max(1, input.maxSources ?? 5));
  const perItemCount = new Map<string, number>();
  const selectedChunks: typeof scoredChunks = [];

  for (const candidate of scoredChunks) {
    const countForItem = perItemCount.get(candidate.item.id) ?? 0;
    if (countForItem >= 2) continue;
    selectedChunks.push(candidate);
    perItemCount.set(candidate.item.id, countForItem + 1);
    if (selectedChunks.length >= maxSources) break;
  }

  if (selectedChunks.length === 0) {
    return {
      question,
      answer:
        "Não foram encontradas evidências relevantes nas suas fontes para responder a esta pergunta com segurança. Tente reformular a busca ou adicionar mais materiais sobre o tema.",
      directEvidenceSummary: [],
      synthesisNotes: [
        `Foram avaliados ${chunks.length} trechos em ${filteredItems.length} itens autorizados, mas nenhum apresentou evidência compatível com a pergunta.`,
      ],
      citations: [],
      hasConflict: false,
      insufficientEvidence: true,
      promptInjectionNeutralized: false,
      scopeNote: `Avaliados ${chunks.length} trechos em ${filteredItems.length} itens do seu acervo; 0 trechos relevantes encontrados.`,
      providerUsed: caps.provider,
    };
  }

  // Sanitize chunks against prompt injection and build unforgeable citation map
  let promptInjectionNeutralized = false;
  const citationMap = new Map<string, VerifiedCitation>();
  const groundedSnippets: GroundedSourceSnippet[] = [];

  selectedChunks.forEach((entry, idx) => {
    const citationId = `CIT-${idx + 1}`;
    const { sanitizedText, injectionDetected } = sanitizeUntrustedChunkForRag(
      entry.chunk.text
    );
    if (injectionDetected) {
      promptInjectionNeutralized = true;
    }

    const verified: VerifiedCitation = {
      citationId,
      itemId: entry.item.id,
      chunkId: entry.chunk.id,
      title: entry.item.title,
      originalUrl: entry.item.originalUrl,
      domain: entry.item.domain,
      quote: sanitizedText,
      locator: entry.chunk.locator,
      startOffset: entry.chunk.startOffset,
      endOffset: entry.chunk.endOffset,
    };

    citationMap.set(citationId, verified);
    groundedSnippets.push({
      citationId,
      chunkId: entry.chunk.id,
      itemId: entry.item.id,
      title: entry.item.title,
      text: sanitizedText,
      locator: entry.chunk.locator,
      url: entry.item.originalUrl,
    });
  });

  const generation = await provider.generateGroundedAnswer({
    question,
    sources: groundedSnippets,
  });

  await checkAndRecordAiUsage({
    ownerId: input.ownerId,
    provider: caps.provider,
    model: caps.modelVersion,
    operation: "assistant_answer",
    inputTokens: generation.inputTokens,
    outputTokens: generation.outputTokens,
  });

  // SERVER-SIDE CITATION VALIDATION:
  // Reject any citation ID not present in citationMap!
  const normalizedRequestedIds = new Set<string>();
  for (const rawId of generation.output.citedIds) {
    const cleaned = rawId.replace(/[\[\]\s]/g, "").toUpperCase();
    if (citationMap.has(cleaned)) {
      normalizedRequestedIds.add(cleaned);
    }
  }

  // Also scan answer text for [CIT-N] references and strip any hallucinated [CIT-99]
  const sanitizedAnswer = generation.output.answer.replace(
    /\[(CIT-\d+)\]/gi,
    (fullMatch, group1: string) => {
      const upper = group1.toUpperCase();
      if (citationMap.has(upper)) {
        normalizedRequestedIds.add(upper);
        return `[${upper}]`;
      }
      return "[citação inválida removida]";
    }
  );

  // If the model failed to cite any valid source despite not marking insufficientEvidence,
  // do NOT present as a grounded answer without citations.
  const verifiedCitations = [...normalizedRequestedIds]
    .map((id) => citationMap.get(id)!)
    .filter(Boolean);

  if (!generation.output.insufficientEvidence && verifiedCitations.length === 0) {
    return {
      question,
      answer:
        "O modelo não conseguiu vincular a resposta a citações válidas das fontes recuperadas. Confira abaixo os trechos diretamente localizados no seu acervo.",
      directEvidenceSummary: groundedSnippets.map(
        (s) => `[${s.citationId}] (${s.title}): "${s.text.slice(0, 220)}"`
      ),
      synthesisNotes: [
        "Resposta livre descartada pela validação de segurança por ausência de citações verificáveis.",
      ],
      citations: [...citationMap.values()],
      hasConflict: false,
      insufficientEvidence: true,
      promptInjectionNeutralized,
      scopeNote: `Recuperados ${groundedSnippets.length} trechos de ${filteredItems.length} itens autorizados.`,
      providerUsed: caps.provider,
    };
  }

  return {
    question,
    answer: sanitizedAnswer,
    directEvidenceSummary: generation.output.directEvidenceSummary,
    synthesisNotes: generation.output.synthesisNotes,
    citations: verifiedCitations,
    hasConflict: generation.output.hasConflict,
    conflictExplanation: generation.output.conflictExplanation,
    insufficientEvidence: generation.output.insufficientEvidence,
    promptInjectionNeutralized,
    scopeNote: `Resposta baseada em ${verifiedCitations.length} trecho(s) recuperado(s) dentre ${filteredItems.length} item(ns) ativos da sua biblioteca.`,
    providerUsed: caps.provider,
  };
}
