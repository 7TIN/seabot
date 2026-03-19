import { Hono } from "hono";
import { cors } from "hono/cors";
import { embedQuery } from "./modules/embeddings/embedQuery.ts";
import { searchByVector } from "./modules/qdrant/search.ts";
import { selectContexts } from "./modules/rag/retrieval.ts";
import { buildRagPrompt } from "./modules/rag/ragPrompt.ts";
import { generateAnswer } from "./modules/rag/llm.ts";
import { searchDocs } from "./modules/search/searchDocs.ts";
import {
  cacheGetJson,
  cacheSetJson,
  makeCacheKey,
} from "./modules/cache/redisCache.ts";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173"], // your React dev server
    allowMethods: ["GET", "POST"],
    allowHeaders: ["Content-Type"],
  })
);

type JsonBody = Record<string, unknown>;
type HistoryTurn = { role: "user" | "assistant"; content: string };

async function readJsonBody(c: { req: { json: () => Promise<unknown> } }) {
  try {
    const data = await c.req.json();
    return data && typeof data === "object" ? (data as JsonBody) : null;
  } catch {
    return null;
  }
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function isPositiveInt(n: number) {
  return Number.isInteger(n) && n > 0;
}

function parseHistory(value: unknown): HistoryTurn[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const turns = value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const role = (item as Record<string, unknown>).role;
      const content = (item as Record<string, unknown>).content;
      if (role !== "user" && role !== "assistant") return null;
      if (typeof content !== "string" || content.trim() === "") return null;
      return { role, content };
    })
    .filter((v): v is HistoryTurn => Boolean(v));
  return turns.length ? turns : undefined;
}

function envPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function normalizeCacheQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

function historyForCache(history?: HistoryTurn[]): HistoryTurn[] {
  if (!history || history.length === 0) return [];
  return history.slice(-6);
}

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  );
}

const CACHE_INDEX_VERSION = process.env.CACHE_INDEX_VERSION ?? "v1";
const SEARCH_CACHE_TTL_SEC = envPositiveInt("SEARCH_CACHE_TTL_SEC", 300);
const EMBEDDING_CACHE_TTL_SEC = envPositiveInt("EMBEDDING_CACHE_TTL_SEC", 86_400);
const VECTOR_RESULTS_CACHE_TTL_SEC = envPositiveInt(
  "VECTOR_RESULTS_CACHE_TTL_SEC",
  300
);
const AI_ANSWER_CACHE_TTL_SEC = envPositiveInt("AI_ANSWER_CACHE_TTL_SEC", 180);

async function getCachedEmbedding(query: string): Promise<number[]> {
  const cacheKey = makeCacheKey("embed-query", {
    version: CACHE_INDEX_VERSION,
    provider: process.env.EMBEDDINGS_PROVIDER ?? "unknown",
    query: normalizeCacheQuery(query),
  });

  const cached = await cacheGetJson<unknown>(cacheKey);
  if (isNumberArray(cached)) {
    return cached;
  }

  const vector = await embedQuery(query);
  await cacheSetJson(cacheKey, vector, EMBEDDING_CACHE_TTL_SEC);
  return vector;
}

async function getCachedVectorResults(args: {
  query: string;
  limit: number;
  scoreThreshold?: number;
}) {
  const cacheKey = makeCacheKey("vector-results", {
    version: CACHE_INDEX_VERSION,
    provider: process.env.EMBEDDINGS_PROVIDER ?? "unknown",
    query: normalizeCacheQuery(args.query),
    limit: args.limit,
    scoreThreshold:
      typeof args.scoreThreshold === "number" && !Number.isNaN(args.scoreThreshold)
        ? args.scoreThreshold
        : null,
  });

  const cached = await cacheGetJson<unknown[]>(cacheKey);
  if (Array.isArray(cached)) {
    return cached;
  }

  const vector = await getCachedEmbedding(args.query);
  const results = await searchByVector({
    vector,
    limit: args.limit,
    ...(typeof args.scoreThreshold === "number" && !Number.isNaN(args.scoreThreshold)
      ? { scoreThreshold: args.scoreThreshold }
      : {}),
  });

  await cacheSetJson(cacheKey, results, VECTOR_RESULTS_CACHE_TTL_SEC);
  return results;
}

function resolveCandidateLimit(finalLimit: number): number {
  const envValue = Number(process.env.RAG_CANDIDATE_LIMIT ?? 30);
  const candidateFromEnv =
    Number.isFinite(envValue) && envValue > 0 ? Math.floor(envValue) : 30;
  return Math.max(finalLimit, candidateFromEnv, finalLimit * 4);
}

app.get("/", (c) => {
  return c.text("Docs Search API running");
});

app.post("/search", async (c) => {
  const body = await readJsonBody(c);
  if (!body) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return c.json({ error: "Missing or empty 'query' in body" }, 400);
  }

  const pageRaw = toNumber(body.page);
  const perPageRaw = toNumber(body.perPage);

  if (pageRaw !== undefined && !isPositiveInt(pageRaw)) {
    return c.json({ error: "'page' must be a positive integer" }, 400);
  }

  if (perPageRaw !== undefined && !isPositiveInt(perPageRaw)) {
    return c.json({ error: "'perPage' must be a positive integer" }, 400);
  }

  const page = pageRaw ?? 1;
  const perPage = perPageRaw ?? 10;

  const searchCacheKey = makeCacheKey("search", {
    version: CACHE_INDEX_VERSION,
    query: normalizeCacheQuery(query),
    page,
    perPage,
  });

  try {
    const cached = await cacheGetJson<{
      found: number;
      page: number;
      results: unknown[];
    }>(searchCacheKey);

    if (cached) {
      return c.json({
        query,
        found: cached.found,
        page: cached.page,
        results: cached.results,
      });
    }

    const result = await searchDocs({
      query,
      page,
      perPage,
    });

    const responseBody = {
      found: result.found,
      page: result.page,
      results: result.hits,
    };

    await cacheSetJson(searchCacheKey, responseBody, SEARCH_CACHE_TTL_SEC);

    return c.json({
      query,
      ...responseBody,
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "Search failed" }, 500);
  }
});

