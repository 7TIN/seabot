import { Dataset } from "crawlee";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

async function run() {
  const dataset = await Dataset.open();
  const merged: unknown[] = [];

  let offset = 0;
  const limit = 1000;

  while (true) {
    const { items, total } = await dataset.getData({ offset, limit });
    merged.push(...items);

    offset += items.length;
    if (offset >= total || items.length === 0) break;
  }

  const storageDir = process.env.CRAWLEE_STORAGE_DIR ?? "storage";
  const docsPath = path.resolve(storageDir, "docs.json");

  await mkdir(path.dirname(docsPath), { recursive: true });
  await writeFile(docsPath, JSON.stringify(merged, null, 2), "utf8");

  console.log(`Merged dataset exported to ${docsPath}`);
}

run();
