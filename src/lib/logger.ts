const SENSITIVE_KEYS = [
  "password",
  "passwordhash",
  "senha",
  "token",
  "accesstoken",
  "refreshtoken",
  "sessiontoken",
  "apikey",
  "api_key",
  "secret",
  "authorization",
  "cookie",
  "set-cookie",
  "privatekey",
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[-_]/g, "");
  return SENSITIVE_KEYS.some((s) => lower.includes(s));
}

export function redactSensitiveData(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[MAX_DEPTH]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    // Redact Bearer tokens or sk- API keys if accidentally passed in strings
    return value
      .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
      .replace(/\bsk-[A-Za-z0-9\-_]{12,}\b/g, "sk-[REDACTED]");
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSensitiveKey(k)) {
        result[k] = "[REDACTED]";
      } else {
        result[k] = redactSensitiveData(v, depth + 1);
      }
    }
    return result;
  }

  return value;
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  correlationId?: string;
  data?: Record<string, unknown>;
}

const recentLogs: LogEntry[] = [];
const MAX_RECENT_LOGS = 200;

export const logger = {
  log(level: LogLevel, event: string, data?: Record<string, unknown>, correlationId?: string) {
    const safeData = data
      ? (redactSensitiveData(data) as Record<string, unknown>)
      : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...(correlationId ? { correlationId } : {}),
      ...(safeData ? { data: safeData } : {}),
    };

    recentLogs.push(entry);
    if (recentLogs.length > MAX_RECENT_LOGS) {
      recentLogs.shift();
    }

    if (process.env.NODE_ENV !== "test" || process.env.DEBUG_LOGS === "1") {
      const serialized = JSON.stringify(entry);
      if (level === "error") {
        console.error(serialized);
      } else if (level === "warn") {
        console.warn(serialized);
      } else {
        console.log(serialized);
      }
    }
    return entry;
  },

  info(event: string, data?: Record<string, unknown>, correlationId?: string) {
    return this.log("info", event, data, correlationId);
  },

  warn(event: string, data?: Record<string, unknown>, correlationId?: string) {
    return this.log("warn", event, data, correlationId);
  },

  error(event: string, data?: Record<string, unknown>, correlationId?: string) {
    return this.log("error", event, data, correlationId);
  },

  debug(event: string, data?: Record<string, unknown>, correlationId?: string) {
    return this.log("debug", event, data, correlationId);
  },

  getRecentLogs(): LogEntry[] {
    return [...recentLogs];
  },
};

