import { buildHeaders } from "./client.js";
import { parseSSE } from "./stream.js";
import type {
  AskRequest,
  AskStreamEvent,
  ResolvedDocsAIClientOptions
} from "./types.js";

export async function* ask(
  query: string,
  options: ResolvedDocsAIClientOptions
): AsyncGenerator<AskStreamEvent> {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return;
  }

  const payload: AskRequest = {
    query: cleanQuery,
    projectId: options.projectId
  };

  const response = await options.fetcher(`${options.apiBaseUrl}/ask`, {
    method: "POST",
    headers: buildHeaders(options),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`DocsAI ask failed (${response.status}).`);
  }

  if (!response.body) {
    throw new Error("DocsAI ask endpoint did not return a stream body.");
  }

  for await (const event of parseSSE<AskStreamEvent>(response.body)) {
    yield event;

    if (event.type === "done") {
      return;
    }
  }
}
