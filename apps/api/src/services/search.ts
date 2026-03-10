import { client } from "../client/typesenseClient.ts";

async function search() {
  const result = await client
    .collections("docs")
    .documents()
    .search({
      q: "routing",
      query_by: "heading,content,code",
    });

  console.log(result.hits);
}

search();