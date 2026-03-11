import { CheerioCrawler, Dataset } from "crawlee";

function normalize(text: string) {
  return text
    .normalize("NFKC")
    .replace(/\u200B/g, "")
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

const crawler = new CheerioCrawler({
  maxRequestsPerCrawl: 500,

  async requestHandler({ request, $, enqueueLinks, log }) {
    const url = request.loadedUrl!;
    const cleanUrl = url.split("#")[0];

    log.info(`Processing ${cleanUrl}`);

    $("nav, aside, footer, script, style").remove();

    const title = normalize($("title").text());

    const container = $("article").length ? $("article") : $("main");

    let lvl0 = title;
    let lvl1 = "";
    let lvl2 = "";
    let lvl3 = "";

    let position = 0;

    const records: any[] = [];

    container.find("h1, h2, h3").each((_, el) => {
      const tag = el.tagName.toLowerCase();
      const heading = normalize($(el).text());
      const id = $(el).attr("id");

      if (!heading) return;

      if (tag === "h1") {
        lvl1 = heading;
        lvl2 = "";
        lvl3 = "";
      }

      if (tag === "h2") {
        lvl2 = heading;
        lvl3 = "";
      }

      if (tag === "h3") {
        lvl3 = heading;
      }

      position++;

      const section = $(el).nextUntil("h1, h2, h3");

      const textContent = normalize(
        section.clone().find("pre, code").remove().end().text()
      );

      const codeBlocks = section
        .find("pre code")
        .map((_, el) => $(el).text())
        .get();

      const code = codeBlocks.join("\n\n");

      const sectionUrl = id ? `${cleanUrl}#${id}` : cleanUrl;

      // HEADING RECORD (important for ranking)
      records.push({
        title,
        lvl0,
        lvl1,
        lvl2,
        lvl3,
        heading,
        content: "",
        code: "",
        type: "heading",
        position,
        url: sectionUrl,
      });

      if (!textContent && !code) return;

      const chunks = chunkText(textContent);

      for (const chunk of chunks) {
        records.push({
          title,
          lvl0,
          lvl1,
          lvl2,
          lvl3,
          heading,
          content: chunk,
          code,
          type: "content",
          position,
          url: sectionUrl,
        });
      }
    });

    // Fallback if page has no headings
    if (records.length === 0) {
      const textContent = normalize(
        container.clone().find("pre, code").remove().end().text()
      );

      const chunks = chunkText(textContent);

      for (const chunk of chunks) {
        records.push({
          title,
          lvl0: title,
          lvl1: title,
          lvl2: "",
          lvl3: "",
          heading: title,
          content: chunk,
          code: "",
          type: "content",
          position: 0,
          url: cleanUrl,
        });
      }
    }

    if (records.length > 0) {
      log.info(`Extracted ${records.length} records`);
      await Dataset.pushData(records);
    }

    await enqueueLinks({
      strategy: "same-domain",
      globs: [
        "**/docs/**",
        "**/guide/**",
        "**/reference/**",
      ],
    });
  },

  async failedRequestHandler({ request, log }) {
    log.error(`Failed crawling ${request.url}`);
  },
});

await crawler.run([
  "https://hono.dev/docs",
]);

await Dataset.exportToJSON("docs");
