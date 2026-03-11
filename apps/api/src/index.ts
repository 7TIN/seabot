import { Hono } from "hono";
import { searchDocs } from "./services/search.ts";
import { cors } from "hono/cors";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173"], // your React dev server
    allowMethods: ["GET"],
    allowHeaders: ["Content-Type"],
  })
);

app.get("/", (c) => {
  return c.text("Docs Search API running");
});

app.get("/search", async (c) => {
  const query = c.req.query("q");
  const page = Number(c.req.query("page") || 1);
  const perPage = Number(c.req.query("per_page") || 10);

  if (!query) {
    return c.json({ error: "Missing query parameter 'q'" }, 400);
  }

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

export default app;