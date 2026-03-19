export type RetrievedPoint = {
  score?: unknown;
  payload?: Record<string, unknown>;
};

export type RetrievedContext = {
  id: number;
  url: string;
  title: string;
  heading: string;
  content: string;
  code: string;
  score?: number;
  rankScore: number;
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "up",
  "use",
  "with",
]);

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function normalize(text: string): string {
  return text.toLowerCase();
}

function tokenize(text: string): string[] {
  const tokens = normalize(text).match(/[a-z0-9][a-z0-9._-]*/g) ?? [];
  const unique = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    if (STOP_WORDS.has(token)) continue;
    if (token.length < 2) continue;
    if (unique.has(token)) continue;
    unique.add(token);
    result.push(token);
  }
  return result;
}

function tokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  if (token.endsWith("js") && token.length > 2) {
    const base = token.slice(0, -2);
    variants.add(`${base}.js`);
    variants.add(`${base} js`);
  }
  variants.add(token.replace(".", ""));
  variants.add(token.replace("-", " "));
  return Array.from(variants);
}

function hasAnyVariant(text: string, token: string): boolean {
  const haystack = normalize(text);
  for (const variant of tokenVariants(token)) {
    if (haystack.includes(variant)) return true;
  }
  return false;
}

function lexicalBoost(
  queryTokens: string[],
  title: string,
  heading: string,
  url: string,
  content: string
): number {
  const titleHeading = `${title}\n${heading}`;
  let titleHits = 0;
  let urlHits = 0;
  let contentHits = 0;

  for (const token of queryTokens) {
    if (hasAnyVariant(titleHeading, token)) {
      titleHits += 1;
      continue;
    }
    if (hasAnyVariant(url, token)) {
      urlHits += 1;
      continue;
    }
    if (hasAnyVariant(content, token)) {
      contentHits += 1;
    }
  }

  let boost = titleHits * 0.16 + urlHits * 0.12 + contentHits * 0.04;
  if (titleHits > 0 && urlHits > 0) {
    boost += 0.08;
  }

  return boost;
}

function baseUrl(url: string): string {
  return url.split("#")[0] ?? url;
}

export function selectContexts(args: {
  query: string;
  rawResults: unknown[];
  limit: number;
  perPageLimit?: number;
}): RetrievedContext[] {
  const queryTokens = tokenize(args.query);
  const candidates: RetrievedContext[] = args.rawResults.map((raw) => {
    const point = (raw ?? {}) as RetrievedPoint;
    const payload = (point.payload ?? {}) as Record<string, unknown>;
    const title = asString(payload.title) || asString(payload.heading) || "Untitled";
    const heading = asString(payload.heading);
    const url = asString(payload.url);
    const content = asString(payload.content);
    const code = asString(payload.code);
    const score = asNumber(point.score);
    const vectorScore = score ?? 0;
    const rankScore =
      vectorScore + lexicalBoost(queryTokens, title, heading, url, content);

    return {
      id: 0,
      url,
      title,
      heading,
      content,
      code,
      ...(typeof score === "number" ? { score } : {}),
      rankScore,
    };
  });

  candidates.sort((a, b) => b.rankScore - a.rankScore);

  const result: RetrievedContext[] = [];
  const perPageLimit = Math.max(1, args.perPageLimit ?? 2);
  const perPageCount = new Map<string, number>();

  for (const item of candidates) {
    const key = baseUrl(item.url);
    const used = perPageCount.get(key) ?? 0;
    if (used >= perPageLimit) continue;

    perPageCount.set(key, used + 1);
    result.push({ ...item, id: result.length + 1 });

    if (result.length >= args.limit) break;
  }

  return result;
}
