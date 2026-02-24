import type { DocsAITheme } from "./types.js";

const STYLE_ID = "docsai-widget-style";

const STYLE_CONTENT = `
:root {
  --docsai-bg: #ffffff;
  --docsai-surface: #f6f7f9;
  --docsai-text: #1a202c;
  --docsai-muted: #4a5568;
  --docsai-border: #d8dee8;
  --docsai-accent: #14532d;
  --docsai-shadow: rgba(15, 23, 42, 0.2);
}

:root[data-docsai-theme="dark"] {
  --docsai-bg: #101828;
  --docsai-surface: #1d2939;
  --docsai-text: #f8fafc;
  --docsai-muted: #cbd5e1;
  --docsai-border: #334155;
  --docsai-accent: #22c55e;
  --docsai-shadow: rgba(2, 6, 23, 0.5);
}

.docsai-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.45);
}

.docsai-modal {
  width: min(640px, 100%);
  border-radius: 1rem;
  border: 1px solid var(--docsai-border);
  background: var(--docsai-bg);
  color: var(--docsai-text);
  box-shadow: 0 18px 45px var(--docsai-shadow);
  overflow: hidden;
}

.docsai-tab-row {
  display: flex;
  padding: 0.5rem;
  gap: 0.5rem;
  border-bottom: 1px solid var(--docsai-border);
  background: var(--docsai-surface);
}

.docsai-tab {
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: var(--docsai-muted);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.4rem 0.75rem;
}

.docsai-tab[aria-pressed="true"] {
  background: var(--docsai-accent);
  color: #ffffff;
}

.docsai-form {
  padding: 0.85rem 1rem;
}

.docsai-input {
  width: 100%;
  border-radius: 0.6rem;
  border: 1px solid var(--docsai-border);
  background: var(--docsai-bg);
  color: var(--docsai-text);
  font-size: 0.95rem;
  padding: 0.6rem 0.75rem;
}

.docsai-content {
  max-height: 60vh;
  overflow-y: auto;
  padding: 0 1rem 1rem;
}

.docsai-result-list,
.docsai-sources {
  display: grid;
  gap: 0.6rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.docsai-result-item {
  border: 1px solid var(--docsai-border);
  border-radius: 0.6rem;
  padding: 0.7rem;
}

.docsai-result-link {
  color: var(--docsai-accent);
  font-weight: 700;
  text-decoration: none;
}

.docsai-result-link:hover {
  text-decoration: underline;
}

.docsai-result-excerpt,
.docsai-answer,
.docsai-empty {
  color: var(--docsai-muted);
  margin: 0.35rem 0 0;
}

.docsai-bubble {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 2147482999;
  border: 0;
  border-radius: 999px;
  background: var(--docsai-accent);
  color: #ffffff;
  box-shadow: 0 14px 30px var(--docsai-shadow);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 700;
  padding: 0.7rem 1rem;
}
`;

export function injectStyles(theme: DocsAITheme): void {
  if (typeof document === "undefined") {
    return;
  }

  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE_CONTENT;
    document.head.appendChild(style);
  }

  const root = document.documentElement;

  if (theme === "auto") {
    root.removeAttribute("data-docsai-theme");
    return;
  }

  root.setAttribute("data-docsai-theme", theme);
}