app.post("/ai-search", async (c) => {
  const body = await readJsonBody(c);
  if (!body) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return c.json({ error: "Missing or empty 'query' in body" }, 400);
  }

  const limitRaw = toNumber(body.limit);
  const scoreThresholdRaw = toNumber(body.scoreThreshold);

  if (limitRaw !== undefined && !isPositiveInt(limitRaw)) {
    return c.json({ error: "'limit' must be a positive integer" }, 400);
  }

  if (scoreThresholdRaw !== undefined && !Number.isFinite(scoreThresholdRaw)) {
    return c.json({ error: "'scoreThreshold' must be a number" }, 400);
  }

  const limit = limitRaw ?? 5;
  const scoreThreshold = scoreThresholdRaw;

  try {
    const results = await getCachedVectorResults({
      query,
      limit,
      ...(typeof scoreThreshold === "number" && !Number.isNaN(scoreThreshold)
        ? { scoreThreshold }
        : {}),
    });

    return c.json({
      query,
      found: results.length,
      results,
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "AI search failed" }, 500);
  }
});

app.post("/ai-answer", async (c) => {
  const body = await readJsonBody(c);
  if (!body) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return c.json({ error: "Missing or empty 'query' in body" }, 400);
  }

  const limitRaw = toNumber(body.limit);
  const scoreThresholdRaw = toNumber(body.scoreThreshold);
  const temperatureRaw = toNumber(body.temperature);
  const maxTokensRaw = toNumber(body.maxTokens);
  const includeContext = body.includeContext === true;

  if (limitRaw !== undefined && !isPositiveInt(limitRaw)) {
    return c.json({ error: "'limit' must be a positive integer" }, 400);
  }

  if (scoreThresholdRaw !== undefined && !Number.isFinite(scoreThresholdRaw)) {
    return c.json({ error: "'scoreThreshold' must be a number" }, 400);
  }

  if (temperatureRaw !== undefined && Number.isNaN(temperatureRaw)) {
    return c.json({ error: "'temperature' must be a number" }, 400);
  }

  if (maxTokensRaw !== undefined && !isPositiveInt(maxTokensRaw)) {
    return c.json({ error: "'maxTokens' must be a positive integer" }, 400);
  }

  const history = parseHistory(body.history);

  try {
    const finalLimit = limitRaw ?? 5;
    const candidateLimit = resolveCandidateLimit(finalLimit);
    const finalTemperature = temperatureRaw ?? 0.2;
    const finalMaxTokens = maxTokensRaw ?? 1200;

    const answerCacheKey = makeCacheKey("ai-answer", {
      version: CACHE_INDEX_VERSION,
      query: normalizeCacheQuery(query),
      history: historyForCache(history),
      limit: finalLimit,
      candidateLimit,
      scoreThreshold:
        typeof scoreThresholdRaw === "number" && !Number.isNaN(scoreThresholdRaw)
          ? scoreThresholdRaw
          : null,
      temperature: finalTemperature,
      maxTokens: finalMaxTokens,
      includeContext,
      llmProvider: process.env.LLM_PROVIDER ?? "unknown",
      llmModel: process.env.LLM_MODEL ?? "default",
      embeddingsProvider: process.env.EMBEDDINGS_PROVIDER ?? "unknown",
    });

    const cachedAnswer = await cacheGetJson<{
      answer: string;
      provider: string;
      model: string;
      sources: unknown[];
      context?: unknown[];
    }>(answerCacheKey);

    if (cachedAnswer) {
      return c.json({
        query,
        ...cachedAnswer,
      });
    }

    const results = await getCachedVectorResults({
      query,
      limit: candidateLimit,
      ...(typeof scoreThresholdRaw === "number" &&
      !Number.isNaN(scoreThresholdRaw)
        ? { scoreThreshold: scoreThresholdRaw }
        : {}),
    });

    const contexts = selectContexts({
      query,
      rawResults: results,
      limit: finalLimit,
    });

    if (contexts.length === 0) {
      return c.json({
        query,
        answer:
          "I could not find this in the docs yet. Can you clarify or provide more details?",
        sources: [],
      });
    }

    const promptArgs: Parameters<typeof buildRagPrompt>[0] = {
      query,
      contexts,
      maxCharsPerChunk: 1200,
    };
    if (history) {
      promptArgs.history = history;
    }

    const { system, user, sources } = buildRagPrompt(promptArgs);

    const llm = await generateAnswer({
      system,
      user,
      temperature: finalTemperature,
      maxTokens: finalMaxTokens,
    });

    const responseSources = sources.map((s) => {
      const ranked = contexts.find((ctx) => ctx.id === s.id);
      return {
        id: s.id,
        url: s.url,
        title: s.title,
        heading: s.heading,
        keywords: s.keywords,
        score: s.score,
        rankScore: ranked?.rankScore,
      };
    });

    const responseBody = {
      answer: llm.text.trim(),
      provider: llm.provider,
      model: llm.model,
      sources: responseSources,
      ...(includeContext ? { context: sources } : {}),
    };

    await cacheSetJson(answerCacheKey, responseBody, AI_ANSWER_CACHE_TTL_SEC);

    return c.json({
      query,
      ...responseBody,
    });
  } catch (error) {
    console.error(error);
    return c.json({ error: "AI answer failed" }, 500);
  }
});

export default app;
