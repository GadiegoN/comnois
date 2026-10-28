import { eq, and, isNull, gt, desc } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  users,
  sessions,
  passwordResetTokens,
  workspaces,
  workspaceMembers,
  aiProviderConfigs,
  apiTokens,
  auditLogs,
  assets,
} from "@/db/schema";
import { getStorageProvider } from "@/server/storage";
import {
  generateId,
  generateSecureToken,
  hashPassword,
  verifyPassword,
  sha256Hex,
} from "@/lib/security/crypto";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  ValidationError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";

export const SESSION_COOKIE_NAME = "comnois_session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const RESET_TOKEN_DURATION_MS = 1000 * 60 * 30; // 30 minutes

export const registerSchema = z.object({
  email: z.string().trim().email("Formato de e-mail inválido.").max(255),
  displayName: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres.").max(100),
  password: z
    .string()
    .min(8, "A senha deve ter pelo menos 8 caracteres.")
    .max(128)
    .regex(/[A-Za-z]/, "A senha deve conter pelo menos uma letra.")
    .regex(/[0-9]/, "A senha deve conter pelo menos um número."),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Formato de e-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  aiEnabled: boolean;
  dailyTokenLimit: number;
  sessionId?: string;
  scopes?: string[];
}

export async function registerUser(
  input: z.infer<typeof registerSchema>,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<{ user: AuthenticatedUser; sessionToken: string; expiresAt: Date }> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.issues[0]?.message ?? "Dados de cadastro inválidos.");
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  enforceRateLimit(`register:${meta?.ipAddress ?? normalizedEmail}`, 10, 60_000);

  const db = await getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError("Não foi possível concluir o cadastro com o e-mail informado.");
  }

  const userId = generateId("usr");
  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();

  await db.insert(users).values({
    id: userId,
    email: normalizedEmail,
    displayName: parsed.data.displayName,
    passwordHash,
    status: "active",
    aiEnabled: true,
    dailyTokenLimit: 100000,
    createdAt: now,
    updatedAt: now,
  });

  // Create personal workspace
  const wsId = generateId("ws");
  await db.insert(workspaces).values({
    id: wsId,
    name: `Biblioteca de ${parsed.data.displayName}`,
    ownerId: userId,
    isPersonal: true,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(workspaceMembers).values({
    id: generateId("wsm"),
    workspaceId: wsId,
    userId,
    role: "owner",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  // Create default AI provider configuration
  await db.insert(aiProviderConfigs).values({
    id: generateId("aic"),
    ownerId: userId,
    provider: "extractive",
    chatModel: "extractive-grounded-v1",
    embeddingModel: "deterministic-semantic-v1",
    embeddingDimensions: 64,
    isEnabled: true,
    autoSummarize: true,
    autoSuggestTags: true,
    updatedAt: now,
  });

  const session = await createSessionForUser(userId, meta);
  logger.info("auth.user_registered", { userId });

  return {
    user: {
      id: userId,
      email: normalizedEmail,
      displayName: parsed.data.displayName,
      aiEnabled: true,
      dailyTokenLimit: 100000,
      sessionId: session.sessionId,
    },
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
  };
}

export async function loginUser(
  input: z.infer<typeof loginSchema>,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<{ user: AuthenticatedUser; sessionToken: string; expiresAt: Date }> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Credenciais inválidas.");
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  enforceRateLimit(`login:${meta?.ipAddress ?? normalizedEmail}`, 10, 60_000);

  const db = await getDb();
  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (!userRecord || userRecord.status !== "active") {
    throw new UnauthorizedError("E-mail ou senha inválidos.");
  }

  const valid = await verifyPassword(parsed.data.password, userRecord.passwordHash);
  if (!valid) {
    logger.warn("auth.login_failed", { userId: userRecord.id });
    throw new UnauthorizedError("E-mail ou senha inválidos.");
  }

  const session = await createSessionForUser(userRecord.id, meta);
  logger.info("auth.login_succeeded", { userId: userRecord.id });

  return {
    user: {
      id: userRecord.id,
      email: userRecord.email,
      displayName: userRecord.displayName,
      aiEnabled: userRecord.aiEnabled,
      dailyTokenLimit: userRecord.dailyTokenLimit,
      sessionId: session.sessionId,
    },
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
  };
}

export async function createSessionForUser(
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string; durationMs?: number }
): Promise<{ sessionId: string; sessionToken: string; expiresAt: Date }> {
  const db = await getDb();
  const sessionToken = generateSecureToken(32);
  const tokenHash = sha256Hex(sessionToken);
  const sessionId = generateId("ses");
  const expiresAt = new Date(Date.now() + (meta?.durationMs ?? SESSION_DURATION_MS));

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    tokenHash,
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
    expiresAt,
    createdAt: new Date(),
  });

  return { sessionId, sessionToken, expiresAt };
}

