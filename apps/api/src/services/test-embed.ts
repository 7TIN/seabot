// test-embed.ts
import "dotenv/config";
import { embedQuery } from "../lib/embedQuery.ts";

const query = "how to use the Client Components";
const provider = process.env.EMBEDDINGS_PROVIDER;

if (!provider) {
  console.error("EMBEDDINGS_PROVIDER not set. Use local | huggingface | colab.");
  process.exit(1);
}

console.log(`\nProvider: ${provider}`);
console.log(`Query: "${query}"`);
console.log("Embedding...\n");

embedQuery(query)
  .then((vector) => {
    console.log("Done");
    // console.log(`   Dimensions : ${vector.length}`);
    // console.log(
    //   `   First 5 values : [${vector
    //     .slice(0, 5)
    //     .map((v) => v.toFixed(6))
    //     .join(", ")}]`
    // );
    // console.log(
    //   "   Saved to : storage/key_value_stores/default/query_vector.json\n"
    // );
  })
  .catch((err) => {
    console.error("Failed:", err.message);
    process.exit(1);
  });
