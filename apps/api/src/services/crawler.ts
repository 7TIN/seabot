import { CheerioCrawler, Dataset } from "crawlee";

function normalize(text: string) {
  return text
    .normalize("NFKC")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip markdown links
    .replace(/\s+/g, " ")
    .trim();
}

function chunkText(text: string, size = 900) {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + size));
    i += size;
  }
  return chunks;
}

/**
 * Score a URL by how "important" the page is.
 * Higher = more likely to be the canonical page for a topic.
 *
 * e.g. /docs/api/routing  → 80  (direct API/guide page)
 *      /docs/guides/...   → 70
 *      /docs/middleware/  → 60
 *      /docs/concepts/    → 50
 *      everything else    → 40
 */
function getPageScore(url: string): number {
  if (/\/docs\/api\//.test(url)) return 80;
  if (/\/docs\/guides\//.test(url)) return 70;
  if (/\/docs\/middleware\//.test(url)) return 60;
  if (/\/docs\/concepts\//.test(url)) return 50;
  return 40;
}

/**
 * Build a clean anchor URL.
 * Avoids the double-anchor bug (e.g. #regexp#routing → #routing).
 * Always uses only the heading's own id.
 */
function buildUrl(pageUrl: string, id: string | undefined): string {
  // Strip any existing hash from the page URL first
  const base = pageUrl.split("#")[0];
  return id ? `${base}#${id}` : (base || "");
}

const crawler = new CheerioCrawler({
  maxRequestsPerCrawl: 500,

  async requestHandler({ request, $, enqueueLinks, log }) {
    const url = request.loadedUrl!;
    log.info(`Processing ${url}`);

    // Remove layout noise
    $("nav, aside, footer, script, style").remove();

    const title = normalize($("title").text());
    const pageScore = getPageScore(url);

    const container = $("article").length ? $("article") : $("main");

    let lvl1 = "";
    let lvl2 = "";
    let position = 0; // heading order on the page (0 = first = most important)

    const records: any[] = [];

    container.find("h1, h2, h3, h4").each((_, el) => {
      const tag = el.tagName.toLowerCase();
      const heading = normalize($(el).text());
      const id = $(el).attr("id");

      // Track heading hierarchy
      if (tag === "h1") { lvl1 = heading; lvl2 = ""; }
      if (tag === "h2") lvl2 = heading;

      // Heading level as a number (1–4) — used for ranking
      const headingLevel = parseInt(tag.replace("h", ""), 10);

      const section = $(el).nextUntil("h1, h2, h3, h4");

      // Text content (strip code blocks)
      const textContent = normalize(
        section
          .clone()
          .find("pre, code")
          .remove()
          .end()
          .text()
      );

      // Code blocks
      const codeBlocks = section
        .find("pre code")
        .map((_, el) => $(el).text())
        .get();

      const code = codeBlocks.join("\n\n");

      if (!textContent && !code) return;

      const chunks = chunkText(textContent);

      for (const chunk of chunks) {
        records.push({
          title,
          lvl0: title,
          lvl1,
          lvl2,
          heading,
          content: chunk,
          code,
          // Clean single-anchor URL (no double-hash bug)
          url: buildUrl(url, id),
          // --- NEW ranking signals ---
          // Lower position = earlier on page = more important
          position,
          // Page importance by URL path
          pageScore,
          // h1=1 … h4=4 — lower is more important
          headingLevel,
        });
      }

      position++;
    });

    // Fallback: page has no headings
    if (records.length === 0) {
      const textContent = normalize(
        container.clone().find("pre, code").remove().end().text()
      );

      const codeBlocks = container
        .find("pre code")
        .map((_, el) => $(el).text())
        .get();

      const chunks = chunkText(textContent);

      for (const chunk of chunks) {
        records.push({
          title,
          lvl0: title,
          lvl1: title,
          lvl2: null,
          heading: title,
          content: chunk,
          code: codeBlocks.join("\n\n"),
          url: url.split("#")[0], // always clean base URL for fallback
          position: 0,
          pageScore,
          headingLevel: 1,
        });
      }
    }

    if (records.length > 0) {
      log.info(`Extracted ${records.length} records from ${url}`);
      await Dataset.pushData(records);
    }

    await enqueueLinks({
      strategy: "same-domain",
      globs: ["**/docs/**", "**/guide/**", "**/reference/**"],
    });
  },

  async failedRequestHandler({ request, log }) {
    log.error(`Failed crawling ${request.url}`);
  },
});

await crawler.run(["https://hono.dev/docs"]);
await Dataset.exportToJSON("docs");