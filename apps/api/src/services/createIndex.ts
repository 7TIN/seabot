import { client } from "../client/typesenseClient.ts";

async function createCollection() {
  const schema = {
    name: "docs",

    fields: [
      { name: "title",        type: "string" as const },
      { name: "lvl0",         type: "string" as const, facet: true },
      { name: "lvl1",         type: "string" as const, facet: true },
      { name: "lvl2",         type: "string" as const, facet: true },
      { name: "heading",      type: "string" as const },
      { name: "headingLevel", type: "int32"  as const },
      { name: "content",      type: "string" as const },
      { name: "code",         type: "string" as const },
      { name: "position",     type: "int32"  as const },
      { name: "pageScore",    type: "int32"  as const },
      // Composite rank: pageScore tier + headingLevel tier + position tier
      // Computed at crawl time so sort_by is always deterministic
      { name: "rank",         type: "int32"  as const },
      { name: "url",          type: "string" as const, facet: true },
    ],

    // rank DESC as default — ensures browse order is also sane
    default_sorting_field: "rank",
  };

  try {
    const res = await client.collections().create(schema);
    console.log("Collection created:", res);
  } catch (err) {
    console.log("Collection already exists — drop it first if schema changed");
  }
}

createCollection();