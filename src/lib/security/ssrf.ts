import dns from "dns/promises";
import net from "net";
import { ValidationError } from "@/lib/errors";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
  "metadata",
  "instance-data",
]);

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return -1;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidrV4(ipInt: number, baseIp: string, prefixLen: number): boolean {
  const baseInt = ipv4ToInt(baseIp);
  if (ipInt < 0 || baseInt < 0) return false;
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
  return (ipInt & mask) >>> 0 === (baseInt & mask) >>> 0;
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const trimmed = ip.trim().replace(/^\[|\]$/g, "");
  const version = net.isIP(trimmed);
  if (version === 0) {
    return true; // Invalid IP is treated as unsafe
  }

  if (version === 4) {
    const ipInt = ipv4ToInt(trimmed);
    if (ipInt < 0) return true;

    const blockedRanges: Array<[string, number]> = [
      ["0.0.0.0", 8], // Current network / unspecified
      ["10.0.0.0", 8], // Private class A
      ["100.64.0.0", 10], // Carrier-grade NAT
      ["127.0.0.0", 8], // Loopback
      ["169.254.0.0", 16], // Link-local & Cloud metadata (169.254.169.254)
      ["172.16.0.0", 12], // Private class B
      ["192.0.0.0", 24], // IETF protocol assignments
      ["192.0.2.0", 24], // TEST-NET-1
      ["192.168.0.0", 16], // Private class C
      ["198.18.0.0", 15], // Benchmarking
      ["198.51.100.0", 24], // TEST-NET-2
      ["203.0.113.0", 24], // TEST-NET-3
      ["224.0.0.0", 4], // Multicast
      ["240.0.0.0", 4], // Reserved
      ["255.255.255.255", 32], // Broadcast
    ];

    return blockedRanges.some(([base, prefix]) => inCidrV4(ipInt, base, prefix));
  }

  // IPv6 checks
  const lower = trimmed.toLowerCase();
  if (lower === "::1" || lower === "::" || lower === "0:0:0:0:0:0:0:1" || lower === "0:0:0:0:0:0:0:0") {
    return true;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice("::ffff:".length);
    if (net.isIPv4(mapped)) {
      return isPrivateOrReservedIp(mapped);
    }
    return true;
  }

  // Unique local (fc00::/7 -> fc.. or fd..)
  if (lower.startsWith("fc") || lower.startsWith("fd")) {
    return true;
  }

  // Link-local (fe80::/10 -> fe8., fe9., fea., feb.)
  if (/^fe[89ab][0-9a-f]:/.test(lower)) {
    return true;
  }

  // Multicast (ff00::/8)
  if (lower.startsWith("ff")) {
    return true;
  }

  return false;
}

export type DnsResolverFn = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const defaultDnsResolver: DnsResolverFn = async (hostname: string) => {
  return dns.lookup(hostname, { all: true, verbatim: true });
};

export async function validateSafeUrl(
  rawUrl: string,
  options?: { dnsResolver?: DnsResolverFn }
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ValidationError("URL inválida.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError(`Protocolo não permitido: ${parsed.protocol}`);
  }

  if (parsed.username || parsed.password) {
    throw new ValidationError("URLs com credenciais embutidas não são permitidas.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) {
    throw new ValidationError("Hostname ausente na URL.");
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new ValidationError("Destino de rede local ou interno bloqueado por política anti-SSRF.");
  }

  // Direct IP literal check
  if (net.isIP(hostname) !== 0) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new ValidationError("Endereço IP privado, loopback ou reservado bloqueado por política anti-SSRF.");
    }
    return parsed;
  }

  // Reject octal/hex/decimal integer IP encodings like http://2130706433 or http://0x7f.0.0.1
  if (/^(0x[0-9a-f]+|\d+)$/i.test(hostname)) {
    throw new ValidationError("Formato numérico de host bloqueado por segurança.");
  }

  const resolver = options?.dnsResolver ?? defaultDnsResolver;
  let records: Array<{ address: string; family: number }>;
  try {
    records = await resolver(hostname);
  } catch {
    throw new ValidationError(`Não foi possível resolver o DNS do domínio: ${hostname}`);
  }

  if (!records || records.length === 0) {
    throw new ValidationError(`Nenhum registro DNS encontrado para: ${hostname}`);
  }

  for (const record of records) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new ValidationError(
        `O domínio ${hostname} resolve para um endereço interno ou reservado bloqueado por proteção anti-SSRF.`
      );
    }
  }

  return parsed;
}

export interface SafeFetchOptions {
  maxRedirects?: number;
  timeoutMs?: number;
  maxBytes?: number;
  dnsResolver?: DnsResolverFn;
  fetchImpl?: typeof fetch;
}

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  contentType: string;
  bodyText: string;
}

export async function safeFetchUrl(
  initialUrl: string,
  options?: SafeFetchOptions
): Promise<SafeFetchResult> {
  const maxRedirects = options?.maxRedirects ?? 5;
  const timeoutMs = options?.timeoutMs ?? 12000;
  const maxBytes = options?.maxBytes ?? 2 * 1024 * 1024; // 2MB max HTML/text
  const fetchFn = options?.fetchImpl ?? fetch;

  let currentUrl = initialUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const validatedUrl = await validateSafeUrl(currentUrl, {
      dnsResolver: options?.dnsResolver,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetchFn(validatedUrl.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": "ComnoisKnowledgeBot/1.0 (+https://localhost; safe-extractor)",
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        },
      });
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (hop === maxRedirects) {
        throw new ValidationError("Número máximo de redirecionamentos excedido.");
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new ValidationError("Redirecionamento HTTP sem cabeçalho Location.");
      }
      const nextUrl = new URL(location, validatedUrl).toString();
      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok) {
      throw new Error(`Servidor remoto respondeu com HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "text/plain";
    const reader = response.body?.getReader();

    if (!reader) {
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > maxBytes) {
        throw new ValidationError("Conteúdo remoto excede o tamanho máximo permitido.");
      }
      return {
        finalUrl: validatedUrl.toString(),
        status: response.status,
        contentType,
        bodyText: text,
      };
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          await reader.cancel();
          throw new ValidationError("Conteúdo remoto excede o limite máximo de bytes permitido.");
        }
        chunks.push(value);
      }
    }

    const buffer = Buffer.concat(chunks);
    return {
      finalUrl: validatedUrl.toString(),
      status: response.status,
      contentType,
      bodyText: buffer.toString("utf8"),
    };
  }

  throw new ValidationError("Falha ao seguir redirecionamentos com segurança.");
}

