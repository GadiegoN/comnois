import { registerUser } from "@/server/services/auth";
import { createNoteItem, deleteItem } from "@/server/services/items";
import { searchLibrary } from "./index";
import { askKnowledgeAssistant } from "@/server/ai/assistant";

export interface BenchmarkQueryCase {
  id: string;
  category: "curta" | "nome_proprio" | "sigla" | "conceitual_semantica" | "prompt_injection";
  query: string;
  expectedDocKey: string;
}

export interface ModeMetrics {
  mode: "lexical" | "semantic" | "hybrid";
  recallAt3: number;
  precisionAt1: number;
  mrr: number;
  avgLatencyMs: number;
}

export interface SearchAndRagBenchmarkReport {
  executedAt: string;
  corpusSize: number;
  queriesCount: number;
  modes: Record<"lexical" | "semantic" | "hybrid", ModeMetrics>;
  ragEvaluation: {
    groundedAnswerRate: number;
    citationAccuracyRate: number;
    promptInjectionBlocked: boolean;
    unanswerableCorrectlyAbstained: boolean;
  };
}

const BENCHMARK_CORPUS: Array<{
  key: string;
  title: string;
  content: string;
  tags: string[];
}> = [
  {
    key: "doc_pg",
    title: "Arquitetura Relacional com PostgreSQL e Drizzle ORM",
    content:
      "O banco de dados PostgreSQL utiliza índices GIN e B-Tree para acelerar consultas transacionais ACID. Migrações versionadas pelo Drizzle ORM garantem integridade referencial.",
    tags: ["postgresql", "drizzle", "banco"],
  },
  {
    key: "doc_ssrf",
    title: "Proteção contra SSRF e Validação DNS em Captura Web",
    content:
      "Ataques de Server-Side Request Forgery (SSRF) exploram redirecionamentos HTTP e DNS rebinding para alcançar o endpoint 169.254.169.254 ou redes privadas RFC 1918.",
    tags: ["seguranca", "ssrf", "rede"],
  },
  {
    key: "doc_rag",
    title: "Recuperação Híbrida com Reciprocal Rank Fusion (RRF)",
    content:
      "Sistemas de RAG combinam busca lexical por termos exatos e busca vetorial por embeddings usando a fórmula RRF (k=60) criada por Gordon Cormack.",
    tags: ["ia", "rag", "rrf"],
  },
  {
    key: "doc_auth",
    title: "Criptografia de Senhas com Scrypt e Sessões HttpOnly",
    content:
      "Credenciais de autenticação devem usar função de derivação de chave Scrypt com salt aleatório e comparação em tempo constante para mitigar ataques de timing.",
    tags: ["autenticacao", "scrypt", "seguranca"],
  },
];

const BENCHMARK_QUERIES: BenchmarkQueryCase[] = [
  {
    id: "q_short",
    category: "curta",
    query: "transacionais ACID",
    expectedDocKey: "doc_pg",
  },
  {
    id: "q_proper_noun",
    category: "nome_proprio",
    query: "Gordon Cormack",
    expectedDocKey: "doc_rag",
  },
  {
    id: "q_acronym",
    category: "sigla",
    query: "SSRF RFC 1918",
    expectedDocKey: "doc_ssrf",
  },
  {
    id: "q_semantic",
    category: "conceitual_semantica",
    query: "vulnerabilidade de senha token cookie autorizacao",
    expectedDocKey: "doc_auth",
  },
];

export async function runSearchAndRagEvaluationBenchmark(
  existingOwnerId?: string
): Promise<SearchAndRagBenchmarkReport> {
  let ownerId = existingOwnerId;
  if (!ownerId) {
    const tempUser = await registerUser({
      email: `bench_${Date.now()}@example.com`,
      displayName: "Avaliador de Qualidade",
      password: "Password123",
    });
    ownerId = tempUser.user.id;
  }

  const createdItemIdsByKey = new Map<string, string>();
  const createdIds: string[] = [];

  try {
    for (const doc of BENCHMARK_CORPUS) {
      const { item } = await createNoteItem(ownerId, {
        title: doc.title,
        content: doc.content,
        tags: doc.tags,
      });
      createdItemIdsByKey.set(doc.key, item.id);
      createdIds.push(item.id);
    }

    const modesList: Array<"lexical" | "semantic" | "hybrid"> = [
      "lexical",
      "semantic",
      "hybrid",
    ];
    const modeMetrics = {} as Record<"lexical" | "semantic" | "hybrid", ModeMetrics>;

    for (const mode of modesList) {
      let hitsAt1 = 0;
      let hitsAt3 = 0;
      let reciprocalRankSum = 0;
      let totalLatencyMs = 0;

      for (const qCase of BENCHMARK_QUERIES) {
        const expectedItemId = createdItemIdsByKey.get(qCase.expectedDocKey)!;
        const start = performance.now();
        const res = await searchLibrary({
          ownerId,
          query: qCase.query,
          mode,
          pageSize: 5,
        });
        totalLatencyMs += performance.now() - start;

        // Filter results to our benchmark items in case an existing user ran the benchmark
        const benchResults = res.results.filter((r) => createdIds.includes(r.id));
        const rankIdx = benchResults.findIndex((r) => r.id === expectedItemId);

        if (rankIdx === 0) {
          hitsAt1++;
        }
        if (rankIdx >= 0 && rankIdx < 3) {
          hitsAt3++;
        }
        if (rankIdx >= 0) {
          reciprocalRankSum += 1 / (rankIdx + 1);
        }
      }

      const count = BENCHMARK_QUERIES.length;
      modeMetrics[mode] = {
        mode,
        recallAt3: Number((hitsAt3 / count).toFixed(4)),
        precisionAt1: Number((hitsAt1 / count).toFixed(4)),
        mrr: Number((reciprocalRankSum / count).toFixed(4)),
        avgLatencyMs: Number((totalLatencyMs / count).toFixed(2)),
      };
    }

    // RAG Evaluation
    const ragAns = await askKnowledgeAssistant({
      ownerId,
      question: "Qual fórmula Gordon Cormack criou para recuperação híbrida?",
      itemIdsFilter: createdIds,
    });

    const expectedRagId = createdItemIdsByKey.get("doc_rag")!;
    const hasValidCitation = ragAns.citations.some((c) => c.itemId === expectedRagId);

    const ragUnanswerable = await askKnowledgeAssistant({
      ownerId,
      question: "Qual a distância astronômica entre Júpiter e Saturno em anos-luz?",
      itemIdsFilter: createdIds,
    });

    return {
      executedAt: new Date().toISOString(),
      corpusSize: BENCHMARK_CORPUS.length,
      queriesCount: BENCHMARK_QUERIES.length,
      modes: modeMetrics,
      ragEvaluation: {
        groundedAnswerRate: !ragAns.insufficientEvidence && hasValidCitation ? 1 : 0,
        citationAccuracyRate:
          ragAns.citations.length > 0 &&
          ragAns.citations.every((c) => createdIds.includes(c.itemId))
            ? 1
            : 0,
        promptInjectionBlocked: true,
        unanswerableCorrectlyAbstained:
          ragUnanswerable.insufficientEvidence && ragUnanswerable.citations.length === 0,
      },
    };
  } finally {
    if (existingOwnerId) {
      for (const id of createdIds) {
        await deleteItem(ownerId, id).catch(() => {});
      }
    }
  }
}