export async function verifySessionToken(
  rawToken: string | null | undefined
): Promise<AuthenticatedUser | null> {
  if (!rawToken || typeof rawToken !== "string") {
    return null;
  }

  const db = await getDb();
  const tokenHash = sha256Hex(rawToken);
  const now = new Date();

  const [sessionRecord] = await db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now)
      )
    )
    .limit(1);

  if (!sessionRecord) {
    return null;
  }

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionRecord.userId))
    .limit(1);

  if (!userRecord || userRecord.status !== "active") {
    return null;
  }

  return {
    id: userRecord.id,
    email: userRecord.email,
    displayName: userRecord.displayName,
    aiEnabled: userRecord.aiEnabled,
    dailyTokenLimit: userRecord.dailyTokenLimit,
    sessionId: sessionRecord.id,
  };
}

export async function verifyApiToken(
  rawApiToken: string | null | undefined
): Promise<AuthenticatedUser | null> {
  if (!rawApiToken || !rawApiToken.startsWith("cmn_")) {
    return null;
  }

  const db = await getDb();
  const tokenHash = sha256Hex(rawApiToken);
  const now = new Date();

  const [tokenRecord] = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, tokenHash), isNull(apiTokens.revokedAt)))
    .limit(1);

  if (!tokenRecord) {
    return null;
  }

  if (tokenRecord.expiresAt && tokenRecord.expiresAt <= now) {
    return null;
  }

  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.id, tokenRecord.ownerId))
    .limit(1);

  if (!userRecord || userRecord.status !== "active") {
    return null;
  }

  await db
    .update(apiTokens)
    .set({ lastUsedAt: now })
    .where(eq(apiTokens.id, tokenRecord.id));

  return {
    id: userRecord.id,
    email: userRecord.email,
    displayName: userRecord.displayName,
    aiEnabled: userRecord.aiEnabled,
    dailyTokenLimit: userRecord.dailyTokenLimit,
    scopes: tokenRecord.scopes,
  };
}

export async function revokeSessionToken(rawToken: string | null | undefined): Promise<void> {
  if (!rawToken) return;
  const db = await getDb();
  const tokenHash = sha256Hex(rawToken);
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.tokenHash, tokenHash));
}

export async function requestPasswordReset(
  email: string,
  meta?: { ipAddress?: string }
): Promise<{ resetToken?: string; expiresAt?: Date }> {
  const normalizedEmail = email.trim().toLowerCase();
  enforceRateLimit(`reset:${meta?.ipAddress ?? normalizedEmail}`, 5, 60_000);

  const db = await getDb();
  const [userRecord] = await db
    .select({ id: users.id, status: users.status })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  // Do not leak whether the account exists in public error messages
  if (!userRecord || userRecord.status !== "active") {
    return {};
  }

  const rawResetToken = generateSecureToken(32);
  const tokenHash = sha256Hex(rawResetToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_DURATION_MS);

  await db.insert(passwordResetTokens).values({
    id: generateId("prt"),
    userId: userRecord.id,
    tokenHash,
    expiresAt,
    createdAt: new Date(),
  });

  logger.info("auth.password_reset_requested", { userId: userRecord.id });
  return { resetToken: rawResetToken, expiresAt };
}

