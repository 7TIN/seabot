import { CheerioCrawler, Dataset } from "crawlee";

function normalize(text: string) {
  return text
    .normalize("NFKC")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function getPageScore(url: string): number {
  if (/\/docs\/api\//.test(url)) return 80;
  if (/\/docs\/guides\//.test(url)) return 70;
  if (/\/docs\/middleware\//.test(url)) return 60;
  if (/\/docs\/concepts\//.test(url)) return 50;
  return 40;
}

function buildUrl(pageUrl: string, id: string | undefined): string {
  const base = pageUrl.split("#")[0];
  return id ? `${base}#${id}` : (base || pageUrl);
}

/**
 * Single composite rank score baked at crawl time.
 * Higher = more important = should appear first.
 *
 * Formula (all additive, no overlap between tiers):
 *   pageScore  (40–80)  × 10000  → 400000–800000  (page importance tier)
 *   headingLevel (1–4) inverted  × 1000   → h1=4000, h2=3000, h3=2000, h4=1000
 *   position (0–999) inverted    × 1      → earlier = higher (max 999)
 *
 * Example:
 *   "Routing" h1 pos=0  on /docs/api/  → 800000 + 4000 + 999 = 804999
 *   "Routing with host" h2 pos=11      → 800000 + 3000 + 988 = 803988
 *   "Path-Based Routing" h3 pos=20 on /docs/middleware/ → 600000 + 2000 + 979 = 602979
 */
function computeRank(pageScore: number, headingLevel: number, position: number): number {
  const pageTier    = pageScore * 10000;
  const levelTier   = (5 - headingLevel) * 1000;   // h1→4000, h2→3000, h3→2000, h4→1000
  const posTier     = Math.max(0, 999 - position);  // earlier = higher
  return pageTier + levelTier + posTier;
}

const crawler = new CheerioCrawler({
  maxRequestsPerCrawl: 500,

  async requestHandler({ request, $, enqueueLinks, log }) {
    const url = request.loadedUrl!;
    log.info(`Processing ${url}`);

    $("nav, aside, footer, script, style").remove();

    const title = normalize($("title").text());
    const pageScore = getPageScore(url);
    const container = $("article").length ? $("article") : $("main");

    let lvl1 = "";
    let lvl2 = "";
    let position = 0;

    const records: any[] = [];

    container.find("h1, h2, h3, h4").each((_, el) => {
      const tag = el.tagName.toLowerCase();
      const heading = normalize($(el).text());
      const id = $(el).attr("id");
      const headingLevel = parseInt(tag.replace("h", ""), 10);

      if (tag === "h1") { lvl1 = heading; lvl2 = ""; }
      if (tag === "h2") lvl2 = heading;

      const section = $(el).nextUntil("h1, h2, h3, h4");

      const textContent = normalize(
        section.clone().find("pre, code").remove().end().text()
      );

      const codeBlocks = section
        .find("pre code")
        .map((_, el) => $(el).text())
        .get();

      records.push({
        title,
        lvl0: title,
        lvl1,
        lvl2,
        heading,
        content: textContent,
        code: codeBlocks.join("\n\n"),
        url: buildUrl(url, id),
        position,
        pageScore,
        headingLevel,
        // Composite rank — used as primary sort after _text_match
        rank: computeRank(pageScore, headingLevel, position),
      });

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

      const headingLevel = 1;
      records.push({
        title,
        lvl0: title,
        lvl1: title,
        lvl2: "",
        heading: title,
        content: textContent,
        code: codeBlocks.join("\n\n"),
        url: url.split("#")[0],
        position: 0,
        pageScore,
        headingLevel,
        rank: computeRank(pageScore, headingLevel, 0),
      });
    }

    log.info(`Extracted ${records.length} records from ${url}`);
    await Dataset.pushData(records);

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