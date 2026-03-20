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

type CandidateContext = RetrievedContext & {
  vectorScore: number;
  lexicalScore: number;
  coverage: number;
  matchedTokens: Set<string>;
  structuralScore: number;
  headingKey: string;
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

const SCORE_WEIGHTS = {
  vector: 0.68,
  lexical: 0.22,
  coverage: 0.08,
  structural: 0.02,
};

const COVERAGE_GAIN_WEIGHT = 0.12;
const DUPLICATE_HEADING_PENALTY = 0.05;

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

function normalizeKey(text: string): string {
  return normalize(text).replace(/\s+/g, " ").trim();
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

function hasAnyVariantNormalized(haystack: string, token: string): boolean {
  for (const variant of tokenVariants(token)) {
    if (haystack.includes(variant)) return true;
  }
  return false;
}

function analyzeLexical(
  queryTokens: string[],
  titleHeading: string,
  url: string,
  content: string
): { boost: number; coverage: number; matchedTokens: Set<string> } {
  const titleHeadingNorm = normalize(titleHeading);
  const urlNorm = normalize(url);
  const contentNorm = normalize(content);
  let titleHits = 0;
  let urlHits = 0;
  let contentHits = 0;
  const matchedTokens = new Set<string>();

  for (const token of queryTokens) {
    if (hasAnyVariantNormalized(titleHeadingNorm, token)) {
      titleHits += 1;
      matchedTokens.add(token);
      continue;
    }
    if (hasAnyVariantNormalized(urlNorm, token)) {
      urlHits += 1;
      matchedTokens.add(token);
      continue;
    }
    if (hasAnyVariantNormalized(contentNorm, token)) {
      contentHits += 1;
      matchedTokens.add(token);
    }
  }

  let boost = titleHits * 0.16 + urlHits * 0.12 + contentHits * 0.04;
  if (titleHits > 0 && urlHits > 0) {
    boost += 0.08;
  }

  const coverage =
    queryTokens.length > 0 ? matchedTokens.size / queryTokens.length : 0;

  return { boost, coverage, matchedTokens };
}

function baseUrl(url: string): string {
  return url.split("#")[0] ?? url;
}

function normalizeScore(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 0;
  }
  return (value - min) / (max - min);
}

function coverageGainScore(
  matchedTokens: Set<string>,
  coveredTokens: Set<string>,
  totalTokens: number
): number {
  if (totalTokens <= 0) return 0;
  let gain = 0;
  for (const token of matchedTokens) {
    if (!coveredTokens.has(token)) gain += 1;
  }
  return gain / totalTokens;
}

export function selectContexts(args: {
  query: string;
  rawResults: unknown[];
  limit: number;
  perPageLimit?: number;
}): RetrievedContext[] {
  const queryTokens = tokenize(args.query);
  const candidates: CandidateContext[] = args.rawResults.map((raw) => {
    const point = (raw ?? {}) as RetrievedPoint;
    const payload = (point.payload ?? {}) as Record<string, unknown>;
    const title = asString(payload.title) || asString(payload.heading) || "Untitled";
    const heading = asString(payload.heading);
    const lvl1 = asString(payload.lvl1);
    const lvl2 = asString(payload.lvl2);
    const url = asString(payload.url);
    const content = asString(payload.content);
    const code = asString(payload.code);
    const contentForMatch = code ? `${content}\n${code}` : content;
    const score = asNumber(point.score);
    const vectorScore = score ?? 0;
    const headingContext = [title, heading, lvl1, lvl2]
      .filter(Boolean)
      .join("\n");
    const lexical = analyzeLexical(
      queryTokens,
      headingContext,
      url,
      contentForMatch
    );
    const structuralScore =
      asNumber(payload.pageScore) ?? asNumber(payload.rank) ?? 0;
    const headingKey = normalizeKey(`${title} ${heading}`);
    const rankScore = 0;

    return {
      id: 0,
      url,
      title,
      heading,
      content,
      code,
      ...(typeof score === "number" ? { score } : {}),
      rankScore,
      vectorScore,
      lexicalScore: lexical.boost,
      coverage: lexical.coverage,
      matchedTokens: lexical.matchedTokens,
      structuralScore,
      headingKey,
    };
  });

  const vectorScores = candidates.map((c) => c.vectorScore);
  const lexicalScores = candidates.map((c) => c.lexicalScore);
  const structuralScores = candidates.map((c) => c.structuralScore);
  const minVector = Math.min(...vectorScores);
  const maxVector = Math.max(...vectorScores);
  const minLexical = Math.min(...lexicalScores);
  const maxLexical = Math.max(...lexicalScores);
  const minStructural = Math.min(...structuralScores);
  const maxStructural = Math.max(...structuralScores);

  for (const candidate of candidates) {
    const vectorScore = normalizeScore(candidate.vectorScore, minVector, maxVector);
    const lexicalScore = normalizeScore(candidate.lexicalScore, minLexical, maxLexical);
    const structuralScore = normalizeScore(
      candidate.structuralScore,
      minStructural,
      maxStructural
    );
    candidate.rankScore =
      vectorScore * SCORE_WEIGHTS.vector +
      lexicalScore * SCORE_WEIGHTS.lexical +
      candidate.coverage * SCORE_WEIGHTS.coverage +
      structuralScore * SCORE_WEIGHTS.structural;
  }

  candidates.sort((a, b) => b.rankScore - a.rankScore);

  const result: RetrievedContext[] = [];
  const perPageLimit = Math.max(1, args.perPageLimit ?? 2);
  const perPageCount = new Map<string, number>();
  const coveredTokens = new Set<string>();
  const usedHeadings = new Set<string>();
  const remaining = candidates.slice();

  while (result.length < args.limit && remaining.length > 0) {
    let bestIndex = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < remaining.length; i += 1) {
      const item = remaining[i];
      if (!item) continue;
      const key = baseUrl(item.url);
      const used = perPageCount.get(key) ?? 0;
      if (used >= perPageLimit) continue;

      const coverageGain = coverageGainScore(
        item.matchedTokens,
        coveredTokens,
        queryTokens.length
      );
      const duplicatePenalty = item.headingKey
        ? usedHeadings.has(item.headingKey)
          ? DUPLICATE_HEADING_PENALTY
          : 0
        : 0;

      const score =
        item.rankScore + coverageGain * COVERAGE_GAIN_WEIGHT - duplicatePenalty;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) break;

    const selected = remaining.splice(bestIndex, 1)[0]!;
    const key = baseUrl(selected.url);
    const used = perPageCount.get(key) ?? 0;
    perPageCount.set(key, used + 1);
    for (const token of selected.matchedTokens) {
      coveredTokens.add(token);
    }
    if (selected.headingKey) {
      usedHeadings.add(selected.headingKey);
    }

    result.push({ ...selected, id: result.length + 1 });
  }

  return result;
}