export async function confirmPasswordReset(input: {
  token: string;
  newPassword: string;
}): Promise<void> {
  const passwordCheck = registerSchema.shape.password.safeParse(input.newPassword);
  if (!passwordCheck.success) {
    throw new ValidationError(passwordCheck.error.issues[0]?.message ?? "Nova senha inválida.");
  }

  const db = await getDb();
  const tokenHash = sha256Hex(input.token.trim());
  const now = new Date();

  const [resetRecord] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.tokenHash, tokenHash))
    .limit(1);

  if (!resetRecord) {
    throw new ValidationError("Token de recuperação inválido ou expirado.");
  }

  if (resetRecord.usedAt !== null) {
    throw new ValidationError("Este token de recuperação já foi utilizado.");
  }

  if (resetRecord.expiresAt <= now) {
    throw new ValidationError("Este token de recuperação expirou.");
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  // Mark token as used (single-use enforcement)
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, resetRecord.id));

  // Update user password
  await db
    .update(users)
    .set({ passwordHash: newPasswordHash, updatedAt: now })
    .where(eq(users.id, resetRecord.userId));

  // Revoke all active sessions for security
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(eq(sessions.userId, resetRecord.userId));

  await db.insert(auditLogs).values({
    id: generateId("aud"),
    actorId: resetRecord.userId,
    action: "password_reset_completed",
    targetType: "user",
    targetId: resetRecord.userId,
    metadata: {},
  });
}

export async function createApiTokenForUser(
  userId: string,
  name: string,
  scopes: string[] = ["read", "write"]
): Promise<{ id: string; rawToken: string; tokenPrefix: string }> {
  if (!name.trim()) {
    throw new ValidationError("Informe um nome para o token de API.");
  }
  const db = await getDb();
  const rawRandom = generateSecureToken(24);
  const rawToken = `cmn_${rawRandom}`;
  const tokenPrefix = rawToken.slice(0, 10);
  const tokenHash = sha256Hex(rawToken);
  const id = generateId("tok");

  await db.insert(apiTokens).values({
    id,
    ownerId: userId,
    name: name.trim(),
    tokenPrefix,
    tokenHash,
    scopes,
    createdAt: new Date(),
  });

  return { id, rawToken, tokenPrefix };
}

export async function listApiTokensForUser(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      scopes: apiTokens.scopes,
      lastUsedAt: apiTokens.lastUsedAt,
      revokedAt: apiTokens.revokedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.ownerId, userId));
}

export async function revokeApiTokenForUser(userId: string, tokenId: string): Promise<void> {
  const db = await getDb();
  const [record] = await db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.id, tokenId))
    .limit(1);

  if (!record || record.ownerId !== userId) {
    throw new ForbiddenError("Você não tem permissão para revogar este token.");
  }

  await db
    .update(apiTokens)
    .set({ revokedAt: new Date() })
    .where(eq(apiTokens.id, tokenId));
}

export async function listUserSessions(userId: string) {
  const db = await getDb();
  return db
    .select({
      id: sessions.id,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      expiresAt: sessions.expiresAt,
      revokedAt: sessions.revokedAt,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(20);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function listUserAuditLogs(userId: string) {
  const db = await getDb();
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.actorId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(30);
}

/**
 * Exclusão integral de conta e dados (Direito de Exclusão LGPD/GDPR):
 * 1. Valida a senha do titular no servidor.
 * 2. Remove todos os arquivos físicos (blobs) do storage privado.
 * 3. Remove em cascata o usuário, sessões, itens, chunks, vetores, tags, coleções, webhooks, feeds e workspaces.
 */
export async function deleteUserAccountCompletely(input: {
  userId: string;
  passwordConfirmation: string;
}): Promise<{ deletedBlobsCount: number }> {
  const db = await getDb();
  const [userRecord] = await db
    .select()
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!userRecord) {
    throw new UnauthorizedError("Conta não encontrada.");
  }

  const validPassword = await verifyPassword(
    input.passwordConfirmation,
    userRecord.passwordHash
  );
  if (!validPassword) {
    throw new ForbiddenError("Senha de confirmação incorreta para exclusão da conta.");
  }

  const userAssets = await db
    .select()
    .from(assets)
    .where(eq(assets.ownerId, input.userId));

  const storage = getStorageProvider();
  let deletedBlobsCount = 0;
  for (const asset of userAssets) {
    try {
      await storage.deleteObject(asset.storageKey);
      deletedBlobsCount++;
    } catch {
      // Proceed even if blob was already absent
    }
  }

  await db.delete(users).where(eq(users.id, input.userId));
  logger.info("auth.account_deleted_completely", {
    userId: input.userId,
    deletedBlobsCount,
  });

  return { deletedBlobsCount };
}


