import "dotenv/config";
import { CheerioCrawler, Dataset } from "crawlee";
import { gunzipSync } from "node:zlib";

const DEFAULT_DOCS_PATH = "/docs";

function normalizeDocsPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_DOCS_PATH;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

const DOCS_PATH = normalizeDocsPath(
  process.env.CRAWL_DOCS_PATH ?? DEFAULT_DOCS_PATH
);
const DOCS_SLUG = DOCS_PATH.replace(/^\/+/, "").replace(/\/+$/, "");
const DOCS_GLOB = DOCS_SLUG ? `**/${DOCS_SLUG}/**` : "**/**";

function splitCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function loadStartUrls(): Promise<string[]> {
  const explicit = splitCsv(process.env.CRAWL_START_URLS);
  if (explicit.length > 0) {
    return explicit;
  }

  const baseUrl = process.env.CRAWL_BASE_URL;
  if (!baseUrl) {
    throw new Error("CRAWL_BASE_URL not set. Example: https://hono.dev");
  }

  const docsUrl = new URL(DOCS_PATH, baseUrl).toString();
  const docsPrefix = docsUrl.endsWith("/") ? docsUrl : `${docsUrl}/`;

  const sitemapUrl =
    process.env.CRAWL_SITEMAP_URL ??
    new URL("/sitemap.xml", baseUrl).toString();

  async function fetchSitemap(url: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Sitemap fetch failed: ${res.status} ${res.statusText}`);
    }
    if (url.endsWith(".gz")) {
      const buf = Buffer.from(await res.arrayBuffer());
      return gunzipSync(buf).toString("utf8");
    }
    return await res.text();
  }

  function extractLocs(xml: string): string[] {
    return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g))
      .map((match) => match[1])
      .filter((url): url is string => typeof url === "string");
  }

  async function gatherSitemapUrls(rootUrl: string): Promise<string[]> {
    const xml = await fetchSitemap(rootUrl);
    const locs = extractLocs(xml);
    const sitemapLocs = locs.filter((loc) =>
      loc.endsWith(".xml") || loc.endsWith(".xml.gz")
    );
    if (sitemapLocs.length === 0) {
      return locs;
    }
    const nestedUrls: string[] = [];
    for (const loc of sitemapLocs) {
      try {
        const nestedXml = await fetchSitemap(loc);
        nestedUrls.push(...extractLocs(nestedXml));
      } catch (error) {
        console.warn(`[crawler] nested sitemap failed: ${loc} (${String(error)})`);
      }
    }
    return nestedUrls.length ? nestedUrls : locs;
  }

  try {
    const urls = await gatherSitemapUrls(sitemapUrl);
    const filtered = urls.filter((url) => url.startsWith(docsPrefix));
    const unique = Array.from(new Set(filtered));
    if (unique.length > 0) {
      return unique;
    }
  } catch (error) {
    console.warn(`[crawler] sitemap fetch failed: ${String(error)}`);
  }

  return [docsUrl];
}

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
  maxRequestsPerCrawl: Math.max(
    1,
    Number(process.env.CRAWL_MAX_REQUESTS ?? 2000)
  ),

  async requestHandler({ request, $, enqueueLinks, log }) {
    const url = request.loadedUrl!;
    log.info(`Processing ${url}`);

    await enqueueLinks({
      strategy: "same-domain",
      globs: [DOCS_GLOB],
    });

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

  },

  async failedRequestHandler({ request, log }) {
    log.error(`Failed crawling ${request.url}`);
  },
});

const startUrls = await loadStartUrls();
console.log(`[crawler] start urls: ${startUrls.length}`);
await crawler.run(startUrls);
await Dataset.exportToJSON("docs");
