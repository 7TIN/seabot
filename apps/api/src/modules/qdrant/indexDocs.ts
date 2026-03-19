import fs from "fs/promises";
import path from "path";
import { QDRANT_COLLECTION, qdrantRequest } from "../../clients/qdrantClient.ts";

// import { QDRANT_COLLECTION, qdrantRequest } from "../client/qdrantClient.ts";

type EmbeddedDoc = {
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
  embedding: number[];
};

const EMBEDDED_DOCS_PATH =
  process.env.EMBEDDED_DOCS_PATH ??
  "storage/key_value_stores/default/embedded_docs_qwen.json";

const BATCH_SIZE = Math.max(
  1,
  Number(process.env.QDRANT_BATCH_SIZE ?? 64)
);

async function loadEmbeddedDocs() {
  const resolved = path.resolve(EMBEDDED_DOCS_PATH);
  const raw = await fs.readFile(resolved, "utf8");
  const docs = JSON.parse(raw) as EmbeddedDoc[];

  if (!Array.isArray(docs)) {
    throw new Error("Embedded docs file must contain an array");
  }

  return docs;
}

function buildPayload(doc: EmbeddedDoc) {
  return {
    title: doc.title ?? "",
    lvl0: doc.lvl0 ?? "",
    lvl1: doc.lvl1 ?? "",
    lvl2: doc.lvl2 ?? "",
    heading: doc.heading ?? "",
    headingLevel: doc.headingLevel ?? 1,
    content: doc.content ?? "",
    code: doc.code ?? "",
    position: doc.position ?? 0,
    pageScore: doc.pageScore ?? 40,
    rank: doc.rank ?? 0,
    url: doc.url ?? "",
  };
}

async function upsertBatch(points: Array<Record<string, unknown>>) {
  await qdrantRequest(`/collections/${QDRANT_COLLECTION}/points?wait=true`, {
    method: "PUT",
    body: JSON.stringify({ points }),
  });
}

async function run() {
  const docs = await loadEmbeddedDocs();
  console.log(`Loaded ${docs.length} embedded docs`);

  let skipped = 0;
  const points = docs.flatMap((doc, index) => {
    if (!Array.isArray(doc.embedding) || doc.embedding.length === 0) {
      skipped += 1;
      return [];
    }

    return [
      {
        id: index + 1,
        vector: doc.embedding,
        payload: buildPayload(doc),
      },
    ];
  });

  console.log(
    `Preparing to upsert ${points.length} points` +
      (skipped ? ` (skipped ${skipped} with missing embeddings)` : "")
  );

  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    await upsertBatch(batch);
    console.log(
      `Upserted ${Math.min(i + BATCH_SIZE, points.length)} / ${points.length}`
    );
  }

  console.log("Qdrant indexing complete");
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
