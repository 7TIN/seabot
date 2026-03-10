import fs from "fs";
import path from "path";
import { client } from "../client/typesenseClient.ts";

async function indexDocs() {
  const filePath = "./storage/key_value_stores/default/docs.json";

  const raw = fs.readFileSync(filePath, "utf8");
  const docs = JSON.parse(raw);

  if (!Array.isArray(docs)) {
    throw new Error("docs.json must contain an array of records");
  }

  console.log(`Indexing ${docs.length} records...`);

  const result = await client
    .collections("docs")
    .documents()
    .import(docs, { action: "upsert" });

  console.log("Indexing complete");
  console.log(result);
}

indexDocs();