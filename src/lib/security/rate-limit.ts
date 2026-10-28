import { RateLimitError } from "@/lib/errors";

interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const windowStart = now - windowMs;
  const bucket = buckets.get(key) ?? { timestamps: [] };

  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterMs = Math.max(100, oldest + windowMs - now);
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - bucket.timestamps.length),
    retryAfterMs: 0,
  };
}

export function enforceRateLimit(key: string, maxRequests: number, windowMs: number): void {
  const result = checkRateLimit(key, maxRequests, windowMs);
  if (!result.allowed) {
    throw new RateLimitError(
      `Limite de requisições excedido. Tente novamente em ${Math.ceil(result.retryAfterMs / 1000)}s.`
    );
  }
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
}

