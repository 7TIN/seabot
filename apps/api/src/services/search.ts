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

      // ONLY search heading + content + code.
      // Do NOT include lvl1/lvl2/title — those fields repeat the parent heading
      // name on every subsection, which inflates fields_matched for subsections
      // and causes "Routing with host Header" (h2) to outscore "Routing" (h1).
      query_by: "heading,content,code",

      // heading exact match is the strongest signal
      query_by_weights: "10,3,1",

      // Prefix only on heading (for as-you-type UX), not content/code
      prefix: "true,false,false",

      // 1 typo on heading, 2 on content (longer text), 1 on code
      num_typos: "1,2,1",

      // Exact whole-word match scores higher than prefix/typo
      prioritize_exact_match: true,

      // Match at start of field scores higher (heading that starts with "Routing"
      // beats heading that ends with "Routing")
      prioritize_token_position: true,

      // Highlight matches
      highlight_fields: "heading,content,code",
      highlight_affix_num_tokens: 5,

      // Fields to return
      include_fields: "title,heading,headingLevel,content,url,position,pageScore,lvl1,lvl2",

      // Tie-breaking:
      // When two results have the same text_match score (e.g. both match
      // "routing" only in heading), headingLevel ASC ensures h1 beats h2,
      // and position ASC ensures earlier-on-page beats later.
      sort_by: "_text_match:desc,headingLevel:asc,position:asc",

      page,
      per_page: perPage,
    });

  return result;
}