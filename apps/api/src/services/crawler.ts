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
  // Always strip existing hash to avoid double-anchor bug (#regexp#routing)
  const base = pageUrl.split("#")[0];
  return id ? `${base}#${id}` : (base || pageUrl);
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

      // Collect ALL text until next heading — no chunking
      const section = $(el).nextUntil("h1, h2, h3, h4");

      const textContent = normalize(
        section.clone().find("pre, code").remove().end().text()
      );

      const codeBlocks = section
        .find("pre code")
        .map((_, el) => $(el).text())
        .get();

      // Always push one record per heading (even code-only sections)
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
      });

      position++;
    });

    // Fallback: page has no headings at all
    if (records.length === 0) {
      const textContent = normalize(
        container.clone().find("pre, code").remove().end().text()
      );
      const codeBlocks = container
        .find("pre code")
        .map((_, el) => $(el).text())
        .get();

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
        headingLevel: 1,
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