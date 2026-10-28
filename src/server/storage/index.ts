import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { getEnv } from "@/lib/env";
import { generateId, sha256Hex } from "@/lib/security/crypto";
import { ValidationError, NotFoundError, ExternalServiceError } from "@/lib/errors";

export interface StoredFileMetadata {
  storageKey: string;
  storageDriver: "local" | "s3";
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
}

export interface StorageProvider {
  putObject(input: {
    ownerId: string;
    originalFileName: string;
    declaredMimeType?: string;
    buffer: Buffer;
  }): Promise<StoredFileMetadata>;
  getObject(storageKey: string): Promise<Buffer>;
  deleteObject(storageKey: string): Promise<void>;
}

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  ".pdf": ["application/pdf"],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/plain"],
  ".csv": ["text/csv", "text/plain"],
  ".json": ["application/json", "text/plain"],
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".webp": ["image/webp"],
};

export function sanitizeFileName(rawName: string): string {
  const base = path.basename(rawName.replace(/\\/g, "/")).trim();
  const cleaned = base.replace(/[^a-zA-Z0-9._\-\s]/g, "_").replace(/\s+/g, "_");
  return cleaned.slice(0, 140) || "arquivo";
}

export function detectAndValidateFileType(
  fileName: string,
  buffer: Buffer,
  declaredMime?: string
): { mimeType: string; ext: string; itemType: "file" | "image" } {
  const sanitized = sanitizeFileName(fileName);
  const ext = path.extname(sanitized).toLowerCase();

  if (!ALLOWED_EXTENSIONS[ext]) {
    throw new ValidationError(
      `Formato de arquivo não permitido (${ext || "sem extensão"}). Formatos aceitos: PDF, TXT, MD, CSV, JSON, PNG, JPG, WEBP.`
    );
  }

  // Magic byte verification for binary formats
  if (ext === ".pdf") {
    const header = buffer.subarray(0, 5).toString("ascii");
    if (header !== "%PDF-") {
      throw new ValidationError("Assinatura binária inválida para arquivo PDF.");
    }
    return { mimeType: "application/pdf", ext, itemType: "file" };
  }

  if (ext === ".png") {
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    if (buffer.length < 8 || !buffer.subarray(0, 4).equals(pngMagic)) {
      throw new ValidationError("Assinatura binária inválida para imagem PNG.");
    }
    return { mimeType: "image/png", ext, itemType: "image" };
  }

  if (ext === ".jpg" || ext === ".jpeg") {
    if (buffer.length < 3 || buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw new ValidationError("Assinatura binária inválida para imagem JPEG.");
    }
    return { mimeType: "image/jpeg", ext, itemType: "image" };
  }

  if (ext === ".webp") {
    const riff = buffer.subarray(0, 4).toString("ascii");
    const webp = buffer.subarray(8, 12).toString("ascii");
    if (buffer.length < 12 || riff !== "RIFF" || webp !== "WEBP") {
      throw new ValidationError("Assinatura binária inválida para imagem WEBP.");
    }
    return { mimeType: "image/webp", ext, itemType: "image" };
  }

  // Text-based formats (.txt, .md, .csv, .json) - check that it's not a disguised ELF/PE binary
  if (
    buffer.length >= 2 &&
    ((buffer[0] === 0x4d && buffer[1] === 0x5a) || // MZ (Windows PE)
      (buffer[0] === 0x7f && buffer[1] === 0x45)) // ELF
  ) {
    throw new ValidationError("Conteúdo executável bloqueado por segurança.");
  }

  const allowedMimes = ALLOWED_EXTENSIONS[ext];
  const resolvedMime =
    declaredMime && allowedMimes.includes(declaredMime) ? declaredMime : allowedMimes[0];

  return {
    mimeType: resolvedMime,
    ext,
    itemType: "file",
  };
}

export class LocalFilesystemStorage implements StorageProvider {
  private readonly rootDir: string;
  private readonly maxBytes: number;

