import { ValidationError } from "@/lib/errors";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref_src",
]);

export interface NormalizedUrlInfo {
  originalUrl: string;
  normalizedUrl: string;
  domain: string;
}

export function normalizeUrlForDeduplication(rawUrl: string): NormalizedUrlInfo {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new ValidationError("URL inválida.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError("Apenas protocolos HTTP e HTTPS são suportados.");
  }

  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (parsed.protocol === "http:" && parsed.port === "80") ||
    (parsed.protocol === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }

  // Remove hash fragment for canonical comparison
  parsed.hash = "";

  // Preserve meaningful query parameters, strip known tracking params, sort keys deterministically
  const keptParams: Array<[string, string]> = [];
  parsed.searchParams.forEach((value, key) => {
    if (!TRACKING_PARAMS.has(key.toLowerCase())) {
      keptParams.push([key, value]);
    }
  });

  keptParams.sort((a, b) => {
    if (a[0] === b[0]) return a[1].localeCompare(b[1]);
    return a[0].localeCompare(b[0]);
  });

  const newSearch = new URLSearchParams();
  for (const [k, v] of keptParams) {
    newSearch.append(k, v);
  }
  const searchStr = newSearch.toString();
  parsed.search = searchStr ? `?${searchStr}` : "";

  // Normalize trailing slash on non-root paths
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return {
    originalUrl: rawUrl.trim(),
    normalizedUrl: parsed.toString(),
    domain: parsed.hostname.replace(/^www\./, ""),
  };
}

