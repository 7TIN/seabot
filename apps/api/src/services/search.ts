import { client } from "../client/typesenseClient.ts";

type SearchOptions = {
  query: string;
  page?: number;
  perPage?: number;
};

type SearchHit = {
  document?: {
    url?: string;
    heading?: string;
    position?: number;
    content?: string;
  };
};

type SearchDocsResult = {
  found: number;
  page: number;
  hits: any[];
};

const RAW_PAGE_MULTIPLIER = 3;
const MIN_RAW_PER_PAGE = 30;

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeUrlForDedupe(value: unknown): string {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    return parsed.toString();
  } catch {
    return trimmed.replace(/\/+(?=#|$)/g, "");
  }
}

function hitDedupeKey(hit: SearchHit): string {
  const doc = hit.document ?? {};
  const url = normalizeUrlForDedupe(doc.url);
  const heading = normalizeText(doc.heading);
  const position = typeof doc.position === "number" ? doc.position : -1;
  const content = normalizeText(doc.content).slice(0, 180);
  return `${url}|${heading}|${position}|${content}`;
}

async function rawSearch(query: string, page: number, perPage: number): Promise<any> {
  return client
    .collections("docs")
    .documents()
    .search({
      q: query,

      // Only heading + content + code.
      // lvl1/lvl2/title are not searched because they repeat parent labels.
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

      include_fields:
        "title,heading,headingLevel,content,url,position,pageScore,rank,lvl1,lvl2",

      // rank desc is deterministic and precomputed at crawl time.
      sort_by: "_text_match:desc,rank:desc",

      page,
      per_page: perPage,
    });
}

export async function searchDocs({
  query,
  page = 1,
  perPage = 10,
}: SearchOptions): Promise<SearchDocsResult> {
  const startIndex = (page - 1) * perPage;
  const endIndex = startIndex + perPage;
  const rawPerPage = Math.max(MIN_RAW_PER_PAGE, perPage * RAW_PAGE_MULTIPLIER);

  const uniqueHits: any[] = [];
  const seenKeys = new Set<string>();

  let firstResult: any | null = null;
  let rawPage = 1;
  const maxRawPages = Math.max(5, Math.ceil(endIndex / rawPerPage) * 6);

  while (rawPage <= maxRawPages) {
    const current = await rawSearch(query, rawPage, rawPerPage);
    if (!firstResult) firstResult = current;

    const hits = Array.isArray(current.hits) ? current.hits : [];
    for (const hit of hits as SearchHit[]) {
      const key = hitDedupeKey(hit);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      uniqueHits.push(hit);
    }

    const reachedEnd = hits.length === 0 || rawPage * rawPerPage >= current.found;
    if (uniqueHits.length >= endIndex || reachedEnd) {
      break;
    }
    rawPage += 1;
  }

  if (!firstResult) {
    const fallback = await rawSearch(query, page, perPage);
    return {
      found:
        typeof fallback?.found === "number" && Number.isFinite(fallback.found)
          ? fallback.found
          : 0,
      page,
      hits: Array.isArray(fallback?.hits) ? fallback.hits : [],
    };
  }

  return {
    found:
      typeof firstResult.found === "number" && Number.isFinite(firstResult.found)
        ? firstResult.found
        : uniqueHits.length,
    page,
    hits: uniqueHits.slice(startIndex, endIndex),
  };
}
