export interface DocsAIClientOptions {
  projectId: string;
  apiBaseUrl?: string;
  apiKey?: string;
  headers?: HeadersInit;
  fetch?: typeof fetch;
}

export interface ResolvedDocsAIClientOptions {
  projectId: string;
  apiBaseUrl: string;
  apiKey?: string;
  headers: HeadersInit;
  fetcher: typeof fetch;
}

export interface SearchRequest {
  query: string;
  projectId: string;
}

export interface SearchResult {
  title: string;
  url: string;
  excerpt: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface AskRequest {
  query: string;
  projectId: string;
}

export interface SourceCitation {
  title: string;
  url: string;
}

export interface AskTokenEvent {
  type: "token";
  content: string;
}

export interface AskSourcesEvent {
  type: "sources";
  sources: SourceCitation[];
}

export interface AskDoneEvent {
  type: "done";
}

export interface AskErrorEvent {
  type: "error";
  message: string;
}

export type AskStreamEvent =
  | AskTokenEvent
  | AskSourcesEvent
  | AskDoneEvent
  | AskErrorEvent;
