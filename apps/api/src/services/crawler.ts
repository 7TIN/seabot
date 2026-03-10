import { CheerioCrawler, Dataset } from "crawlee";
// import { mkdir, writeFile } from "node:fs/promises";
// import path from "node:path";

function normalize(text: string) {
  return text
    .normalize("NFKC")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // markdown links
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

// async function exportMergedDocsJson() {
//   const dataset = await Dataset.open();
//   const merged: unknown[] = [];

//   let offset = 0;
//   const limit = 1000;

//   while (true) {
//     const { items, total } = await dataset.getData({ offset, limit });
//     merged.push(...items);

//     offset += items.length;
//     if (offset >= total || items.length === 0) break;
//   }

//   const storageDir = process.env.CRAWLEE_STORAGE_DIR ?? "storage";
//   const docsPath = path.resolve(storageDir, "docs.json");

//   await mkdir(path.dirname(docsPath), { recursive: true });
//   await writeFile(docsPath, JSON.stringify(merged, null, 2), "utf8");

//   console.log(`Merged dataset exported to ${docsPath}`);
// }

const crawler = new CheerioCrawler({
  maxRequestsPerCrawl: 500,

  async requestHandler({ request, $, enqueueLinks, log }) {
    const url = request.loadedUrl!;
    log.info(`Processing ${url}`);

    // Remove layout junk
    $("nav, aside, footer, script, style").remove();

    const title = normalize($("title").text());

    const container = $("article").length
      ? $("article")
      : $("main");

    let lvl1 = "";
    let lvl2 = "";

    const records: any[] = [];

    container.find("h1, h2, h3").each((_, el) => {
      const tag = el.tagName.toLowerCase();
      const heading = normalize($(el).text());
      const id = $(el).attr("id");

      if (tag === "h1") lvl1 = heading;
      if (tag === "h2") lvl2 = heading;

      const section = $(el).nextUntil("h1, h2, h3");

      // TEXT CONTENT (everything except code)
      const textContent = normalize(
        section
          .clone()
          .find("pre, code")
          .remove()
          .end()
          .text()
      );

      // CODE BLOCKS
      const codeBlocks = section
        .find("pre code")
        .map((_, el) => $(el).text())
        .get();

      const code = codeBlocks.join("\n\n");

      if (!textContent && !code) return;

      // chunk long text
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
          url: id ? `${url}#${id}` : url,
        });
      }
    });

    // Fallback when page has no headings
    if (records.length === 0) {
      const textContent = normalize(
        container
          .clone()
          .find("pre, code")
          .remove()
          .end()
          .text()
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
          url,
        });
      }
    }

    if (records.length > 0) {
      log.info(`Extracted ${records.length} records`);
      await Dataset.pushData(records);
    }

    // follow docs links
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

// await exportMergedDocsJson();
