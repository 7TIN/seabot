import { DocsAIClient } from "@docsai/core";
import type { DocsAIClientOptions } from "@docsai/core";
import { createBubble } from "./bubble.js";
import { createModal } from "./modal.js";
import { injectStyles } from "./styles.js";
import type {
  DocsAIInitConfig,
  DocsAIInstance,
  DocsAIMode,
  DocsAITheme
} from "./types.js";

interface InternalConfig {
  projectId: string;
  apiBaseUrl?: string;
  apiKey?: string;
  mode: DocsAIMode;
  theme: DocsAITheme;
  target: HTMLElement;
}

let activeInstance: DocsAIInstance | null = null;

export const DocsAI = {
  init(config: DocsAIInitConfig): DocsAIInstance {
    if (typeof document === "undefined") {
      throw new Error("DocsAI widget requires a browser-like DOM environment.");
    }

    const resolved = resolveConfig(config);
    injectStyles(resolved.theme);

    if (activeInstance) {
      activeInstance.destroy();
      activeInstance = null;
    }

    const clientOptions: DocsAIClientOptions = {
      projectId: resolved.projectId
    };

    if (resolved.apiBaseUrl) {
      clientOptions.apiBaseUrl = resolved.apiBaseUrl;
    }

    if (resolved.apiKey) {
      clientOptions.apiKey = resolved.apiKey;
    }

    const client = new DocsAIClient(clientOptions);

    const mount = document.createElement("div");
    mount.className = "docsai-root";
    resolved.target.appendChild(mount);

    const modal =
      resolved.mode === "bubble"
        ? null
        : createModal({ root: mount, client });

    const bubble =
      resolved.mode === "modal"
        ? null
        : createBubble({
            root: mount,
            onOpen: () => modal?.open()
          });

    activeInstance = {
      open() {
        modal?.open();
      },
      close() {
        modal?.close();
      },
      destroy() {
        bubble?.destroy();
        modal?.destroy();
        mount.remove();
      }
    };

    return activeInstance;
  }
};

if (typeof window !== "undefined") {
  window.DocsAI = DocsAI;
}

function resolveConfig(config: DocsAIInitConfig): InternalConfig {
  if (!config.projectId?.trim()) {
    throw new Error("DocsAI.init requires a non-empty projectId.");
  }

  const resolved: InternalConfig = {
    projectId: config.projectId.trim(),
    mode: config.mode ?? "both",
    theme: config.theme ?? "auto",
    target: config.target ?? document.body
  };

  const apiBaseUrl = config.apiBaseUrl?.trim();
  if (apiBaseUrl) {
    resolved.apiBaseUrl = apiBaseUrl;
  }

  const apiKey = config.apiKey?.trim();
  if (apiKey) {
    resolved.apiKey = apiKey;
  }

  return resolved;
}

declare global {
  interface Window {
    DocsAI?: typeof DocsAI;
  }
}

export type { DocsAIInitConfig, DocsAIInstance, DocsAIMode, DocsAITheme };
