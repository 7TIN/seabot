import { client } from "../client/typesenseClient.ts";


async function createCollection() {
  const schema = {
    name: "docs",
    fields: [
      { name: "title", type: "string" as const },
      { name: "lvl0", type: "string" as const, facet: true },
      { name: "lvl1", type: "string" as const, facet: true },
      { name: "lvl2", type: "string" as const, facet: true },
      { name: "heading", type: "string" as const },
      { name: "content", type: "string" as const },
      { name: "code", type: "string" as const },
      { name: "url", type: "string" as const },
    ],
  };

  try {
    const res = await client.collections().create(schema);
    console.log("Collection created:", res);
  } catch (err) {
    console.log("Collection already exists");
  }
}

createCollection();