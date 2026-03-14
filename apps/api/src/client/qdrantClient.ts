const DEFAULT_QDRANT_URL = "http://localhost:6333";

export const QDRANT_URL = process.env.QDRANT_URL ?? DEFAULT_QDRANT_URL;
export const QDRANT_API_KEY = process.env.QDRANT_API_KEY ?? "";
export const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION ?? "docs";

export type QdrantResponse<T> = {
  result: T;
  status: string;
  time: number;
};

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export async function qdrantFetch(path: string, init: RequestInit = {}) {
  const url = new URL(normalizePath(path), QDRANT_URL);
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (QDRANT_API_KEY && !headers.has("api-key")) {
    headers.set("api-key", QDRANT_API_KEY);
  }

  return fetch(url, { ...init, headers });
}

export async function qdrantRequest<T>(path: string, init: RequestInit = {}) {
  const res = await qdrantFetch(path, init);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Qdrant request failed (${res.status} ${res.statusText}): ${body}`
    );
  }

  return (await res.json()) as QdrantResponse<T>;
}
