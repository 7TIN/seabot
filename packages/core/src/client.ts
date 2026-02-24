import { ask } from "./ask.js";
import { search } from "./search.js";
import type {
  AskStreamEvent,
  DocsAIClientOptions,
  ResolvedDocsAIClientOptions,
  SearchResponse
} from "./types.js";

export const DEFAULT_API_BASE_URL = "http://localhost:3001";

export class DocsAIClient {
  private readonly options: ResolvedDocsAIClientOptions;

  constructor(options: DocsAIClientOptions) {
    this.options = resolveClientOptions(options);
  }

  search(query: string): Promise<SearchResponse> {
    return search(query, this.options);
  }

  ask(query: string): AsyncGenerator<AskStreamEvent> {
    return ask(query, this.options);
  }
}

export function buildHeaders(
  options: ResolvedDocsAIClientOptions,
  includeJsonContentType = true
): Headers {
  const headers = new Headers(options.headers);

  if (includeJsonContentType) {
    headers.set("content-type", "application/json");
  }

  if (options.apiKey) {
    headers.set("x-api-key", options.apiKey);
  }

  return headers;
}

function resolveClientOptions(
  options: DocsAIClientOptions
): ResolvedDocsAIClientOptions {
  if (!options.projectId?.trim()) {
    throw new Error("DocsAIClient requires a non-empty projectId.");
  }

  const fetcher = options.fetch ?? globalThis.fetch;
  if (typeof fetcher !== "function") {
    throw new Error(
      "No fetch implementation available. Provide options.fetch explicitly."
    );
  }

  const resolved: ResolvedDocsAIClientOptions = {
    projectId: options.projectId.trim(),
    apiBaseUrl: normalizeApiBaseUrl(options.apiBaseUrl),
    headers: options.headers ?? {},
    fetcher
  };

  const apiKey = options.apiKey?.trim();
  if (apiKey) {
    resolved.apiKey = apiKey;
  }

  return resolved;
}

function normalizeApiBaseUrl(apiBaseUrl?: string): string {
  const value = (apiBaseUrl ?? DEFAULT_API_BASE_URL).trim();
  return value.endsWith("/") ? value.slice(0, -1) : value;
}
