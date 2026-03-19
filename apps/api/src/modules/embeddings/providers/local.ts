// lib/providers/local.ts
import fs from "fs";
import path from "path";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { env } from "@huggingface/transformers";

// keep models out of node_modules
env.cacheDir = "./.hf-cache";

const MODEL =
  process.env.LOCAL_EMBEDDING_MODEL ?? "onnx-community/Qwen3-Embedding-0.6B-ONNX";
const OUTPUT_PATH = path.resolve("storage/key_value_stores/default/query_vector.json");

let embedder: HuggingFaceTransformersEmbeddings | null = null;

function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

function saveVector(vector: number[]): void {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(vector));
  console.log(`[local] Saved query vector -> ${OUTPUT_PATH}`);
}

function getEmbedder() {
  if (!embedder) {
    embedder = new HuggingFaceTransformersEmbeddings({
      model: MODEL,
    });
  }
  return embedder;
}

export async function embedQuery(text: string): Promise<number[]> {
  const vector = await getEmbedder().embedQuery(text);
  const normalized = l2Normalize(vector);
  saveVector(normalized);
  return normalized;
}
