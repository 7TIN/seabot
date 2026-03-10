import { client } from "../client/typesenseClient.ts";

type SearchOptions = {
  query: string;
  page?: number;
  perPage?: number;
};

// async function search() {
//   const result = await client
//     .collections("docs")
//     .documents()
//     .search({
//       q: "routing",
//       query_by: "heading,content,code",
//     });

//   console.log(result.hits);
// }

// search();


export async function searchDocs({ query, page = 1, perPage = 10 }: SearchOptions) {
  const result = await client
    .collections("docs")
    .documents()
    .search({
      q: query,

      // what fields to search
      query_by: "heading,content,code",

      // importance ranking
      query_by_weights: "10,5,2",

      // allow partial matching
      prefix: true,

      // typo tolerance
      num_typos: 2,

      // highlight matches
      highlight_fields: "heading,content,code",

      // limit returned fields
      include_fields: "title,heading,content,url",

      page,
      per_page: perPage,
    });

  return result;
}