  constructor(rootDir?: string, maxBytes?: number) {
    const env = getEnv();
    const rawRoot = rootDir ?? env.STORAGE_LOCAL_PATH;
    this.rootDir = path.isAbsolute(rawRoot) ? rawRoot : path.resolve(process.cwd(), rawRoot);
    this.maxBytes = maxBytes ?? env.MAX_UPLOAD_BYTES;
  }

  private resolveSafePath(storageKey: string): string {
    const normalizedKey = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
    if (normalizedKey.includes("..")) {
      throw new ValidationError("Chave de armazenamento inválida.");
    }
    const resolved = path.resolve(this.rootDir, normalizedKey);
    const relative = path.relative(this.rootDir, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new ValidationError("Tentativa de path traversal bloqueada.");
    }
    return resolved;
  }

  async putObject(input: {
    ownerId: string;
    originalFileName: string;
    declaredMimeType?: string;
    buffer: Buffer;
  }): Promise<StoredFileMetadata> {
    if (!input.buffer || input.buffer.length === 0) {
      throw new ValidationError("Arquivo vazio não é permitido.");
    }

    if (input.buffer.length > this.maxBytes) {
      throw new ValidationError(
        `O arquivo excede o tamanho máximo permitido (${Math.round(this.maxBytes / 1024 / 1024)}MB).`
      );
    }

    const sanitizedName = sanitizeFileName(input.originalFileName);
    const { mimeType, ext } = detectAndValidateFileType(
      sanitizedName,
      input.buffer,
      input.declaredMimeType
    );

    const sha256Hash = sha256Hex(input.buffer);
    const safeOwner = input.ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueFile = `${generateId("blob")}${ext}`;
    const storageKey = `${safeOwner}/${uniqueFile}`;
    const fullPath = this.resolveSafePath(storageKey);

    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.buffer);

    return {
      storageKey,
      storageDriver: "local",
      originalFileName: sanitizedName,
      mimeType,
      sizeBytes: input.buffer.length,
      sha256Hash,
    };
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const fullPath = this.resolveSafePath(storageKey);
    try {
      return await fs.readFile(fullPath);
    } catch {
      throw new NotFoundError("Arquivo binário não encontrado no armazenamento privado.");
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    const fullPath = this.resolveSafePath(storageKey);
    try {
      await fs.unlink(fullPath);
    } catch {
      // Idempotent delete if file already removed
    }
  }
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac("sha256", key).update(data, "utf8").digest();
}

