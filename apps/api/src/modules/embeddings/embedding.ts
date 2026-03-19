import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { env } from "@huggingface/transformers";

// keep models out of node_modules
env.cacheDir = "./.hf-cache";

const testText = "How to configure Prisma with PostgreSQL in a Next.js application?";

async function runEmbedding(modelName: string) {
  console.log(`\nLoading model: ${modelName}`);

  const embeddings = new HuggingFaceTransformersEmbeddings({
    model: modelName,
  });

  const vec = await embeddings.embedQuery(testText);

  console.log(`Model: ${modelName}`);
  console.log("Vector dimension:", vec.length);
  console.log("First 10 values:", vec.slice(0, 10));
}

/* -----------------------------
   MODELS TO TEST
--------------------------------*/

// 1️⃣ Best lightweight RAG model (~120MB)
export async function testBgeSmall() {
  await runEmbedding("Xenova/bge-small-en-v1.5");
}

// 2️⃣ Slightly stronger (~300MB)
export async function testBgeBase() {
  await runEmbedding("Xenova/bge-base-en-v1.5");
}

// 3️⃣ Very small (~90MB)
export async function testGteSmall() {
  await runEmbedding("Supabase/gte-small");
}

// 4️⃣ MiniLM classic (~80MB)
export async function testMiniLM() {
  await runEmbedding("Xenova/all-MiniLM-L6-v2");
}

// 5️⃣ Qwen embedding (~1GB)
export async function testQwen() {
  await runEmbedding("onnx-community/Qwen3-Embedding-0.6B-ONNX");
}

/* -----------------------------
   RUN ONE MODEL AT A TIME
--------------------------------*/

async function main() {

//   await testMiniLM();
//   await testGteSmall();
//   await testBgeSmall();
//   await testBgeBase();
  await testQwen();

}

main().catch(console.error);