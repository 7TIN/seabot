import fs from "fs";
import { client } from "../client/typesenseClient.ts";

async function indexDocs() {
  const filePath = "./storage/key_value_stores/default/docs.json";

  const raw = fs.readFileSync(filePath, "utf8");
  const docs = JSON.parse(raw);

  if (!Array.isArray(docs)) {
    throw new Error("docs.json must contain an array of records");
  }

  // Ensure every record has the fields Typesense requires.
  // Missing optional strings default to "" and missing ints default to 0
  // so the import never fails on a single bad record.
  const sanitized = docs.map((doc: any) => ({
    title:        doc.title        ?? "",
    lvl0:         doc.lvl0         ?? "",
    lvl1:         doc.lvl1         ?? "",
    lvl2:         doc.lvl2         ?? "",
    heading:      doc.heading      ?? "",
    headingLevel: doc.headingLevel ?? 1,   // default h1 if missing
    content:      doc.content      ?? "",
    code:         doc.code         ?? "",
    position:     doc.position     ?? 0,
    pageScore:    doc.pageScore    ?? 40,  // lowest tier if missing
    url:          doc.url          ?? "",
  }));

  console.log(`Indexing ${sanitized.length} records...`);

  const results = await client
    .collections("docs")
    .documents()
    .import(sanitized, { action: "upsert" });

  // Report any per-record failures without crashing the whole import
  const failures = results.filter((r: any) => !r.success);
  if (failures.length > 0) {
    console.warn(`${failures.length} records failed to index:`);
    failures.forEach((f: any) => console.warn(f));
  }

  console.log(`Indexing complete — ${sanitized.length - failures.length} succeeded, ${failures.length} failed`);
}

indexDocs();