export function buildAwsSigV4Headers(input: {
  method: "PUT" | "GET" | "DELETE";
  url: URL;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  payloadHash: string;
  contentType?: string;
  now?: Date;
}): Record<string, string> {
  const now = input.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host: input.url.host,
    "x-amz-content-sha256": input.payloadHash,
    "x-amz-date": amzDate,
  };
  if (input.contentType) {
    headers["content-type"] = input.contentType;
  }

  const sortedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((k) => `${k}:${headers[k].trim()}\n`)
    .join("");
  const signedHeaders = sortedHeaderKeys.join(";");

  const canonicalRequest = [
    input.method,
    input.url.pathname,
    input.url.search.replace(/^\?/, ""),
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${input.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${input.secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, input.region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = crypto
    .createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex");

  return {
    "x-amz-date": amzDate,
    "x-amz-content-sha256": input.payloadHash,
    ...(input.contentType ? { "Content-Type": input.contentType } : {}),
    Authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export class S3CompatibleStorage implements StorageProvider {
  private readonly endpoint: string;
  private readonly region: string;
  private readonly bucket: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly maxBytes: number;
  private readonly fetchFn: typeof fetch;

  constructor(config?: {
    endpoint?: string;
    region?: string;
    bucket?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    maxBytes?: number;
    fetchImpl?: typeof fetch;
  }) {
    const env = getEnv();
    this.endpoint = (config?.endpoint ?? env.S3_ENDPOINT).replace(/\/+$/, "");
    this.region = config?.region ?? (env.S3_REGION || "us-east-1");
    this.bucket = config?.bucket ?? env.S3_BUCKET;
    this.accessKeyId = config?.accessKeyId ?? env.S3_ACCESS_KEY_ID;
    this.secretAccessKey = config?.secretAccessKey ?? env.S3_SECRET_ACCESS_KEY;
    this.maxBytes = config?.maxBytes ?? env.MAX_UPLOAD_BYTES;
    this.fetchFn = config?.fetchImpl ?? fetch;
  }

  private resolveObjectUrl(storageKey: string): URL {
    if (!this.endpoint || !this.bucket || !this.accessKeyId || !this.secretAccessKey) {
      throw new ExternalServiceError(
        "Configuração do armazenamento S3 incompleta (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)."
      );
    }
    const cleanKey = storageKey.replace(/^\/+/, "");
    if (cleanKey.includes("..")) {
      throw new ValidationError("Chave de armazenamento S3 inválida.");
    }
    return new URL(`${this.endpoint}/${this.bucket}/${cleanKey}`);
  }

  async putObject(input: {
    ownerId: string;
    originalFileName: string;
    declaredMimeType?: string;
    buffer: Buffer;
  }): Promise<StoredFileMetadata> {
    if (!input.buffer || input.buffer.length === 0) {
      throw new ValidationError("Arquivo vazio não é permitido.");
    }
    if (input.buffer.length > this.maxBytes) {
      throw new ValidationError(
        `O arquivo excede o tamanho máximo permitido (${Math.round(this.maxBytes / 1024 / 1024)}MB).`
      );
    }

    const sanitizedName = sanitizeFileName(input.originalFileName);
    const { mimeType, ext } = detectAndValidateFileType(
      sanitizedName,
      input.buffer,
      input.declaredMimeType
    );

    const sha256Hash = sha256Hex(input.buffer);
    const safeOwner = input.ownerId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const storageKey = `${safeOwner}/${generateId("blob")}${ext}`;
    const url = this.resolveObjectUrl(storageKey);

    const headers = buildAwsSigV4Headers({
      method: "PUT",
      url,
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      payloadHash: sha256Hash,
      contentType: mimeType,
    });

    const res = await this.fetchFn(url.toString(), {
      method: "PUT",
      headers,
      body: new Uint8Array(input.buffer),
    });

    if (!res.ok) {
      throw new ExternalServiceError(`Falha ao gravar objeto no S3 (HTTP ${res.status}).`);
    }

    return {
      storageKey,
      storageDriver: "s3",
      originalFileName: sanitizedName,
      mimeType,
      sizeBytes: input.buffer.length,
      sha256Hash,
    };
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const url = this.resolveObjectUrl(storageKey);
    const emptyHash = sha256Hex("");
    const headers = buildAwsSigV4Headers({
      method: "GET",
      url,
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      payloadHash: emptyHash,
    });

    const res = await this.fetchFn(url.toString(), {
      method: "GET",
      headers,
    });

    if (res.status === 404) {
      throw new NotFoundError("Arquivo não encontrado no armazenamento S3.");
    }
    if (!res.ok) {
      throw new ExternalServiceError(`Falha ao ler objeto do S3 (HTTP ${res.status}).`);
    }

    const arrBuf = await res.arrayBuffer();
    return Buffer.from(arrBuf);
  }

  async deleteObject(storageKey: string): Promise<void> {
    const url = this.resolveObjectUrl(storageKey);
    const emptyHash = sha256Hex("");
    const headers = buildAwsSigV4Headers({
      method: "DELETE",
      url,
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      payloadHash: emptyHash,
    });

    await this.fetchFn(url.toString(), {
      method: "DELETE",
      headers,
    }).catch(() => {});
  }
}

let storageInstance: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  const env = getEnv();
  if (env.STORAGE_DRIVER === "s3") {
    return new S3CompatibleStorage();
  }
  if (!storageInstance) {
    storageInstance = new LocalFilesystemStorage();
  }
  return storageInstance;
}

