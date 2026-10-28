import { sha256Hex } from "@/lib/security/crypto";

export const CHUNKER_VERSION = "1.0.0";

export interface TextChunkDescriptor {
  chunkIndex: number;
  text: string;
  normalizedText: string;
  startOffset: number;
  endOffset: number;
  locator: string;
  textHash: string;
}

export function normalizeSearchText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface ChunkingOptions {
  maxChunkChars?: number;
  overlapChars?: number;
}

export function splitTextIntoChunks(
  rawText: string,
  options?: ChunkingOptions
): TextChunkDescriptor[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  const maxChunkChars = Math.max(120, options?.maxChunkChars ?? 700);
  const overlapChars = Math.max(0, Math.min(200, options?.overlapChars ?? 100));

  const cleaned = rawText.replace(/\r\n/g, "\n");
  const paragraphs: Array<{ text: string; start: number; end: number }> = [];

  const paragraphRegex = /[^\n]+(?:\n(?!\n)[^\n]+)*/g;
  let match: RegExpExecArray | null;
  while ((match = paragraphRegex.exec(cleaned)) !== null) {
    const segment = match[0];
    if (segment.trim().length > 0) {
      paragraphs.push({
        text: segment,
        start: match.index,
        end: match.index + segment.length,
      });
    }
  }

  if (paragraphs.length === 0) {
    return [];
  }

  const chunks: TextChunkDescriptor[] = [];
  let currentStart = paragraphs[0].start;
  let currentEnd = paragraphs[0].end;
  let currentParts: string[] = [];

  const flushChunk = (start: number, end: number, textContent: string) => {
    const trimmed = textContent.trim();
    if (!trimmed) return;
    const chunkIndex = chunks.length;
    const normalized = normalizeSearchText(trimmed);
    if (!normalized) return;
    chunks.push({
      chunkIndex,
      text: trimmed,
      normalizedText: normalized,
      startOffset: start,
      endOffset: end,
      locator: `trecho-${chunkIndex + 1} (chars ${start}–${end})`,
      textHash: sha256Hex(trimmed),
    });
  };

  for (const para of paragraphs) {
    // If a single paragraph is larger than maxChunkChars, split it along sentence boundaries
    if (para.text.length > maxChunkChars) {
      if (currentParts.length > 0) {
        flushChunk(currentStart, currentEnd, currentParts.join("\n\n"));
        currentParts = [];
      }

      let cursor = 0;
      while (cursor < para.text.length) {
        let sliceEnd = Math.min(para.text.length, cursor + maxChunkChars);
        if (sliceEnd < para.text.length) {
          // Try to break at sentence or word boundary
          const periodIdx = para.text.lastIndexOf(". ", sliceEnd);
          const spaceIdx = para.text.lastIndexOf(" ", sliceEnd);
          if (periodIdx > cursor + Math.floor(maxChunkChars * 0.5)) {
            sliceEnd = periodIdx + 1;
          } else if (spaceIdx > cursor + Math.floor(maxChunkChars * 0.5)) {
            sliceEnd = spaceIdx;
          }
        }
        const subText = para.text.slice(cursor, sliceEnd);
        flushChunk(para.start + cursor, para.start + sliceEnd, subText);
        if (sliceEnd >= para.text.length) break;
        cursor = Math.max(cursor + 1, sliceEnd - overlapChars);
      }
      continue;
    }

    const candidateText =
      currentParts.length === 0
        ? para.text
        : `${currentParts.join("\n\n")}\n\n${para.text}`;

    if (candidateText.length <= maxChunkChars) {
      if (currentParts.length === 0) {
        currentStart = para.start;
      }
      currentParts.push(para.text);
      currentEnd = para.end;
    } else {
      flushChunk(currentStart, currentEnd, currentParts.join("\n\n"));
      currentStart = para.start;
      currentEnd = para.end;
      currentParts = [para.text];
    }
  }

  if (currentParts.length > 0) {
    flushChunk(currentStart, currentEnd, currentParts.join("\n\n"));
  }

  return chunks;
}

