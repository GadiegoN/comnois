import crypto from "crypto";
import { getEnv } from "@/lib/env";

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

export function generateId(prefix?: string): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
      },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });
  return `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELIZATION}$${salt}$${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") {
      return false;
    }
    const cost = Number(parts[1]);
    const blockSize = Number(parts[2]);
    const parallelization = Number(parts[3]);
    const salt = parts[4];
    const expectedHex = parts[5];

    if (!salt || !expectedHex || !Number.isFinite(cost)) {
      return false;
    }

    const expectedBuffer = Buffer.from(expectedHex, "hex");
    const derivedKey = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(
        password,
        salt,
        expectedBuffer.length,
        {
          N: cost,
          r: blockSize,
          p: parallelization,
        },
        (err, key) => {
          if (err) reject(err);
          else resolve(key);
        }
      );
    });

    if (derivedKey.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(derivedKey, expectedBuffer);
  } catch {
    return false;
  }
}

function getMasterKey(): Buffer {
  const secret = getEnv().AUTH_SECRET;
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";
  const parts = cipherText.split(".");
  if (parts.length !== 3) {
    throw new Error("Formato de segredo criptografado inválido");
  }
  const iv = Buffer.from(parts[0], "base64url");
  const tag = Buffer.from(parts[1], "base64url");
  const encrypted = Buffer.from(parts[2], "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getMasterKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function maskSecret(secret: string | null | undefined): string {
  if (!secret || secret.length < 6) return "";
  return `${secret.slice(0, 3)}••••••••${secret.slice(-3)}`;
}

