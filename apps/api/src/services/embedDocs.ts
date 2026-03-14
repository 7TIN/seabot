import fs from "fs/promises";
import path from "path";

import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { env } from "@huggingface/transformers";

env.cacheDir = "./.hf-cache";

const DOCS_PATH = path.resolve(
  "storage/key_value_stores/default/docs.json"
);

const OUTPUT_PATH = path.resolve(
  "storage/key_value_stores/default/embedded_docs.json"
);


type CrawledDoc = {
  title: string;
  lvl0: string;
  lvl1: string;
  lvl2: string;
  heading: string;
  content: string;
  code: string;
  url: string;
  position: number;
  pageScore: number;
  headingLevel: number;
  rank: number;
};

type EmbeddedDoc = CrawledDoc & {
  embedding: number[];
};

function buildEmbeddingText(record: any) {
  const MAX_CHARS = 1200;

  return [
    record.lvl0,
    record.lvl1,
    record.lvl2,
    record.heading,
    record.content?.slice(0, MAX_CHARS),
  ]
    .filter(Boolean)
    .join("\n");
}

async function run() {
  console.log("Loading crawled docs...");

  const raw = await fs.readFile(DOCS_PATH, "utf8");
  const docs: CrawledDoc[] = JSON.parse(raw);

  console.log(`Total records: ${docs.length}`);

  const embeddings = new HuggingFaceTransformersEmbeddings({
    model: "Xenova/bge-small-en-v1.5",
  });

  console.log("Preparing embedding texts...");

  const texts = docs.map(buildEmbeddingText);

  console.log("Generating embeddings...");

  const vectors = await embeddings.embedDocuments(texts);

const embeddedDocs: EmbeddedDoc[] = docs.map((doc, i) => ({
  ...doc,
  embedding: vectors[i] ?? [],
}));

  console.log("Saving embedded docs...");
//   if (vectors.length !== docs.length) {
//   throw new Error("Embedding count mismatch");
// }

  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(embeddedDocs, null, 2)
  );

  console.log(`Saved to ${OUTPUT_PATH}`);
}

run().catch(console.error);