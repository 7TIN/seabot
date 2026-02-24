interface BubbleOptions {
  root: HTMLElement;
  onOpen: () => void;
}

export interface BubbleController {
  destroy: () => void;
}

export function createBubble(options: BubbleOptions): BubbleController {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "docsai-bubble";
  button.textContent = "Ask Docs";
  button.addEventListener("click", options.onOpen);

  options.root.appendChild(button);

  return {
    destroy() {
      button.removeEventListener("click", options.onOpen);
      button.remove();
    }
  };
}
