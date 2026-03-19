// scripts/test-qdrant.ts
import fs from "fs";
import { searchByVector } from "../modules/qdrant/search.ts";
// import { searchByVector } from "./qdrantSearch.ts";
// import { searchByVector } from "./services/qdrantSearch.ts";

const vector = JSON.parse(fs.readFileSync("storage/key_value_stores/default/query_vector.json", "utf8"));

const results = await searchByVector({
  vector,
  limit: 5,
  scoreThreshold: 0.2,
});

console.log(results);
