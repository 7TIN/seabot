import { DocsAIClient } from "./client.js";
import type {
  AskStreamEvent,
  DocsAIClientOptions,
  SearchResponse
} from "./types.js";

export { DocsAIClient };

export function search(
  query: string,
  options: DocsAIClientOptions
): Promise<SearchResponse> {
  return new DocsAIClient(options).search(query);
}

export function ask(
  query: string,
  options: DocsAIClientOptions
): AsyncGenerator<AskStreamEvent> {
  return new DocsAIClient(options).ask(query);
}

export type {
  AskDoneEvent,
  AskErrorEvent,
  AskRequest,
  AskSourcesEvent,
  AskStreamEvent,
  AskTokenEvent,
  DocsAIClientOptions,
  SearchRequest,
  SearchResponse,
  SearchResult,
  SourceCitation
} from "./types.js";
