import type { SearchResult } from "@docsai/core";

export function renderSearchResults(
  container: HTMLElement,
  results: SearchResult[]
): void {
  container.replaceChildren();

  if (results.length === 0) {
    const empty = document.createElement("p");
    empty.className = "docsai-empty";
    empty.textContent = "No results found.";
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("ul");
  list.className = "docsai-result-list";

  for (const result of results) {
    const item = document.createElement("li");
    item.className = "docsai-result-item";

    const link = document.createElement("a");
    link.className = "docsai-result-link";
    link.href = result.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = result.title;

    const excerpt = document.createElement("p");
    excerpt.className = "docsai-result-excerpt";
    excerpt.textContent = result.excerpt;

    item.append(link, excerpt);
    list.appendChild(item);
  }

  container.appendChild(list);
}
