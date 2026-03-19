import fs from "fs/promises";
import path from "path";

import {
  QDRANT_COLLECTION,
  qdrantFetch,
  qdrantRequest,
  type QdrantResponse,
} from "../client/qdrantClient.ts";

type EmbeddedDoc = {
  embedding: number[];
};

const EMBEDDED_DOCS_PATH =
  process.env.EMBEDDED_DOCS_PATH ??
  "storage/key_value_stores/default/embedded_docs_qwen.json";

const RECREATE =
  process.env.QDRANT_RECREATE === "1" ||
  process.env.QDRANT_RECREATE === "true";

function getVectorSize(docs: EmbeddedDoc[]) {
  if (docs.length === 0) {
    throw new Error("Embedded docs file is empty");
  }

  const first = docs[0]?.embedding;
  if (!Array.isArray(first) || first.length === 0) {
    throw new Error("First document is missing an embedding vector");
  }

  const size = first.length;

  for (let i = 1; i < docs.length; i++) {
    const vec = docs[i]?.embedding;
    if (!Array.isArray(vec) || vec.length !== size) {
      throw new Error(
        `Embedding size mismatch at index ${i}: expected ${size}, got ${
          Array.isArray(vec) ? vec.length : "missing"
        }`
      );
    }
  }

  return size;
}

async function loadEmbeddedDocs() {
  const resolved = path.resolve(EMBEDDED_DOCS_PATH);
  const raw = await fs.readFile(resolved, "utf8");
  const docs = JSON.parse(raw) as EmbeddedDoc[];

  if (!Array.isArray(docs)) {
    throw new Error("Embedded docs file must contain an array");
  }

  return docs;
}

async function createCollection(vectorSize: number) {
  await qdrantRequest(`/collections/${QDRANT_COLLECTION}`, {
    method: "PUT",
    body: JSON.stringify({
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    }),
  });
}

async function run() {
  const docs = await loadEmbeddedDocs();
  const vectorSize = getVectorSize(docs);

  const res = await qdrantFetch(`/collections/${QDRANT_COLLECTION}`);

  if (res.status === 200) {
    const payload = (await res.json()) as QdrantResponse<{
      config?: { params?: { vectors?: { size?: number } } };
    }>;
    const existingSize = payload?.result?.config?.params?.vectors?.size;

    if (existingSize === vectorSize) {
      console.log(
        `Collection '${QDRANT_COLLECTION}' already exists with size ${vectorSize}`
      );
      return;
    }

    if (!RECREATE) {
      throw new Error(
        `Collection '${QDRANT_COLLECTION}' exists with size ${existingSize}. Set QDRANT_RECREATE=true to recreate.`
      );
    }

    console.log(
      `Recreating '${QDRANT_COLLECTION}' (size ${existingSize} -> ${vectorSize})`
    );
    await qdrantRequest(`/collections/${QDRANT_COLLECTION}`, {
      method: "DELETE",
    });
  } else if (res.status !== 404) {
    const body = await res.text();
    throw new Error(
      `Unexpected response checking collection (${res.status}): ${body}`
    );
  }

  await createCollection(vectorSize);
  console.log(
    `Collection '${QDRANT_COLLECTION}' ready with vector size ${vectorSize}`
  );
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
