import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { env } from "@huggingface/transformers";

import { QDRANT_COLLECTION, qdrantRequest } from "../client/qdrantClient.ts";

env.cacheDir = "./.hf-cache";

type VectorSearchOptions = {
  vector: number[];
  limit?: number;
  withPayload?: boolean;
  scoreThreshold?: number;
};

type TextSearchOptions = {
  query: string;
  limit?: number;
  scoreThreshold?: number;
};

const QUERY_MODEL =
  process.env.QDRANT_QUERY_MODEL ??
  "onnx-community/Qwen3-Embedding-0.6B-ONNX";

let embedder: HuggingFaceTransformersEmbeddings | null = null;

function getEmbedder() {
  if (!embedder) {
    embedder = new HuggingFaceTransformersEmbeddings({
      model: QUERY_MODEL,
    });
  }
  return embedder;
}

export async function searchByVector({
  vector,
  limit = 5,
  withPayload = true,
  scoreThreshold,
}: VectorSearchOptions) {
  const body: Record<string, unknown> = {
    vector,
    limit,
    with_payload: withPayload,
    with_vector: false,
  };

  if (typeof scoreThreshold === "number") {
    body.score_threshold = scoreThreshold;
  }

  const res = await qdrantRequest<unknown[]>(
    `/collections/${QDRANT_COLLECTION}/points/search`,
    {
      method: "POST",
      body: JSON.stringify(body),
    }
  );

  return res.result;
}

export async function searchByText({
  query,
  limit = 5,
  scoreThreshold,
}: TextSearchOptions) {
  const embeddings = getEmbedder();
  const vector = await embeddings.embedQuery(query);

  return searchByVector({
    vector,
    limit,
    scoreThreshold,
  });
}
