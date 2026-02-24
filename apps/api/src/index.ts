import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (context) => {
  return context.json({
    status: "ok",
    service: "@docsai/api"
  });
});

app.post("/search", async (context) => {
  const body = await context.req.json();
  const query = String(body.query ?? "");

  return context.json({
    results: query
      ? [
          {
            title: "Sample Result",
            url: "/docs/sample",
            excerpt: `Placeholder search result for "${query}".`
          }
        ]
      : []
  });
});

app.post("/ask", async (context) => {
  const body = await context.req.json();
  const query = String(body.query ?? "");
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (value: unknown): void => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
      };

      write({
        type: "token",
        content: `This is a placeholder streamed answer for: ${query}`
      });
      write({
        type: "sources",
        sources: [{ title: "Getting Started", url: "/docs/getting-started" }]
      });
      write({ type: "done" });
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive"
    }
  });
});

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port });

console.log(`@docsai/api listening on http://localhost:${port}`);
