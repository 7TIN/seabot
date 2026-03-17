import { Hono } from "hono";
import { searchDocs } from "./services/search.ts";
import { cors } from "hono/cors";
import { embedQuery } from "./lib/embedQuery.ts";
import { searchByVector } from "./services/qdrantSearch.ts";

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

  try {
    const result = await searchDocs({
      query,
      page,
      perPage,
    });

    return c.json({
      query,
      found: result.found,
      page: result.page,
      results: result.hits,
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
    const vector = await embedQuery(query);
    const results = await searchByVector({
      vector,
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

export default app;
