import type { AskStreamEvent } from "@docsai/core";

interface AskRenderer {
  reset: () => void;
  apply: (event: AskStreamEvent) => void;
}

export function createAskRenderer(container: HTMLElement): AskRenderer {
  const answer = document.createElement("p");
  answer.className = "docsai-answer";

  const sources = document.createElement("ul");
  sources.className = "docsai-sources";

  container.replaceChildren(answer, sources);

  return {
    reset() {
      answer.textContent = "";
      sources.replaceChildren();
    },
    apply(event) {
      if (event.type === "token") {
        answer.textContent = `${answer.textContent ?? ""}${event.content}`;
        return;
      }

      if (event.type === "sources") {
        sources.replaceChildren();
        for (const source of event.sources) {
          const item = document.createElement("li");
          const link = document.createElement("a");
          link.href = source.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = source.title;
          item.appendChild(link);
          sources.appendChild(item);
        }
        return;
      }

      if (event.type === "error") {
        answer.textContent = event.message;
      }
    }
  };
}
