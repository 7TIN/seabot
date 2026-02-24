import type { DocsAIClient } from "@docsai/core";
import { createAskRenderer } from "./ask-ui.js";
import { registerKeyboardShortcuts } from "./keyboard.js";
import { renderSearchResults } from "./search-ui.js";

interface ModalOptions {
  root: HTMLElement;
  client: DocsAIClient;
}

export interface ModalController {
  open: () => void;
  close: () => void;
  destroy: () => void;
}

type Mode = "search" | "ask";

export function createModal(options: ModalOptions): ModalController {
  const backdrop = document.createElement("div");
  backdrop.className = "docsai-backdrop";
  backdrop.hidden = true;

  const modal = document.createElement("section");
  modal.className = "docsai-modal";

  const tabRow = document.createElement("div");
  tabRow.className = "docsai-tab-row";

  const searchTab = createTabButton("Search", true);
  const askTab = createTabButton("Ask AI", false);

  tabRow.append(searchTab, askTab);

  const form = document.createElement("form");
  form.className = "docsai-form";

  const input = document.createElement("input");
  input.className = "docsai-input";
  input.placeholder = "Search your docs...";
  input.type = "text";
  input.autocomplete = "off";
  form.appendChild(input);

  const content = document.createElement("div");
  content.className = "docsai-content";

  modal.append(tabRow, form, content);
  backdrop.appendChild(modal);
  options.root.appendChild(backdrop);

  let mode: Mode = "search";

  const open = (): void => {
    backdrop.hidden = false;
    input.focus();
  };

  const close = (): void => {
    backdrop.hidden = true;
  };

  const activateMode = (nextMode: Mode): void => {
    mode = nextMode;
    searchTab.setAttribute("aria-pressed", String(nextMode === "search"));
    askTab.setAttribute("aria-pressed", String(nextMode === "ask"));
    input.placeholder =
      nextMode === "search" ? "Search your docs..." : "Ask your question...";
    content.replaceChildren();

    if (nextMode === "ask") {
      content.appendChild(document.createElement("p")).textContent =
        "Ask a question and stream an answer.";
    }
  };

  const onSearchTabClick = (): void => {
    activateMode("search");
  };
  const onAskTabClick = (): void => {
    activateMode("ask");
  };

  const onBackdropClick = (event: MouseEvent): void => {
    if (event.target === backdrop) {
      close();
    }
  };

  const onSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    const query = input.value.trim();
    if (!query) {
      return;
    }

    if (mode === "search") {
      try {
        const response = await options.client.search(query);
        renderSearchResults(content, response.results);
      } catch (error) {
        content.replaceChildren();
        content.appendChild(document.createElement("p")).textContent = asMessage(
          error
        );
      }
      return;
    }

    content.replaceChildren();
    const resultRoot = document.createElement("div");
    content.appendChild(resultRoot);
    const renderer = createAskRenderer(resultRoot);

    try {
      for await (const eventChunk of options.client.ask(query)) {
        renderer.apply(eventChunk);
      }
    } catch (error) {
      renderer.apply({ type: "error", message: asMessage(error) });
    }
  };

  searchTab.addEventListener("click", onSearchTabClick);
  askTab.addEventListener("click", onAskTabClick);
  backdrop.addEventListener("click", onBackdropClick);
  form.addEventListener("submit", onSubmit);

  const keyboard = registerKeyboardShortcuts({
    onToggle: open,
    onClose: close
  });

  return {
    open,
    close,
    destroy() {
      keyboard.destroy();
      searchTab.removeEventListener("click", onSearchTabClick);
      askTab.removeEventListener("click", onAskTabClick);
      backdrop.removeEventListener("click", onBackdropClick);
      form.removeEventListener("submit", onSubmit);
      backdrop.remove();
    }
  };
}

function createTabButton(label: string, active: boolean): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "docsai-tab";
  button.textContent = label;
  button.setAttribute("aria-pressed", String(active));
  return button;
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}
