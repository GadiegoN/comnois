import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).default("pglite://.data/pgdata"),
  AUTH_SECRET: z
    .string()
    .min(16, "AUTH_SECRET deve ter pelo menos 16 caracteres")
    .default("dev-secret-key-alterar-em-producao-min-32-chars-2026"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().min(1).default(".data/storage"),
  S3_ENDPOINT: z.string().optional().default(""),
  S3_REGION: z.string().optional().default("us-east-1"),
  S3_BUCKET: z.string().optional().default(""),
  S3_ACCESS_KEY_ID: z.string().optional().default(""),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(""),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(26214400), // 25MB
  AI_DEFAULT_PROVIDER: z.enum(["extractive", "openai", "ollama"]).default("extractive"),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434"),
  OLLAMA_MODEL: z.string().default("llama3.2"),
  OLLAMA_EMBEDDING_MODEL: z.string().default("nomic-embed-text"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(3),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(2000),
  WORKER_JOB_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  AI_DAILY_TOKEN_LIMIT_PER_USER: z.coerce.number().int().min(1000).default(100000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cachedEnv && process.env.NODE_ENV !== "test") {
    return cachedEnv;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Configuração de ambiente inválida: ${issues}`);
  }
  cachedEnv = parsed.data;
  return parsed.data;
}

export function validateEnvironment(rawEnv: Record<string, string | undefined>) {
  return envSchema.safeParse(rawEnv);
}

