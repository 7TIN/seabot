// lib/providers/colab.ts
import fs from "fs";
import path from "path";

const OUTPUT_PATH = path.resolve("storage/key_value_stores/default/query_vector.json");

function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return norm === 0 ? v : v.map((x) => x / norm);
}

function saveVector(vector: number[]): void {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(vector));
  console.log(`[colab] Saved -> ${OUTPUT_PATH}`);
}

export async function embedQuery(text: string): Promise<number[]> {
  const base = process.env.COLAB_NGROK_URL;
  if (!base) throw new Error("COLAB_NGROK_URL not set in .env");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.COLAB_API_KEY;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(`${base}/embed`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text }),
  });

  if (!res.ok) throw new Error(`Colab error ${res.status}: ${await res.text()}`);

  const { vector } = await res.json();

  // vector comes back as plain number[] from FastAPI -- normalize and save
  const normalized = l2Normalize(vector);
  saveVector(normalized);
  return normalized;
}
