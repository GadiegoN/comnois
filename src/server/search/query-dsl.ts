import { normalizeSearchText } from "./chunker";

export interface ParsedSearchQueryDsl {
  cleanQuery: string;
  type?: "link" | "note" | "file" | "image";
  isFavorite?: boolean;
  isArchived?: boolean;
  processingStatus?: "pending" | "processing" | "completed" | "partial" | "failed" | "cancelled";
  domainContains?: string;
  tagNames: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Interpreta uma linguagem de consulta estruturada (DSL) inspirada em clientes avançados
 * (ex: `is:fav type:link site:github.com #arquitetura after:2026-01-01 postgres`).
 */
export function parseSearchQueryDsl(rawQuery: string): ParsedSearchQueryDsl {
  const tokens = rawQuery.trim().split(/\s+/).filter(Boolean);
  const remainingWords: string[] = [];

  let type: ParsedSearchQueryDsl["type"];
  let isFavorite: boolean | undefined;
  let isArchived: boolean | undefined;
  let processingStatus: ParsedSearchQueryDsl["processingStatus"];
  let domainContains: string | undefined;
  const tagNames: string[] = [];
  let dateFrom: Date | undefined;
  let dateTo: Date | undefined;

  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (lower === "is:fav" || lower === "is:favorite" || lower === "is:starred") {
      isFavorite = true;
      continue;
    }
    if (lower === "-is:fav" || lower === "-is:favorite") {
      isFavorite = false;
      continue;
    }
    if (lower === "is:archived") {
      isArchived = true;
      continue;
    }
    if (lower === "-is:archived") {
      isArchived = false;
      continue;
    }

    if (lower.startsWith("type:")) {
      const val = lower.slice(5);
      if (val === "link" || val === "note" || val === "file" || val === "image") {
        type = val;
        continue;
      }
      if (val === "pdf") {
        type = "file";
        continue;
      }
    }

    if (lower.startsWith("status:")) {
      const val = lower.slice(7);
      if (
        val === "pending" ||
        val === "processing" ||
        val === "completed" ||
        val === "partial" ||
        val === "failed" ||
        val === "cancelled"
      ) {
        processingStatus = val;
        continue;
      }
    }

    if (lower.startsWith("site:") || lower.startsWith("domain:")) {
      const val = lower.includes("site:") ? lower.slice(5) : lower.slice(7);
      if (val) {
        domainContains = val;
        continue;
      }
    }

    if (lower.startsWith("tag:")) {
      const val = normalizeSearchText(token.slice(4));
      if (val) {
        tagNames.push(val);
        continue;
      }
    }

    if (token.startsWith("#") && token.length > 1) {
      const val = normalizeSearchText(token.slice(1));
      if (val) {
        tagNames.push(val);
        continue;
      }
    }

    if (lower.startsWith("after:")) {
      const d = new Date(token.slice(6));
      if (!Number.isNaN(d.getTime())) {
        dateFrom = d;
        continue;
      }
    }

    if (lower.startsWith("before:")) {
      const d = new Date(token.slice(7));
      if (!Number.isNaN(d.getTime())) {
        dateTo = d;
        continue;
      }
    }

    remainingWords.push(token);
  }

  return {
    cleanQuery: remainingWords.join(" ").trim(),
    type,
    isFavorite,
    isArchived,
    processingStatus,
    domainContains,
    tagNames,
    dateFrom,
    dateTo,
  };
}

