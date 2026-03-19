import fs from "fs";
import { createHash } from "node:crypto";
import { client } from "../client/typesenseClient.ts";

type IndexedDoc = {
  id: string;
  title: string;
  lvl0: string;
  lvl1: string;
  lvl2: string;
  heading: string;
  headingLevel: number;
  content: string;
  code: string;
  position: number;
  pageScore: number;
  rank: number;
  url: string;
};

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

function canonicalizeUrl(value: unknown): string {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    return parsed.toString();
  } catch {
    return trimmed.replace(/\/+(?=#|$)/g, "");
  }
}

function stableDocId(input: {
  url: string;
  heading: string;
  headingLevel: number;
  position: number;
  content: string;
}): string {
  const rawKey = [
    canonicalizeUrl(input.url).toLowerCase(),
    normalizeText(input.heading).toLowerCase(),
    String(input.headingLevel),
    String(input.position),
    normalizeText(input.content).toLowerCase(),
  ].join("::");

  return createHash("sha1").update(rawKey).digest("hex");
}

async function indexDocs() {
  const filePath = "./storage/key_value_stores/default/docs.json";

  const raw = fs.readFileSync(filePath, "utf8");
  const docs = JSON.parse(raw);

  if (!Array.isArray(docs)) {
    throw new Error("docs.json must contain an array of records");
  }

  const deduped = new Map<string, IndexedDoc>();
  for (const doc of docs as any[]) {
    const title = normalizeText(doc.title);
    const lvl0 = normalizeText(doc.lvl0);
    const lvl1 = normalizeText(doc.lvl1);
    const lvl2 = normalizeText(doc.lvl2);
    const heading = normalizeText(doc.heading);
    const headingLevel =
      Number.isInteger(doc.headingLevel) && doc.headingLevel > 0
        ? doc.headingLevel
        : 1;
    const content = normalizeText(doc.content);
    const code = typeof doc.code === "string" ? doc.code : "";
    const position = Number.isInteger(doc.position) ? doc.position : 0;
    const pageScore = Number.isInteger(doc.pageScore) ? doc.pageScore : 40;
    const rank = Number.isInteger(doc.rank) ? doc.rank : 0;
    const url = canonicalizeUrl(doc.url);

    const id = stableDocId({
      url,
      heading,
      headingLevel,
      position,
      content,
    });

    if (deduped.has(id)) continue;

    deduped.set(id, {
      id,
      title,
      lvl0,
      lvl1,
      lvl2,
      heading,
      headingLevel,
      content,
      code,
      position,
      pageScore,
      rank,
      url,
    });
  }

  const sanitized = Array.from(deduped.values());
  const skipped = docs.length - sanitized.length;

  console.log(`Indexing ${sanitized.length} records (${skipped} duplicates skipped)...`);

  const results = await client
    .collections("docs")
    .documents()
    .import(sanitized, { action: "upsert" });

  const failures = results.filter((r: any) => !r.success);
  if (failures.length > 0) {
    console.warn(`${failures.length} records failed:`);
    failures.forEach((f: any) => console.warn(f));
  }

  console.log(
    `Done - ${sanitized.length - failures.length} succeeded, ${failures.length} failed`
  );
}

indexDocs();
