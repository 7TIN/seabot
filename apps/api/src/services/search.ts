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


export async function searchDocs({
  query,
  page = 1,
  perPage = 10,
}: SearchOptions) {

  const result = await client
    .collections("docs")
    .documents()
    .search({

      q: query,

      query_by: "heading,lvl1,lvl2,lvl3,content",

      query_by_weights: "20,15,12,10,5",

      prefix: true,

      num_typos: 2,

      prioritize_exact_match: true,

      drop_tokens_threshold: 0,

      sort_by: "_text_match:desc,position:asc",

      highlight_fields: "heading,content",

      include_fields:
        "title,lvl0,lvl1,lvl2,lvl3,heading,content,url,type",
      page,
      per_page: perPage,
    });

  return result;
}

