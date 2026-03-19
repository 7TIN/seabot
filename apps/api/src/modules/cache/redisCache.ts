import { createHash } from "node:crypto";
import { RedisClient } from "bun";

const CACHE_NAMESPACE = process.env.REDIS_CACHE_NAMESPACE ?? "docsai";
const CACHE_VERSION = process.env.REDIS_CACHE_VERSION ?? "v1";
const REDIS_URL =
  process.env.REDIS_URL ?? process.env.VALKEY_URL ?? "redis://localhost:6379";
const REDIS_COMMAND_TIMEOUT_MS = envPositiveInt(
  process.env.REDIS_COMMAND_TIMEOUT_MS,
  400
);
const CACHE_TTL_JITTER_RATIO = envRatio(
  process.env.REDIS_CACHE_TTL_JITTER_RATIO,
  0.1
);

let client: RedisClient | null | undefined;
let warnedMissingConfig = false;
let lastWarnTs = 0;

function envPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function envRatio(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 0.3) return fallback;
  return parsed;
}

function warnCache(message: string) {
  const now = Date.now();
  if (now - lastWarnTs < 30_000) return;
  lastWarnTs = now;
  console.warn(`[cache] ${message}`);
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => a.localeCompare(b)
    );
    return `{${entries
      .map(([k, v]) => `${JSON.stringify(k)}:${stableSerialize(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(String(value));
}

export function makeCacheKey(scope: string, input: unknown): string {
  const digest = createHash("sha256").update(stableSerialize(input)).digest("hex");
  return `${CACHE_NAMESPACE}:${CACHE_VERSION}:${scope}:${digest}`;
}

function getClient(): RedisClient | null {
  if (client !== undefined) return client;

  try {
    if (!process.env.REDIS_URL && !process.env.VALKEY_URL && !warnedMissingConfig) {
      warnedMissingConfig = true;
      console.info(
        "[cache] REDIS_URL not set. Using default redis://localhost:6379."
      );
    }

    client = new RedisClient(REDIS_URL);
    return client;
  } catch (error) {
    warnCache(`Failed to initialize Bun Redis client: ${String(error)}`);
    client = null;
    return client;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`Redis command timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function applyTtlJitter(ttlSeconds: number): number {
  const base = Math.max(1, Math.floor(ttlSeconds));
  const jitter = Math.floor(base * CACHE_TTL_JITTER_RATIO * Math.random());
  return Math.max(1, base - jitter);
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const redis = getClient();
  if (!redis) return null;

  try {
    const raw = await withTimeout(redis.get(key), REDIS_COMMAND_TIMEOUT_MS);
    if (raw === null || raw.trim() === "") return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    warnCache(`GET failed for key ${key}: ${String(error)}`);
    return null;
  }
}

export async function cacheSetJson(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const redis = getClient();
  if (!redis) return;

  const ttl = applyTtlJitter(ttlSeconds);

  try {
    const payload = JSON.stringify(value ?? null);
    await withTimeout(
      redis.set(key, payload, "EX", String(ttl)),
      REDIS_COMMAND_TIMEOUT_MS
    );
  } catch (error) {
    warnCache(`SET failed for key ${key}: ${String(error)}`);
  }
}
