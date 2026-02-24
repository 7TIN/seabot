import { buildHeaders } from "./client.js";
import type {
  ResolvedDocsAIClientOptions,
  SearchRequest,
  SearchResponse
} from "./types.js";

export async function search(
  query: string,
  options: ResolvedDocsAIClientOptions
): Promise<SearchResponse> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return { results: [] };
  }

  const payload: SearchRequest = {
    query: cleanQuery,
    projectId: options.projectId
  };

  const response = await options.fetcher(`${options.apiBaseUrl}/search`, {
    method: "POST",
    headers: buildHeaders(options),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`DocsAI search failed (${response.status}).`);
  }

  return (await response.json()) as SearchResponse;
}
