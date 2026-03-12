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

      // Only heading + content + code.
      // lvl1/lvl2/title are NOT searched — they echo parent heading names onto
      // every child section and inflate scores for subsections unfairly.
      query_by: "heading,content,code",
      query_by_weights: "10,3,1",

      // Prefix only on heading (as-you-type feel)
      prefix: "true,false,false",

      // Typo tolerance
      num_typos: "1,2,1",

      prioritize_exact_match: true,
      prioritize_token_position: true,

      highlight_fields: "heading,content,code",
      highlight_affix_num_tokens: 5,

      include_fields: "title,heading,headingLevel,content,url,position,pageScore,rank,lvl1,lvl2",

      // rank DESC is a single deterministic number baked at crawl time:
      //   pageScore tier (×10000) + headingLevel tier (×1000) + position tier (×1)
      //
      // "Routing" h1 pos=0  on /docs/api/ → rank 804999
      // "Routing with host" h2 pos=11     → rank 803988   ← always loses
      // "Path-Based Routing" h3 on /middleware/ → rank 602979  ← always loses
      //
      // This is reliable because rank is a plain int32 — no floating point,
      // no Typesense internal scoring surprises.
      sort_by: "_text_match:desc,rank:desc",

      page,
      per_page: perPage,
    });

  return result;
}