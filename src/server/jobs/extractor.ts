import * as cheerio from "cheerio";
import { safeFetchUrl, SafeFetchOptions } from "@/lib/security/ssrf";
import { sanitizeHtmlContent } from "@/lib/security/sanitize";

export const EXTRACTOR_VERSION = "1.0.0";

export interface ExtractedWebPage {
  title: string;
  description: string;
  extractedText: string;
  sanitizedHtml: string;
  language: string;
  metadata: Record<string, unknown>;
}

export function extractFromHtml(rawHtml: string, fallbackTitle: string): ExtractedWebPage {
  const $ = cheerio.load(rawHtml);

  const pageTitle =
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("title").first().text().trim() ||
    $("h1").first().text().trim() ||
    fallbackTitle;

  const description =
    $("meta[name='description']").attr("content")?.trim() ||
    $("meta[property='og:description']").attr("content")?.trim() ||
    "";

  const langAttr = $("html").attr("lang")?.trim() || "pt";
  const author =
    $("meta[name='author']").attr("content")?.trim() ||
    $("meta[property='article:author']").attr("content")?.trim() ||
    undefined;

  // Remove noise elements before extracting readable body text
  $("script, style, noscript, iframe, nav, footer, header, aside, form, svg").remove();

  const mainContainer =
    $("article").first().length > 0
      ? $("article").first()
      : $("main").first().length > 0
        ? $("main").first()
        : $("body");

  const blocks: string[] = [];
  mainContainer.find("h1, h2, h3, h4, p, li, blockquote, pre").each((_, el) => {
    const txt = $(el).text().replace(/\s+/g, " ").trim();
    if (txt.length > 0) {
      blocks.push(txt);
    }
  });

  const extractedText =
    blocks.length > 0
      ? blocks.join("\n\n")
      : mainContainer.text().replace(/\s+/g, " ").trim();

  const sanitizedHtml = sanitizeHtmlContent(mainContainer.html() ?? "");

  return {
    title: pageTitle.slice(0, 300),
    description: description.slice(0, 600),
    extractedText: extractedText.slice(0, 200_000),
    sanitizedHtml: sanitizedHtml.slice(0, 250_000),
    language: langAttr.slice(0, 10),
    metadata: {
      ...(author ? { author } : {}),
      extractedAt: new Date().toISOString(),
    },
  };
}

export async function fetchAndExtractWebPage(
  url: string,
  fetchOptions?: SafeFetchOptions
): Promise<ExtractedWebPage> {
  const res = await safeFetchUrl(url, fetchOptions);
  if (res.contentType.includes("text/plain")) {
    const cleanText = res.bodyText.slice(0, 200_000).trim();
    return {
      title: url,
      description: cleanText.slice(0, 240),
      extractedText: cleanText,
      sanitizedHtml: "",
      language: "pt",
      metadata: {
        finalUrl: res.finalUrl,
        contentType: res.contentType,
      },
    };
  }
  return extractFromHtml(res.bodyText, url);
}

export function extractTextFromPdfBuffer(buffer: Buffer): string {
  // Deterministic extraction of readable text strings inside PDF content streams
  const raw = buffer.toString("latin1");
  const pieces: string[] = [];

  // Extract parenthesized literal strings in PDF text blocks: (Hello World) Tj / TJ
  const literalRegex = /\(([^()\\]*(?:\\.[^()\\]*)*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = literalRegex.exec(raw)) !== null) {
    const decoded = match[1]
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, " ")
      .replace(/\\t/g, " ")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")")
      .replace(/\\\\/g, "\\");

    // Keep printable ASCII/Latin-1 text segments
    const printable = decoded.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "").trim();
    if (printable.length >= 2 && /[A-Za-zÀ-ÿ0-9]/.test(printable)) {
      pieces.push(printable);
    }
  }

  return pieces.join(" ").replace(/\s+/g, " ").trim();
}

