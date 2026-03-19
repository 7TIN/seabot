// lib/providers/huggingface.ts
import fs from "fs";
import path from "path";
import { InferenceClient } from "@huggingface/inference";

type FeatureExtractionArgs = Parameters<InferenceClient["featureExtraction"]>[0];
type Provider = NonNullable<FeatureExtractionArgs["provider"]>;

const MODEL = process.env.HF_EMBEDDING_MODEL ?? "Qwen/Qwen3-Embedding-0.6B";
const PROVIDER = (process.env.HF_PROVIDER ?? "hf-inference") as Provider;
const OUTPUT_PATH = path.resolve("storage/key_value_stores/default/query_vector.json");

function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

function saveVector(vector: number[]): void {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(vector));
  console.log(`[huggingface] Saved query vector -> ${OUTPUT_PATH}`);
}

function is2dArray(data: number[] | number[][]): data is number[][] {
  return Array.isArray(data[0]);
}

export async function embedQuery(text: string): Promise<number[]> {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN not set in .env");

  const client = new InferenceClient(token);

  const data = (await client.featureExtraction({
    model: MODEL,
    provider: PROVIDER,
    inputs: text,
  })) as number[] | number[][];

  const vector = is2dArray(data) ? data[0] : data;
  if (!vector || vector.length === 0) {
    throw new Error("HuggingFace returned an empty embedding.");
  }
  const normalized = l2Normalize(vector);

  saveVector(normalized);

  return normalized;
}
