// lib/providers/huggingface.ts
import fs from "fs";
import path from "path";

const MODEL = "Qwen/Qwen3-Embedding-0.6B";
const HF_URL = `https://api-inference.huggingface.co/pipeline/feature-extraction/${MODEL}`;
const OUTPUT_PATH = path.resolve("storage/key_value_stores/default/query_vector.json");

function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

function saveVector(vector: number[]): void {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(vector));
  console.log(`[huggingface] Saved query vector → ${OUTPUT_PATH}`);
}

export async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch(HF_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
  });

  if (!res.ok) throw new Error(`HuggingFace error ${res.status}: ${await res.text()}`);

  const data = await res.json();
  const vector: number[] = Array.isArray(data[0]) ? data[0] : data;
  const normalized = l2Normalize(vector);

  saveVector(normalized);

  return normalized;
}