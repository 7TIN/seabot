import { client } from "../client/typesenseClient.ts";

type SearchOptions = {
  query: string;
  page?: number;
  perPage?: number;
};

export async function searchDocs({ query, page = 1, perPage = 10 }: SearchOptions) {
  const result = await client
    .collections("docs")
    .documents()
    .search({
      q: query,
      query_by: "heading,title,content,code",
      query_by_weights: "15,10,5,2",
      prefix: "true,true,false,false",
      num_typos: 1,
      highlight_fields: "heading,content,code",
      include_fields: "title,heading,content,url,position,pageScore,headingLevel,lvl1,lvl2",
      sort_by: "_text_match:desc,pageScore:desc,position:asc",
      page,
      per_page: perPage,
    });

  return result;
}