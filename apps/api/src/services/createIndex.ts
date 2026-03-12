import { client } from "../client/typesenseClient.ts";

async function createCollection() {
  const schema = {
    name: "docs",

    fields: [
      { name: "title",        type: "string" as const },

      { name: "lvl0",         type: "string" as const, facet: true },
      { name: "lvl1",         type: "string" as const, facet: true },
      { name: "lvl2",         type: "string" as const, facet: true, optional: true },

      { name: "heading",      type: "string" as const },
      { name: "headingLevel", type: "int32"  as const },  // h1=1 … h4=4

      { name: "content",      type: "string" as const },
      { name: "code",         type: "string" as const },

      { name: "position",     type: "int32"  as const },  // order on page (0 = first)
      { name: "pageScore",    type: "int32"  as const },  // importance by URL path

      { name: "url",          type: "string" as const, facet: true },
    ],

    // pageScore DESC so canonical pages naturally surface first at equal text scores
    default_sorting_field: "pageScore",
  };

  try {
    const res = await client.collections().create(schema);
    console.log("Collection created:", res);
  } catch (err) {
    console.log("Collection already exists — drop it first if schema changed");
  }
}

createCollection();