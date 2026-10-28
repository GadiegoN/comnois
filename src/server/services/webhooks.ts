import crypto from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/db";
import { webhooks, webhookDeliveries } from "@/db/schema";
import {
  decryptSecret,
  encryptSecret,
  generateId,
  generateSecureToken,
  maskSecret,
} from "@/lib/security/crypto";
import { DnsResolverFn, validateSafeUrl } from "@/lib/security/ssrf";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export type WebhookEventType = "item.created" | "item.processed" | "item.deleted";

export function signWebhookPayload(secret: string, timestamp: string, rawBody: string): string {
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${hmac}`;
}

export async function createWebhook(
  input: {
    ownerId: string;
    name: string;
    targetUrl: string;
    events?: WebhookEventType[];
  },
  options?: { dnsResolver?: DnsResolverFn }
): Promise<{
  id: string;
  name: string;
  targetUrl: string;
  events: WebhookEventType[];
  signingSecret: string;
}> {
  const cleanName = input.name.trim();
  if (!cleanName) {
    throw new ValidationError("Informe um nome para o webhook.");
  }

  // Validate target URL against SSRF before saving
  const validatedUrl = await validateSafeUrl(input.targetUrl.trim(), {
    dnsResolver: options?.dnsResolver,
  });

  const events: WebhookEventType[] =
    input.events && input.events.length > 0
      ? input.events
      : ["item.created", "item.processed"];

  const rawSecret = `whsec_${generateSecureToken(24)}`;
  const secretEncrypted = encryptSecret(rawSecret);
  const id = generateId("whk");
  const db = await getDb();

  await db.insert(webhooks).values({
    id,
    ownerId: input.ownerId,
    name: cleanName,
    targetUrl: validatedUrl.toString(),
    secretEncrypted,
    events,
    isActive: true,
    failureCount: 0,
    createdAt: new Date(),
  });

  return {
    id,
    name: cleanName,
    targetUrl: validatedUrl.toString(),
    events,
    signingSecret: rawSecret,
  };
}

export async function listUserWebhooks(ownerId: string) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.ownerId, ownerId))
    .orderBy(desc(webhooks.createdAt));

  const deliveries = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.ownerId, ownerId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(20);

  return {
    webhooks: rows.map((w) => {
      const secret = decryptSecret(w.secretEncrypted);
      return {
        id: w.id,
        name: w.name,
        targetUrl: w.targetUrl,
        maskedSecret: maskSecret(secret),
        events: w.events,
        isActive: w.isActive,
        lastTriggeredAt: w.lastTriggeredAt,
        lastStatus: w.lastStatus,
        failureCount: w.failureCount,
        createdAt: w.createdAt,
      };
    }),
    recentDeliveries: deliveries,
  };
}

export async function deleteWebhook(ownerId: string, webhookId: string): Promise<void> {
  const db = await getDb();
  const [wh] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, webhookId))
    .limit(1);

  if (!wh) throw new NotFoundError("Webhook não encontrado.");
  if (wh.ownerId !== ownerId) throw new ForbiddenError("Acesso negado.");

  await db.delete(webhooks).where(eq(webhooks.id, webhookId));
}

export async function dispatchWebhookEvent(
  ownerId: string,
  event: WebhookEventType,
  data: Record<string, unknown>,
  options?: {
    dnsResolver?: DnsResolverFn;
    fetchImpl?: typeof fetch;
  }
): Promise<{ delivered: number; failed: number }> {
  const db = await getDb();
  const activeHooks = await db
    .select()
    .from(webhooks)
    .where(and(eq(webhooks.ownerId, ownerId), eq(webhooks.isActive, true)));

  const matchingHooks = activeHooks.filter((h) => h.events.includes(event));
  if (matchingHooks.length === 0) {
    return { delivered: 0, failed: 0 };
  }

  let delivered = 0;
  let failed = 0;
  const fetchFn = options?.fetchImpl ?? fetch;

  for (const hook of matchingHooks) {
    const timestamp = new Date().toISOString();
    const payloadObj = {
      id: generateId("evt"),
      event,
      timestamp,
      data,
    };
    const rawBody = JSON.stringify(payloadObj);
    const signingSecret = decryptSecret(hook.secretEncrypted);
    const signature = signWebhookPayload(signingSecret, timestamp, rawBody);

    let statusCode: number | null = null;
    let success = false;
    let errorMessage: string | null = null;

    try {
      // Re-validate SSRF right before sending HTTP request
      const safeTarget = await validateSafeUrl(hook.targetUrl, {
        dnsResolver: options?.dnsResolver,
      });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetchFn(safeTarget.toString(), {
          method: "POST",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "ComnoisWebhookDispatcher/1.0",
            "X-Comnois-Event": event,
            "X-Comnois-Signature": signature,
            "X-Comnois-Timestamp": timestamp,
          },
          body: rawBody,
        });

        statusCode = res.status;
        success = res.status >= 200 && res.status < 300;
        if (!success) {
          errorMessage = `Endpoint respondeu com HTTP ${res.status}`;
        }
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      errorMessage =
        err instanceof Error ? err.message.slice(0, 200) : "Falha de rede no webhook.";
    }

    await db.insert(webhookDeliveries).values({
      id: generateId("whd"),
      webhookId: hook.id,
      ownerId,
      event,
      payload: payloadObj,
      signature,
      statusCode,
      success,
      errorMessage,
      attempts: 1,
      createdAt: new Date(),
    });

    await db
      .update(webhooks)
      .set({
        lastTriggeredAt: new Date(),
        lastStatus: statusCode,
        failureCount: success ? 0 : hook.failureCount + 1,
      })
      .where(eq(webhooks.id, hook.id));

    if (success) {
      delivered++;
    } else {
      failed++;
      logger.warn("webhook.delivery_failed", {
        webhookId: hook.id,
        event,
        error: errorMessage,
      });
    }
  }

  return { delivered, failed };
}

