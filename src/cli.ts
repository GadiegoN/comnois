import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { items, users } from "@/db/schema";
import { registerUser } from "@/server/services/auth";
import { createLinkItem, createNoteItem, updateItem } from "@/server/services/items";
import { createCollection, listUserCollections } from "@/server/services/organization";
import { searchLibrary } from "@/server/search";
import { askKnowledgeAssistant } from "@/server/ai/assistant";
import { getSystemHealthAndBackupIntegrity } from "@/server/services/observability";
import { runSearchAndRagEvaluationBenchmark } from "@/server/search/evaluator";
import {
  exportLibraryAsCsv,
  exportLibraryAsNetscapeHtml,
  exportUserLibrary,
} from "@/server/services/portability";

async function resolveDefaultCliUserId(): Promise<string> {
  const db = await getDb();
  const [firstUser] = await db.select().from(users).limit(1);
  if (firstUser) {
    return firstUser.id;
  }
  const created = await registerUser({
    email: "cli@comnois.local",
    displayName: "Comnois CLI Operator",
    password: "Password123",
  });
  return created.user.id;
}

export async function runCliCommand(argv: string[]): Promise<string> {
  const [command = "help", ...rest] = argv;

  if (command === "help" || command === "--help" || command === "-h") {
    return [
      "Comnois Knowledge Platform — CLI Oficial",
      "",
      "Comandos disponíveis:",
      '  pnpm cli ingest-docs [dir]            Importa e indexa os documentos Markdown de docs/ no acervo',
      '  pnpm cli search "<query-ou-dsl>"      Pesquisa itens (suporta is:fav, type:link, site:..., #tag)',
      '  pnpm cli add-link <url> "[titulo]"    Salva um link na biblioteca e enfileira extração',
      '  pnpm cli add-note "<titulo>" "<txt>"  Cria e indexa uma nota imediatamente (suporta #tags e is:fav)',
      '  pnpm cli ask "<pergunta>"             Consulta o Assistente RAG com citações verificadas',
      "  pnpm cli export [json|html|csv]       Exporta a biblioteca no formato desejado",
      "  pnpm cli health                       Exibe diagnóstico de banco, fila e integridade de blobs",
      "  pnpm cli benchmark                    Executa o benchmark quantitativo de Busca & RAG",
    ].join("\n");
  }

  const userId = await resolveDefaultCliUserId();

  if (command === "ingest-docs") {
    const targetDir = path.resolve(process.cwd(), rest[0] || "docs");
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Diretório não encontrado: ${targetDir}`);
    }

    const collectMarkdownFiles = (dir: string): string[] => {
      const results: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...collectMarkdownFiles(full));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
          results.push(full);
        }
      }
      return results.sort();
    };

    const files = collectMarkdownFiles(targetDir);

    const db = await getDb();
    const existingItems = await db
      .select({ id: items.id, title: items.title })
      .from(items)
      .where(eq(items.ownerId, userId));
    const existingTitles = new Set(existingItems.map((i) => i.title.toLowerCase()));

    const existingCols = await listUserCollections(userId);
    const foundCol = existingCols.find(
      (c) => c.name.toLowerCase() === "documentação oficial comnois"
    );
    const docsCollection =
      foundCol ??
      (await createCollection({
        ownerId: userId,
        name: "Documentação Oficial Comnois",
        description: "Especificações arquiteturais, segurança, RAG, busca híbrida e requisitos do produto.",
      }));
    if (!docsCollection) {
      throw new Error("Não foi possível criar ou localizar a coleção de documentação.");
    }

    let importedCount = 0;
    let skippedCount = 0;
    const importedTitles: string[] = [];

    for (const fullPath of files) {
      const fileName = path.basename(fullPath);
      const relPath = path.relative(targetDir, fullPath).replace(/\\/g, "/");
      const rawMarkdown = fs.readFileSync(fullPath, "utf8").trim();
      if (!rawMarkdown) continue;

      const firstHeading = rawMarkdown
        .split("\n")
        .find((line) => line.trim().startsWith("#"))
        ?.replace(/^#+\s*/, "")
        .trim();
      const title = firstHeading ? `${relPath} — ${firstHeading}` : relPath;

      const isCoreFavorite =
        relPath.includes("03-arquitetura") ||
        relPath.includes("04-ia-e-recuperacao") ||
        fileName.includes("STATUS-IMPLEMENTACAO");

      const existingItem = existingItems.find(
        (i) => i.title.toLowerCase() === title.toLowerCase()
      );
      if (existingItem) {
        if (isCoreFavorite) {
          await updateItem(userId, existingItem.id, { isFavorite: true });
        }
        skippedCount++;
        continue;
      }

      const lowerContent = `${relPath} ${rawMarkdown}`.toLowerCase();
      const autoTags = new Set<string>(["documentacao"]);
      if (lowerContent.includes("arquitetura") || relPath.includes("arquitetura")) {
        autoTags.add("arquitetura");
      }
      if (lowerContent.includes("rag") || lowerContent.includes("assistente") || lowerContent.includes("ia")) {
        autoTags.add("rag");
        autoTags.add("ia");
      }
      if (lowerContent.includes("segurança") || lowerContent.includes("seguranca") || lowerContent.includes("ssrf")) {
        autoTags.add("seguranca");
      }
      if (lowerContent.includes("pesquisa") || lowerContent.includes("híbrida") || lowerContent.includes("semântica")) {
        autoTags.add("pesquisa");
      }
      if (lowerContent.includes("banco") || lowerContent.includes("modelo-de-dados")) {
        autoTags.add("banco-de-dados");
      }

      const created = await createNoteItem(userId, {
        title,
        content: rawMarkdown,
        tags: Array.from(autoTags),
        collectionId: docsCollection.id,
      });

      if (isCoreFavorite) {
        await updateItem(userId, created.item.id, { isFavorite: true });
      }

      importedCount++;
      importedTitles.push(title);
    }

    return JSON.stringify(
      {
        status: "completed",
        directory: targetDir,
        collection: docsCollection.name,
        importedCount,
        skippedCount,
        importedTitles,
      },
      null,
      2
    );
  }

  if (command === "search") {
    const query = rest.join(" ").trim();
    const res = await searchLibrary({
      ownerId: userId,
      query,
      mode: "hybrid",
    });
    return JSON.stringify(
      {
        total: res.total,
        effectiveMode: res.effectiveMode,
        results: res.results.map((r) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          url: r.originalUrl,
          score: r.score,
        })),
      },
      null,
      2
    );
  }

  if (command === "add-link") {
    const [url, title, ...extra] = rest;
    if (!url) {
      throw new Error("Uso: pnpm cli add-link <url> [titulo] [#tags]");
    }
    const tags = extra
      .filter((t) => t.startsWith("#"))
      .map((t) => t.slice(1).toLowerCase())
      .filter(Boolean);
    const created = await createLinkItem(userId, { url, title, tags });
    if (extra.includes("--fav") || extra.includes("is:fav")) {
      await updateItem(userId, created.item.id, { isFavorite: true });
    }
    return JSON.stringify({ item: created.item, jobId: created.jobId }, null, 2);
  }

  if (command === "add-note") {
    const [title, ...contentParts] = rest;
    const tags = contentParts
      .filter((t) => t.startsWith("#"))
      .map((t) => t.slice(1).toLowerCase())
      .filter(Boolean);
    const isFav = contentParts.includes("--fav") || contentParts.includes("is:fav");
    const cleanParts = contentParts.filter(
      (t) => !t.startsWith("#") && t !== "--fav" && t !== "is:fav"
    );
    const content = cleanParts.join(" ").trim() || title;
    if (!content) {
      throw new Error('Uso: pnpm cli add-note "<titulo>" "<conteudo>" [#tags] [--fav]');
    }
    const created = await createNoteItem(userId, { title, content, tags });
    if (isFav) {
      await updateItem(userId, created.item.id, { isFavorite: true });
    }
    return JSON.stringify({ item: created.item }, null, 2);
  }

  if (command === "ask") {
    const question = rest.join(" ").trim();
    if (!question) {
      throw new Error('Uso: pnpm cli ask "<pergunta>"');
    }
    const ans = await askKnowledgeAssistant({ ownerId: userId, question });
    return JSON.stringify(ans, null, 2);
  }

  if (command === "export") {
    const fmt = (rest[0] || "json").toLowerCase();
    const bundle = await exportUserLibrary(userId);
    if (fmt === "html" || fmt === "netscape_html") {
      return exportLibraryAsNetscapeHtml(bundle);
    }
    if (fmt === "csv") {
      return exportLibraryAsCsv(bundle);
    }
    return JSON.stringify(bundle, null, 2);
  }

  if (command === "health") {
    const health = await getSystemHealthAndBackupIntegrity(userId);
    return JSON.stringify(health, null, 2);
  }

  if (command === "benchmark") {
    const report = await runSearchAndRagEvaluationBenchmark(userId);
    return JSON.stringify(report, null, 2);
  }

  throw new Error(`Comando desconhecido: ${command}. Use "pnpm cli help".`);
}

if (process.argv[1]?.endsWith("cli.ts")) {
  runCliCommand(process.argv.slice(2))
    .then((output) => {
      process.stdout.write(output + "\n");
      process.exit(0);
    })
    .catch((err) => {
      process.stderr.write(
        `Erro CLI: ${err instanceof Error ? err.message : String(err)}\n`
      );
      process.exit(1);
    });
}

